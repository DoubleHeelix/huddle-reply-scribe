-- Store per-message person overrides so users can relink individual huddles.
CREATE TABLE IF NOT EXISTS public.huddle_person_overrides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  huddle_play_id UUID REFERENCES public.huddle_plays NOT NULL,
  raw_name TEXT,
  override TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT huddle_person_overrides_user_huddle_unique UNIQUE (user_id, huddle_play_id)
);

ALTER TABLE public.huddle_person_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own huddle person overrides"
  ON public.huddle_person_overrides
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own huddle person overrides"
  ON public.huddle_person_overrides
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own huddle person overrides"
  ON public.huddle_person_overrides
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own huddle person overrides"
  ON public.huddle_person_overrides
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS huddle_person_overrides_user_idx ON public.huddle_person_overrides (user_id);
CREATE INDEX IF NOT EXISTS huddle_person_overrides_huddle_idx ON public.huddle_person_overrides (huddle_play_id);
