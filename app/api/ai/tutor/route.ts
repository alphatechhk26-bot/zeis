import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const MAX_HISTORY_MESSAGES = 10;

const SYSTEM_PROMPTS = {
  student: `You are a friendly and patient AI tutor for school students.
Help with homework, explain subjects clearly, and encourage learning. Provide step-by-step explanations,
use analogies, and avoid giving direct answers to test questions. Always be supportive and age-appropriate.`,
  computer: `You are an expert coding assistant specializing in HTML, CSS, JavaScript, Python, and SQL.
Explain code clearly, suggest improvements, debug errors, and teach best practices. Keep explanations concise
and consider the learner's level.`,
  teacher: `You are an AI assistant for teachers. Help generate exam questions, create lesson plans, and suggest
teaching strategies. Be professional, thorough, and adaptable to different subjects and grade levels.`,
} as const;

const tutorRequestSchema = z.object({
  mode: z.enum(['student', 'computer', 'teacher']),
  message: z.string().trim().min(1).max(10000),
  conversation_id: z.string().uuid().optional(),
});

async function getAuthenticatedContext() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { response: NextResponse.json({ error: 'Please sign in to use the AI Tutor.' }, { status: 401 }) };
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, school_id')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    return { response: NextResponse.json({ error: 'Your ZEIS profile could not be found.' }, { status: 404 }) };
  }
  if (!profile.school_id) {
    return {
      response: NextResponse.json(
        { error: 'A school must be assigned to your ZEIS profile before using the AI Tutor.' },
        { status: 409 },
      ),
    };
  }

  return { supabase, user, profile: { ...profile, school_id: profile.school_id } };
}

