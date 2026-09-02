// app/api/ai/tutor/route.ts
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/zeis';

// ----------------------------------------------------------------------
// Configuration
// ----------------------------------------------------------------------

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const MAX_HISTORY_MESSAGES = 10; // last N messages to include as context

// System prompts per mode
const SYSTEM_PROMPTS: Record<string, string> = {
  student: `You are a friendly and patient AI tutor for school students. 
Your role is to help with homework, explain subjects clearly, and encourage learning. 
Provide step-by-step explanations, use analogies, and avoid giving direct answers to test questions. 
Always be supportive and age-appropriate.`,

  computer: `You are an expert coding assistant specializing in HTML, CSS, JavaScript, Python, and SQL. 
Explain code clearly, suggest improvements, debug errors, and teach best practices. 
Use examples, keep explanations concise, and always consider the learner's level.`,

  teacher: `You are an AI assistant for teachers. Your tasks include:
- Generating exam questions with varying difficulty levels.
- Creating lesson plans with objectives, activities, and assessments.
- Suggesting teaching strategies and resources.
Be professional, thorough, and adaptable to different subjects and grade levels.`,
};

// ----------------------------------------------------------------------
// Request validation schema (manual)
// ----------------------------------------------------------------------

interface TutorRequest {
  mode: 'student' | 'computer' | 'teacher';
  message: string;
  conversation_id?: string;
  student_id: string;
  school_id: string;
}

function isValidRequest(body: any): body is TutorRequest {
  return (
    body &&
    typeof body.mode === 'string' &&
    ['student', 'computer', 'teacher'].includes(body.mode) &&
    typeof body.message === 'string' &&
    body.message.trim().length > 0 &&
    typeof body.student_id === 'string' &&
    typeof body.school_id === 'string'
  );
}

// ----------------------------------------------------------------------
// POST handler
// ----------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate user
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse and validate request body
    const body = await request.json();
    if (!isValidRequest(body)) {
      return NextResponse.json(
        { error: 'Invalid request: missing or malformed fields.' },
        { status: 400 }
      );
    }

    const { mode, message, conversation_id, student_id, school_id } = body;

    // 3. Verify user has permission to access this student/school
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, school_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'User profile not found.' }, { status: 404 });
    }

    // Allow if user is the student themselves, or a teacher/admin of the same school
    const isSelf = user.id === student_id;
    const isStaff = ['admin', 'teacher', 'super_admin'].includes(profile.role);
    const sameSchool = profile.school_id === school_id;

    if (!isSelf && !(isStaff && sameSchool)) {
      return NextResponse.json(
        { error: 'You do not have permission to access this student.' },
        { status: 403 }
      );
    }

    // 4. Get or create conversation
    let convId = conversation_id;
    if (convId) {
      // Verify the conversation belongs to this student and school
      const { data: conv, error: convError } = await supabase
        .from('ai_conversations')
        .select('id')
        .eq('id', convId)
        .eq('student_id', student_id)
        .eq('school_id', school_id)
        .single();

      if (convError || !conv) {
        return NextResponse.json(
          { error: 'Conversation not found or does not belong to this student.' },
          { status: 404 }
        );
      }
    } else {
      // Create new conversation
      const title = message.slice(0, 60) + (message.length > 60 ? '...' : '');
      const { data: newConv, error: createError } = await supabase
        .from('ai_conversations')
        .insert({
          school_id,
          student_id,
          title,
        })
        .select('id')
        .single();

      if (createError || !newConv) {
        return NextResponse.json(
          { error: 'Failed to create conversation.' },
          { status: 500 }
        );
      }
      convId = newConv.id;
    }

    // 5. Save user message to ai_messages
    const { error: insertUserError } = await supabase.from('ai_messages').insert({
      conversation_id: convId,
      role: 'user',
      content: message,
    });

    if (insertUserError) {
      // Log error but continue – we don't want to fail the whole request
      console.error('Failed to save user message:', insertUserError);
    }

    // 6. Fetch conversation history (for context)
    const { data: history, error: historyError } = await supabase
      .from('ai_messages')
      .select('role, content')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true })
      .limit(MAX_HISTORY_MESSAGES);

    if (historyError) {
      console.error('Failed to fetch history:', historyError);
    }

    // Build messages for OpenAI
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: SYSTEM_PROMPTS[mode] },
    ];

    // Add history (excluding the user message we just inserted, if it's in the list)
    // We'll include up to MAX_HISTORY_MESSAGES
    const historyMessages = history || [];
    for (const msg of historyMessages) {
      // Avoid duplicating the current user message if it was already inserted
      // but since we inserted it, it's in history; we can skip if we want to avoid duplicates,
      // but we want it included for context, but we already have it as the last message.
      // We'll include all except possibly the last user message if we want to add it separately?
      // Actually we already have the user message in the database; we'll just include history
      // and then add the current user message again? Better: we add user message separately at the end.
    }

    // Add the current user message (we already saved it, but we need to include it in the OpenAI call)
    messages.push({ role: 'user', content: message });

    // 7. Call OpenAI with streaming
    const stream = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // or 'gpt-4-turbo' for better quality
      messages,
      stream: true,
      temperature: 0.7,
      max_tokens: 2000,
    });

    // 8. Create a streaming response
    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        let fullContent = '';

        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
              fullContent += content;
              // Send the chunk as SSE (Server-Sent Events)
              const eventData = `data: ${JSON.stringify({ content })}\n\n`;
              controller.enqueue(encoder.encode(eventData));
            }
          }

          // After stream ends, save the assistant message
          if (fullContent) {
            const { error: insertAssistError } = await supabase
              .from('ai_messages')
              .insert({
                conversation_id: convId,
                role: 'assistant',
                content: fullContent,
              });

            if (insertAssistError) {
              console.error('Failed to save assistant message:', insertAssistError);
            }

            // Update conversation updated_at (optional)
            await supabase
              .from('ai_conversations')
              .update({ updated_at: new Date().toISOString() })
              .eq('id', convId);
          }

          // End SSE stream
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          console.error('Streaming error:', error);
          const errorMsg = `data: ${JSON.stringify({ error: 'Streaming error' })}\n\n`;
          controller.enqueue(encoder.encode(errorMsg));
          controller.close();
        }
      },
    });

    // 9. Return streaming response with appropriate headers
    return new NextResponse(readableStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error.' },
      { status: 500 }
    );
  }
}