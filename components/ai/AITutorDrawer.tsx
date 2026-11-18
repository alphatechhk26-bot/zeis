// components/ai/AITutorDrawer.tsx
'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import { useAIContext } from '@/contexts/AIContext';
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
import { useDebounce } from 'use-debounce';

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
  const { context, mode: contextMode, setMode } = useAIContext();

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
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<{ id: string; school_id: string } | null>(null);

  const supabase = createClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load user and profile
  useEffect(() => {
    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUser(user);
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, school_id')
          .eq('id', user.id)
          .single();
        const schoolId = profile?.school_id;
        if (profile && schoolId) setProfile({ id: profile.id, school_id: schoolId });
      }
    }
    loadUser();
  }, [supabase]);

  // Fetch conversation history
  const fetchConversations = useCallback(async () => {
    if (!user) return;
    setLoadingHistory(true);
    const { data, error } = await supabase
      .from('ai_conversations')
      .select('id, title, created_at')
      .eq('student_id', user.id)
      .order('created_at', { ascending: false });
    if (!error && data) {
      setConversations(data);
    }
    setLoadingHistory(false);
  }, [user, supabase]);

  // Load messages for a conversation
  const loadConversation = useCallback(async (convId: string) => {
    if (!convId) return;
    const { data, error } = await supabase
      .from('ai_messages')
      .select('id, role, content, created_at')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true });
    if (!error && data) {
      setMessages(data as Message[]);
      setCurrentConversationId(convId);
    }
  }, [supabase]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // On open, fetch history and load latest conversation if exists
  useEffect(() => {
    if (isOpen) {
      // This effect intentionally starts async loading when the drawer opens.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchConversations();
      // Load the most recent conversation, if any
      if (conversations.length > 0 && !currentConversationId) {
        loadConversation(conversations[0].id);
      }
    }
  }, [isOpen, fetchConversations, loadConversation, conversations, currentConversationId]);

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

  // Handle sending message
  const sendMessage = useCallback(async () => {
    if (!input.trim() || isStreaming || !user || !profile) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsStreaming(true);

    // Build payload
    const payload: any = {
      mode: activeMode,
      message: userMessage.content,
      student_id: user.id,
      school_id: profile.school_id,
      conversation_id: currentConversationId || undefined,
    };

    // Add context if provided (e.g., code snippet)
    if (context) {
      // We'll append context to the message, or send as a separate field.
      // The API expects only these fields, but we can combine context into message.
      // Better: prepend context to the message.
      payload.message = `Context: ${context}\n\n${payload.message}`;
    }

    try {
      const response = await fetch('/api/ai/tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.body) {
        throw new Error('No response body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';
      const assistantMessageId = Date.now() + 1;

      // Add placeholder for assistant message
      setMessages((prev) => [
        ...prev,
        { id: String(assistantMessageId), role: 'assistant', content: '' },
      ]);

      // Process stream
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                assistantContent += parsed.content;
                // Update the assistant message in state (append)
                setMessages((prev) => {
                  const last = prev[prev.length - 1];
                  if (last.role === 'assistant' && last.id === String(assistantMessageId)) {
                    return [
                      ...prev.slice(0, -1),
                      { ...last, content: last.content + parsed.content },
                    ];
                  }
                  return prev;
                });
              }
            } catch {
              // ignore malformed JSON
            }
          }
        }
      }

      // After stream ends, the assistant message is complete
      // The API already saved it to the DB, but we have it in state.

      // Update conversation ID if it was created by the API
      // The API returns conversation_id in the response headers? Not in SSE.
      // We could parse the first chunk for metadata, but for simplicity we'll rely on the fact that a new conversation was created if we didn't have one.
      // We can fetch conversations again.
      await fetchConversations();

    } catch (error) {
      console.error('Stream error:', error);
      // Add error message
      setMessages((prev) => [
        ...prev,
        { id: Date.now().toString(), role: 'assistant', content: 'Sorry, an error occurred.' },
      ]);
    } finally {
      setIsStreaming(false);
    }
  }, [input, isStreaming, user, profile, activeMode, context, currentConversationId, supabase, fetchConversations]);

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
    setShowHistory(false);
  };

  // Select a conversation from history
  const selectConversation = (convId: string) => {
    loadConversation(convId);
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
                  onClick={() => setShowHistory(!showHistory)}
                  className="p-1.5 rounded-md hover:bg-gray-800 text-gray-400 hover:text-white"
                >
                  <ClockIcon className="h-5 w-5" />
                </button>
                <button
                  onClick={startNewConversation}
                  className="p-1.5 rounded-md hover:bg-gray-800 text-gray-400 hover:text-white"
                >
                  <HomeIcon className="h-5 w-5" />
                </button>
                <button
                  onClick={toggleDrawer}
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
                    <div className="text-center text-gray-500 text-sm py-2">Loading...</div>
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
              {messages.length === 0 ? (
                <div className="text-center text-gray-500 mt-20">
                  <SparklesIcon className="h-12 w-12 mx-auto text-blue-400/30" />
                  <p className="mt-2">Ask me anything about your learning!</p>
                  <div className="flex flex-wrap gap-2 justify-center mt-4">
                    {suggestions.slice(0, 4).map((s) => (
                      <button
                        key={s}
                        onClick={() => {
                          setInput(s);
                          setTimeout(() => sendMessage(), 100);
                        }}
                        className="px-3 py-1.5 bg-gray-800/50 hover:bg-gray-700 rounded-full text-xs text-gray-300 border border-gray-700"
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
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            rehypePlugins={[rehypeHighlight]}
                          >
                            {msg.content || '...'}
                          </ReactMarkdown>
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
                disabled={isStreaming}
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || isStreaming}
                className="p-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg text-white flex-shrink-0"
              >
                <PaperAirplaneIcon className="h-5 w-5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}