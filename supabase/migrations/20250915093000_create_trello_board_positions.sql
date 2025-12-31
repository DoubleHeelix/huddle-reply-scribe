-- Persist Trello board placement per user so columns survive cache clears/logouts.
CREATE TABLE IF NOT EXISTS public.trello_board_positions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  name TEXT NOT NULL,
  column_id TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'convo',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT trello_board_positions_user_name_mode_unique UNIQUE (user_id, name, mode)
);

ALTER TABLE public.trello_board_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own trello board positions"
  ON public.trello_board_positions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own trello board positions"
  ON public.trello_board_positions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own trello board positions"
  ON public.trello_board_positions
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own trello board positions"
  ON public.trello_board_positions
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS trello_board_positions_user_idx ON public.trello_board_positions (user_id);
