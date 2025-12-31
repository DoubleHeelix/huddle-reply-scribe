-- Track name-to-column placement for Trello so moves persist across devices/cache clears.
CREATE TABLE IF NOT EXISTS public.trello_name_positions (
  user_id UUID REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL,
  column_id TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, name)
);

ALTER TABLE public.trello_name_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their trello name positions"
  ON public.trello_name_positions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can upsert their trello name positions"
  ON public.trello_name_positions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their trello name positions"
  ON public.trello_name_positions
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their trello name positions"
  ON public.trello_name_positions
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS trello_name_positions_user_id_idx ON public.trello_name_positions (user_id);
