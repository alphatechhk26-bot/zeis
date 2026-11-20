DO $$
BEGIN
  CREATE TYPE public.conversation_role AS ENUM ('user', 'assistant', 'system');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.ai_conversations
  ADD COLUMN IF NOT EXISTS student_id UUID,
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ai_conversations'
      AND column_name = 'user_id'
  ) THEN
    EXECUTE '
      UPDATE public.ai_conversations
      SET student_id = user_id
      WHERE student_id IS NULL AND user_id IS NOT NULL
    ';
  END IF;
END
$$;

ALTER TABLE public.ai_conversations
  DROP CONSTRAINT IF EXISTS ai_conversations_student_id_fkey;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ai_conversations_student_id_fkey'
      AND conrelid = 'public.ai_conversations'::regclass
  ) THEN
    ALTER TABLE public.ai_conversations
      ADD CONSTRAINT ai_conversations_student_id_fkey
      FOREIGN KEY (student_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ai_conversations'
      AND column_name = 'messages'
  ) THEN
    ALTER TABLE public.ai_conversations
      ALTER COLUMN messages SET DEFAULT '[]'::JSONB;
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.ai_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  role public.conversation_role NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ai_conversations_owner_created_at_idx
  ON public.ai_conversations (student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_messages_conversation_created_at_idx
  ON public.ai_messages (conversation_id, created_at);

ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_conversations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_messages TO authenticated;

DROP POLICY IF EXISTS ai_conversations_owner_access ON public.ai_conversations;
CREATE POLICY ai_conversations_owner_access
  ON public.ai_conversations
  FOR ALL TO authenticated
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

DROP POLICY IF EXISTS ai_conversations_owner_restriction ON public.ai_conversations;
CREATE POLICY ai_conversations_owner_restriction
  ON public.ai_conversations
  AS RESTRICTIVE
  FOR ALL TO authenticated
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

DROP POLICY IF EXISTS ai_messages_owner_access ON public.ai_messages;
CREATE POLICY ai_messages_owner_access
  ON public.ai_messages
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.ai_conversations AS conversation
      WHERE conversation.id = conversation_id
        AND conversation.student_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.ai_conversations AS conversation
      WHERE conversation.id = conversation_id
        AND conversation.student_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS ai_messages_owner_restriction ON public.ai_messages;
CREATE POLICY ai_messages_owner_restriction
  ON public.ai_messages
  AS RESTRICTIVE
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.ai_conversations AS conversation
      WHERE conversation.id = conversation_id
        AND conversation.student_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.ai_conversations AS conversation
      WHERE conversation.id = conversation_id
        AND conversation.student_id = auth.uid()
    )
  );
