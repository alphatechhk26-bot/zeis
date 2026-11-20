// components/ai/AITutorDrawer.tsx
'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import { useAIContext } from '@/contexts/AIContext';
import type { User } from '@supabase/supabase-js';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github-dark.css';
import {
  XMarkIcon,
  ChatBubbleLeftRightIcon,
  PaperAirplaneIcon,
  SparklesIcon,
  ClockIcon,
  HomeIcon,
} from '@heroicons/react/24/outline';

// --------------------------------------------------------------------------
// Prompt suggestions per mode
// --------------------------------------------------------------------------
const PROMPT_SUGGESTIONS: Record<string, string[]> = {
  student: [
    'Explain this topic like I\'m 10',
    'Help me solve this math problem',
    'What is photosynthesis?',
    'Give me a summary of the chapter',
  ],
  computer: [
    'Explain this code: ',
    'How do I debug this error?',
    'What is the best way to write a for loop?',
    'Explain CSS flexbox',
  ],
  teacher: [
    'Generate 5 exam questions on this topic',
    'Create a lesson plan for 45 minutes',
    'Suggest teaching strategies for this subject',
    'Explain this concept to students',
  ],
};

// --------------------------------------------------------------------------
// Message type
// --------------------------------------------------------------------------
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at?: string;
}

interface Conversation {
  id: string;
  title: string | null;
  created_at: string;
}

