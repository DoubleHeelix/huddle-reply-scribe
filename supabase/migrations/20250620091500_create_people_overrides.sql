-- Stores user-specific overrides for extracted people names so corrections persist across devices.
CREATE TABLE IF NOT EXISTS public.people_overrides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  raw_name TEXT NOT NULL,
  override TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT people_overrides_user_raw_unique UNIQUE (user_id, raw_name)
);

ALTER TABLE public.people_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own people overrides"
  ON public.people_overrides
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own people overrides"
  ON public.people_overrides
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own people overrides"
  ON public.people_overrides
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own people overrides"
  ON public.people_overrides
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS people_overrides_user_idx ON public.people_overrides (user_id);
