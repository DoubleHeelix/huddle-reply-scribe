
-- Create a table to store huddle plays
CREATE TABLE public.huddle_plays (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  screenshot_text TEXT NOT NULL,
  user_draft TEXT NOT NULL,
  generated_reply TEXT NOT NULL,
  principles TEXT,
  selected_tone TEXT DEFAULT 'none',
  final_reply TEXT, -- The final reply after tone adjustment
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add Row Level Security (RLS)
ALTER TABLE public.huddle_plays ENABLE ROW LEVEL SECURITY;

-- Create policies for users to manage their own huddle plays
CREATE POLICY "Users can view their own huddle plays" 
  ON public.huddle_plays 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own huddle plays" 
  ON public.huddle_plays 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own huddle plays" 
  ON public.huddle_plays 
  FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own huddle plays" 
  ON public.huddle_plays 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- Create an index on created_at for faster queries
CREATE INDEX huddle_plays_created_at_idx ON public.huddle_plays (created_at DESC);
CREATE INDEX huddle_plays_user_id_idx ON public.huddle_plays (user_id);
