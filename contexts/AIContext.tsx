// contexts/AIContext.tsx
'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

interface AIContextType {
  context: string;
  setContext: (context: string) => void;
  mode: 'student' | 'computer' | 'teacher';
  setMode: (mode: 'student' | 'computer' | 'teacher') => void;
}

const AIContext = createContext<AIContextType | undefined>(undefined);

export function AIProvider({ children }: { children: ReactNode }) {
  const [context, setContext] = useState('');
  const [mode, setMode] = useState<'student' | 'computer' | 'teacher'>('student');

  return (
    <AIContext.Provider value={{ context, setContext, mode, setMode }}>
      {children}
    </AIContext.Provider>
  );
}

export function useAIContext() {
  const ctx = useContext(AIContext);
  if (!ctx) throw new Error('useAIContext must be used within AIProvider');
  return ctx;
}