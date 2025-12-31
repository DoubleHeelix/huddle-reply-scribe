-- Store Trello board state per user so column moves persist across cache clears.
CREATE TABLE IF NOT EXISTS public.trello_board_state (
  user_id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  board_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.trello_board_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their trello board state"
  ON public.trello_board_state
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can upsert their trello board state"
  ON public.trello_board_state
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their trello board state"
  ON public.trello_board_state
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their trello board state"
  ON public.trello_board_state
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS trello_board_state_user_id_idx ON public.trello_board_state (user_id);