// --------------------------------------------------------------------------
// Main component
// --------------------------------------------------------------------------
export default function AITutorDrawer() {
  const pathname = usePathname();
  const { context, mode: contextMode } = useAIContext();

  // Derive mode from route if not set via context
  const activeMode = useMemo(() => {
    if (contextMode) return contextMode;
    if (pathname?.includes('/dashboard/student')) return 'student';
    if (pathname?.includes('/dashboard/teacher')) return 'teacher';
    if (pathname?.includes('/dashboard/admin')) return 'teacher';
    if (pathname?.includes('/computer-academy')) return 'computer';
    if (pathname?.includes('/lms')) return 'computer';
    return 'student';
  }, [pathname, contextMode]);

  // State
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyLoadedUserId, setHistoryLoadedUserId] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<{ id: string; school_id: string | null; role: string } | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [retryPrompt, setRetryPrompt] = useState<Message | null>(null);

  const historyRequestRef = useRef<{ userId: string; promise: Promise<Conversation[]> } | null>(null);
  const historyCacheRef = useRef<{ userId: string; conversations: Conversation[] } | null>(null);
  const messageRequestRef = useRef<{ conversationId: string; promise: Promise<Message[]> } | null>(null);
  const currentConversationIdRef = useRef<string | null>(null);
  const shouldLoadLatestRef = useRef(true);
  const sendingRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load user and profile
  useEffect(() => {
    const supabase = createClient();
    let active = true;

    async function loadUser() {
      setProfileLoading(true);
      setProfileError(null);
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError) throw new Error('Unable to verify your sign-in. Please refresh and try again.');
        if (!user) throw new Error('Sign in to use the AI Tutor.');

        const { data: profile, error: profileQueryError } = await supabase
          .from('profiles')
          .select('id, school_id, role')
          .eq('id', user.id)
          .single();

        if (profileQueryError || !profile) {
          throw new Error('Your ZEIS profile could not be loaded.');
        }

        if (active) {
          setUser(user);
          setProfile(profile);
        }
      } catch (error) {
        if (active) {
          setProfileError(error instanceof Error ? error.message : 'Unable to load your ZEIS profile.');
        }
      } finally {
        if (active) setProfileLoading(false);
      }
    }

    void loadUser();
    return () => {
      active = false;
    };
  }, []);

  // Fetch conversation history
  const fetchConversations = useCallback(async (force = false) => {
    if (!user) return [];
    if (!force && historyCacheRef.current?.userId === user.id) {
      return historyCacheRef.current.conversations;
    }
    if (historyRequestRef.current?.userId === user.id) {
      return historyRequestRef.current.promise;
    }

    setLoadingHistory(true);
    setHistoryError(null);
    const request = (async () => {
      const response = await fetch('/api/ai/tutor', { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Unable to load conversation history.');
      }
      return payload.conversations as Conversation[];
    })();

    historyRequestRef.current = { userId: user.id, promise: request };
    try {
      const data = await request;
      if (user.id === historyRequestRef.current?.userId) {
        historyCacheRef.current = { userId: user.id, conversations: data };
        setConversations(data);
        setHistoryLoadedUserId(user.id);
      }
      return data;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load conversation history.';
      setHistoryError(message);
      throw error;
    } finally {
      if (historyRequestRef.current?.promise === request) {
        historyRequestRef.current = null;
      }
      setLoadingHistory(false);
    }
  }, [user]);

  // Load messages for a conversation
  const loadConversation = useCallback(async (convId: string) => {
    if (!convId) return;
    if (messageRequestRef.current?.conversationId === convId) {
      return messageRequestRef.current.promise;
    }
    if (currentConversationIdRef.current === convId) return;

    const request = (async () => {
      const response = await fetch(
        `/api/ai/tutor?conversation_id=${encodeURIComponent(convId)}`,
        { cache: 'no-store' },
      );
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Unable to load this conversation.');
      }
      return payload.messages as Message[];
    })();

    messageRequestRef.current = { conversationId: convId, promise: request };
    try {
      const data = await request;
      setMessages(data);
      currentConversationIdRef.current = convId;
      setCurrentConversationId(convId);
      shouldLoadLatestRef.current = false;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load this conversation.';
      setHistoryError(message);
      throw error;
    } finally {
      if (messageRequestRef.current?.promise === request) {
        messageRequestRef.current = null;
      }
    }
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // History is fetched only when the drawer opens or the authenticated user changes.
  useEffect(() => {
    if (!isOpen || !user) return;
    let active = true;
    void Promise.resolve()
      .then(() => (active ? fetchConversations() : undefined))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [isOpen, user, fetchConversations]);

  useEffect(() => {
    if (
      isOpen &&
      user &&
      historyLoadedUserId === user.id &&
      shouldLoadLatestRef.current &&
      !currentConversationId &&
      conversations.length > 0
    ) {
      void loadConversation(conversations[0].id).catch(() => undefined);
    }
  }, [isOpen, user, historyLoadedUserId, currentConversationId, conversations, loadConversation]);

  useEffect(() => {
    const handleAssistantRequest = (event: Event) => {
      const { prompt } = (event as CustomEvent<{ prompt?: string }>).detail ?? {};
      if (prompt) setInput(prompt);
      setIsOpen(true);
      setTimeout(() => inputRef.current?.focus(), 300);
    };

    window.addEventListener('zeis:open-ai-assistant', handleAssistantRequest);
    return () => window.removeEventListener('zeis:open-ai-assistant', handleAssistantRequest);
  }, []);

  // Handle send button, keyboard submit, prompt chips, and retries.
  const sendMessage = useCallback(async (requestedText?: string, retryMessage?: Message) => {
    const text = (requestedText ?? input).trim();
    if (!text || isStreaming || sendingRef.current) return;
    if (!user || !profile) {
      setSendError(profileError || 'Sign in to use the AI Tutor.');
      return;
    }
    if (!profile.school_id) {
      setSendError('Your school has not been assigned yet. Contact your school administrator.');
      return;
    }

    const userMessage: Message = retryMessage ?? {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
    };
    const assistantMessageId = `assistant-${userMessage.id}`;
    if (!retryMessage) {
      setMessages((previous) => [...previous, userMessage]);
      setInput('');
    }
    setSendError(null);
    setRetryPrompt(null);
    setIsStreaming(true);
    sendingRef.current = true;

    const requestMessage = context ? `Context: ${context}\n\n${text}` : text;

    try {
      const response = await fetch('/api/ai/tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: activeMode,
          message: requestMessage,
          conversation_id: currentConversationIdRef.current ?? undefined,
        }),
      });

      const responseConversationId = response.headers.get('x-conversation-id');
      if (responseConversationId) {
        currentConversationIdRef.current = responseConversationId;
        setCurrentConversationId(responseConversationId);
      }

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        if (typeof payload?.conversation_id === 'string') {
          currentConversationIdRef.current = payload.conversation_id;
          setCurrentConversationId(payload.conversation_id);
        }
        throw new Error(payload?.error || `The AI Tutor request failed (${response.status}).`);
      }
      if (!response.body) throw new Error('The AI Tutor returned an empty response.');

      setMessages((previous) => [
        ...previous,
        { id: assistantMessageId, role: 'assistant', content: '' },
      ]);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';
      let buffer = '';

      const processLine = (line: string) => {
        if (!line.startsWith('data:')) return;
        const data = line.slice(5).trimStart();
        if (!data || data === '[DONE]') return;

        const parsed: { content?: string; error?: string } = JSON.parse(data);
        if (parsed.error) throw new Error(parsed.error);
        if (parsed.content) {
          assistantContent += parsed.content;
          setMessages((previous) =>
            previous.map((message) =>
              message.id === assistantMessageId
                ? { ...message, content: message.content + parsed.content }
                : message,
            ),
          );
        }
      };

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (value) buffer += decoder.decode(value, { stream: !done });
          const lines = buffer.split(/\r?\n/);
          buffer = lines.pop() ?? '';
          for (const line of lines) processLine(line);
          if (done) {
            if (buffer) processLine(buffer);
            break;
          }
        }
      } finally {
        reader.releaseLock();
      }

      if (!assistantContent) throw new Error('The AI Tutor did not return a response. Please try again.');
      await fetchConversations(true).catch((error: unknown) => {
        console.error('Unable to refresh conversation history:', error);
      });
    } catch (error) {
      console.error('AI Tutor request failed:', error);
      setSendError(error instanceof Error ? error.message : 'Unable to send your message. Please try again.');
      setRetryPrompt(userMessage);
      setMessages((previous) => previous.filter((message) => message.id !== assistantMessageId));
    } finally {
      sendingRef.current = false;
      setIsStreaming(false);
    }
  }, [input, isStreaming, user, profile, profileError, activeMode, context, fetchConversations]);

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Toggle drawer
  const toggleDrawer = () => {
    setIsOpen((prev) => !prev);
    if (!isOpen) {
      // Focus input when opening
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  };

  // Clear conversation (start new)
  const startNewConversation = () => {
    setMessages([]);
    setCurrentConversationId(null);
    currentConversationIdRef.current = null;
    shouldLoadLatestRef.current = false;
    setSendError(null);
    setRetryPrompt(null);
    setShowHistory(false);
  };

  // Select a conversation from history
  const selectConversation = (convId: string) => {
    shouldLoadLatestRef.current = false;
    void loadConversation(convId).catch(() => undefined);
    setShowHistory(false);
  };

  // Get suggestion chips based on mode
  const suggestions = useMemo(() => {
    const base = PROMPT_SUGGESTIONS[activeMode] || PROMPT_SUGGESTIONS.student;
    // If context is present, maybe add a specific suggestion
    if (context) {
      return [`Explain this code: ${context.slice(0, 30)}...`, ...base];
    }
    return base;
  }, [activeMode, context]);

  return (
    <>
      {/* Floating toggle button */}
      <motion.button
        className="fixed bottom-6 right-6 z-50 p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg shadow-blue-500/20 border border-blue-400/30"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={toggleDrawer}
      >
        <ChatBubbleLeftRightIcon className="h-6 w-6" />
      </motion.button>

      {/* Drawer */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed top-0 right-0 w-full sm:w-[480px] h-full bg-gray-900/90 backdrop-blur-xl border-l border-gray-700/50 shadow-2xl z-50 flex flex-col"
            style={{ backdropFilter: 'blur(20px)' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700/50">
              <div className="flex items-center space-x-2">
                <SparklesIcon className="h-5 w-5 text-blue-400" />
                <h2 className="text-lg font-semibold text-white">
                  AI Tutor
                  <span className="ml-2 text-xs px-2 py-0.5 bg-blue-600/20 text-blue-400 rounded-full">
                    {activeMode}
                  </span>
                </h2>
              </div>
              <div className="flex items-center space-x-1">
                <button
                  type="button"
                  aria-label="Conversation history"
                  onClick={() => setShowHistory(!showHistory)}
                  className="p-1.5 rounded-md hover:bg-gray-800 text-gray-400 hover:text-white"
                >
                  <ClockIcon className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={startNewConversation}
                  aria-label="Start a new conversation"
                  className="p-1.5 rounded-md hover:bg-gray-800 text-gray-400 hover:text-white"
                >
                  <HomeIcon className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={toggleDrawer}
                  aria-label="Close AI Tutor"
                  className="p-1.5 rounded-md hover:bg-gray-800 text-gray-400 hover:text-white"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Conversation history panel (slide out) */}
            <AnimatePresence>
              {showHistory && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="border-b border-gray-700/50 max-h-48 overflow-y-auto p-2"
                >
                  {loadingHistory ? (
                    <div role="status" className="text-center text-gray-500 text-sm py-2">Loading conversations...</div>
                  ) : historyError ? (
                    <div className="p-3 text-center">
                      <p role="alert" className="text-sm text-red-300">{historyError}</p>
                      <button
                        type="button"
                        onClick={() => void fetchConversations(true).catch(() => undefined)}
                        className="mt-2 text-xs font-medium text-blue-300 hover:text-blue-200"
                      >
                        Retry loading history
                      </button>
                    </div>
                  ) : conversations.length === 0 ? (
                    <div className="text-center text-gray-500 text-sm py-2">No conversations yet</div>
                  ) : (
                    conversations.map((conv) => (
                      <button
                        key={conv.id}
                        onClick={() => selectConversation(conv.id)}
                        className={`w-full text-left px-3 py-2 rounded-md hover:bg-gray-800 text-sm ${
                          conv.id === currentConversationId ? 'bg-gray-800 text-blue-400' : 'text-gray-300'
                        }`}
                      >
                        <div className="truncate">{conv.title || 'New conversation'}</div>
                        <div className="text-xs text-gray-500">
                          {new Date(conv.created_at).toLocaleDateString()}
                        </div>
                      </button>
                    ))
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {profileLoading && (
                <p role="status" className="text-center text-sm text-gray-400">Verifying your ZEIS account…</p>
              )}
              {!profileLoading && profileError && (
                <p role="alert" className="rounded-lg border border-red-500/30 bg-red-950/30 p-3 text-sm text-red-200">
                  {profileError}
                </p>
              )}
              {!profileLoading && profile && !profile.school_id && (
                <p role="status" className="rounded-lg border border-amber-500/30 bg-amber-950/30 p-3 text-sm text-amber-100">
                  Your school has not been assigned yet. Contact your school administrator to enable AI Tutor conversations.
                </p>
              )}
              {sendError && (
                <div role="alert" className="rounded-lg border border-red-500/30 bg-red-950/30 p-3 text-sm text-red-200">
                  <p>{sendError}</p>
                  {retryPrompt && (
                    <button
                      type="button"
                      onClick={() => void sendMessage(retryPrompt.content, retryPrompt)}
                      disabled={isStreaming}
                      className="mt-2 font-medium text-red-100 underline underline-offset-2 disabled:opacity-50"
                    >
                      Retry message
                    </button>
                  )}
                </div>
              )}
              {messages.length === 0 ? (
                <div className="text-center text-gray-500 mt-20">
                  <SparklesIcon className="h-12 w-12 mx-auto text-blue-400/30" />
                  <p className="mt-2">Ask me anything about your learning!</p>
                  <div className="flex flex-wrap gap-2 justify-center mt-4">
                    {suggestions.slice(0, 4).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => void sendMessage(s)}
                        disabled={profileLoading || !user || !profile?.school_id || isStreaming}
                        className="px-3 py-1.5 bg-gray-800/50 hover:bg-gray-700 rounded-full text-xs text-gray-300 border border-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((msg, idx) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                        msg.role === 'user'
                          ? 'bg-blue-600/80 text-white'
                          : 'bg-gray-800/80 text-gray-200'
                      }`}
                    >
                      {msg.role === 'assistant' ? (
                        <div className="prose prose-invert prose-sm max-w-none prose-pre:bg-gray-900/80">
                          {msg.content ? (
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              rehypePlugins={[rehypeHighlight]}
                            >
                              {msg.content}
                            </ReactMarkdown>
                          ) : (
                            <span role="status" className="text-gray-400">Thinking…</span>
                          )}
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                      )}
                      {msg.role === 'assistant' && isStreaming && idx === messages.length - 1 && (
                        <span className="inline-block w-2 h-2 ml-1 bg-blue-400 rounded-full animate-pulse" />
                      )}
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="border-t border-gray-700/50 p-3 flex items-end space-x-2 bg-gray-900/50">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask a question..."
                rows={2}
                className="flex-1 bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                disabled={isStreaming || profileLoading || !user || !profile?.school_id}
              />
              <button
                type="button"
                onClick={() => void sendMessage()}
                disabled={!input.trim() || isStreaming || profileLoading || !user || !profile?.school_id}
                className="p-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg text-white flex-shrink-0"
                aria-label={isStreaming ? 'Sending message' : 'Send message'}
              >
                {isStreaming ? (
                  <span className="block h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                ) : (
                  <PaperAirplaneIcon className="h-5 w-5" />
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}