function messageError(error: unknown, fallback: string) {
  console.error(fallback, error);
  return fallback;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedContext();
    if ('response' in auth) return auth.response;

    const conversationId = request.nextUrl.searchParams.get('conversation_id');
    if (conversationId) {
      const validatedId = z.string().uuid().safeParse(conversationId);
      if (!validatedId.success) {
        return NextResponse.json({ error: 'Invalid conversation ID.' }, { status: 400 });
      }

      const { data: conversation, error: conversationError } = await auth.supabase
        .from('ai_conversations')
        .select('id')
        .eq('id', validatedId.data)
        .eq('student_id', auth.user.id)
        .eq('school_id', auth.profile.school_id)
        .maybeSingle();

      if (conversationError) {
        console.error('Failed to verify AI conversation ownership:', conversationError);
        return NextResponse.json({ error: 'Unable to load this conversation.' }, { status: 500 });
      }
      if (!conversation) {
        return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 });
      }

      const { data: messages, error: messageError } = await auth.supabase
        .from('ai_messages')
        .select('id, role, content, created_at')
        .eq('conversation_id', conversation.id)
        .order('created_at', { ascending: true })
        .limit(500);

      if (messageError) {
        console.error('Failed to load AI conversation messages:', messageError);
        return NextResponse.json({ error: 'Unable to load conversation messages.' }, { status: 500 });
      }

      return NextResponse.json({ messages: messages ?? [] });
    }

    const { data: conversations, error: conversationError } = await auth.supabase
      .from('ai_conversations')
      .select('id, title, created_at')
      .eq('student_id', auth.user.id)
      .eq('school_id', auth.profile.school_id)
      .order('created_at', { ascending: false })
      .limit(100);

    if (conversationError) {
      console.error('Failed to load AI conversation history:', conversationError);
      return NextResponse.json({ error: 'Unable to load conversation history.' }, { status: 500 });
    }

    return NextResponse.json({ conversations: conversations ?? [] });
  } catch (error) {
    return NextResponse.json(
      { error: messageError(error, 'Unexpected error loading AI Tutor data.') },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  let conversationId: string | null = null;
  try {
    const auth = await getAuthenticatedContext();
    if ('response' in auth) return auth.response;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
    }

    const parsedRequest = tutorRequestSchema.safeParse(body);
    if (!parsedRequest.success) {
      return NextResponse.json(
        { error: 'Enter a message of up to 10,000 characters and choose a valid tutor mode.' },
        { status: 400 },
      );
    }

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json({ error: 'The AI Tutor is not configured. Please contact your administrator.' }, { status: 503 });
    }

    const { mode, message, conversation_id: requestedConversationId } = parsedRequest.data;
    let conversation;

    if (requestedConversationId) {
      const { data, error } = await auth.supabase
        .from('ai_conversations')
        .select('id')
        .eq('id', requestedConversationId)
        .eq('student_id', auth.user.id)
        .eq('school_id', auth.profile.school_id)
        .maybeSingle();

      if (error) {
        console.error('Failed to verify AI conversation ownership:', error);
        return NextResponse.json({ error: 'Unable to verify this conversation.' }, { status: 500 });
      }
      if (!data) {
        return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 });
      }
      conversation = data;
    } else {
      const title = message.slice(0, 60) + (message.length > 60 ? '...' : '');
      const { data, error } = await auth.supabase
        .from('ai_conversations')
        .insert({
          student_id: auth.user.id,
          school_id: auth.profile.school_id,
          title,
        })
        .select('id')
        .single();

      if (error || !data) {
        console.error('Failed to create AI conversation:', error);
        return NextResponse.json(
          { error: 'Unable to create a conversation. Check your ZEIS profile and try again.' },
          { status: 500 },
        );
      }
      conversation = data;
    }

    const convId = conversation.id;
    conversationId = convId;

    const { data: lastMessage, error: lastMessageError } = await auth.supabase
      .from('ai_messages')
      .select('role, content')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastMessageError) {
      console.error('Failed to check the latest AI message:', lastMessageError);
      return NextResponse.json(
        { error: 'Unable to prepare your message. Please try again.', conversation_id: convId },
        { status: 500 },
      );
    }

    const isRetry = lastMessage?.role === 'user' && lastMessage.content === message;
    if (!isRetry) {
      const { error: insertUserError } = await auth.supabase.from('ai_messages').insert({
        conversation_id: convId,
        role: 'user',
        content: message,
      });

      if (insertUserError) {
        console.error('Failed to save AI Tutor user message:', insertUserError);
        return NextResponse.json(
          { error: 'Unable to save your message. Please try again.', conversation_id: convId },
          { status: 500 },
        );
      }
    }

    const { data: history, error: historyError } = await auth.supabase
      .from('ai_messages')
      .select('role, content')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: false })
      .limit(MAX_HISTORY_MESSAGES);

    if (historyError) {
      console.error('Failed to load AI Tutor context:', historyError);
      return NextResponse.json(
        { error: 'Unable to load conversation context.', conversation_id: convId },
        { status: 500 },
      );
    }

    const openai = new OpenAI({ apiKey, timeout: 60_000, maxRetries: 1 });
    let stream: Awaited<ReturnType<typeof openai.chat.completions.create>>;
    try {
      stream = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPTS[mode] },
          ...(history ?? [])
            .reverse()
            .filter((item) => item.role === 'user' || item.role === 'assistant')
            .map((item) => ({
              role: item.role as 'user' | 'assistant',
              content: item.content,
            })),
        ],
        stream: true,
        temperature: 0.7,
        max_tokens: 2000,
      });
    } catch (error) {
      console.error('OpenAI failed to start an AI Tutor response:', error);
      return NextResponse.json(
        { error: 'The AI service could not start a response. Please retry shortly.', conversation_id: convId },
        { status: 502 },
      );
    }

    const encoder = new TextEncoder();
    const readableStream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let fullContent = '';
        const sendEvent = (event: { content?: string; error?: string }) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        };

        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content;
            if (content) {
              fullContent += content;
              sendEvent({ content });
            }
          }

          if (!fullContent) throw new Error('The AI provider returned an empty response.');

          const { error: insertAssistantError } = await auth.supabase.from('ai_messages').insert({
            conversation_id: convId,
            role: 'assistant',
            content: fullContent,
          });
          if (insertAssistantError) throw insertAssistantError;

          const { error: updateConversationError } = await auth.supabase
            .from('ai_conversations')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', convId)
            .eq('student_id', auth.user.id);
          if (updateConversationError) throw updateConversationError;
        } catch (error) {
          console.error('AI Tutor stream or persistence failed:', error);
          sendEvent({ error: 'The AI response could not be completed or saved. Please retry.' });
        } finally {
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        }
      },
    });

    return new NextResponse(readableStream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Conversation-ID': convId,
      },
    });
  } catch (error) {
    console.error('Unexpected AI Tutor API error:', error);
    return NextResponse.json(
      {
        error: 'Unexpected AI Tutor error. Please try again.',
        ...(conversationId ? { conversation_id: conversationId } : {}),
      },
      { status: 500 },
    );
  }
}
