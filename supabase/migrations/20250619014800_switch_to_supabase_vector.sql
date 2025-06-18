-- Add a vector column to the huddle_plays table
ALTER TABLE public.huddle_plays
ADD COLUMN embedding vector(1536);

-- Create a function to search for similar huddle plays
CREATE OR REPLACE FUNCTION match_huddle_plays (
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  p_user_id uuid
)
RETURNS TABLE (
  id uuid,
  screenshot_text text,
  user_draft text,
  generated_reply text,
  final_reply text,
  created_at timestamptz,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    hp.id,
    hp.screenshot_text,
    hp.user_draft,
    hp.generated_reply,
    hp.final_reply,
    hp.created_at,
    1 - (hp.embedding <=> query_embedding) as similarity
  FROM
    public.huddle_plays as hp
  WHERE
    hp.user_id = p_user_id AND 1 - (hp.embedding <=> query_embedding) > match_threshold
  ORDER BY
    hp.embedding <=> query_embedding
  LIMIT
    match_count;
END;
$$;

-- Create an index for the new embedding column
CREATE INDEX ON public.huddle_plays USING ivfflat (embedding vector_cosine_ops)
WITH
  (lists = 100);