-- First, drop the existing function if it exists
DROP FUNCTION IF EXISTS public.search_document_knowledge;

-- Then, create the updated function without the user_id filter
CREATE OR REPLACE FUNCTION search_document_knowledge(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  document_name text,
  content_chunk text,
  similarity float,
  metadata jsonb
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dk.id,
    dk.document_name,
    dk.content_chunk,
    1 - (dk.embedding <=> query_embedding) as similarity,
    dk.metadata
  FROM
    document_knowledge AS dk
  WHERE
    1 - (dk.embedding <=> query_embedding) > match_threshold
  ORDER BY
    similarity DESC
  LIMIT
    match_count;
END;
$$;

-- Finally, create a policy to allow any authenticated user to read from the table
-- This will drop any existing select policies on the table
DROP POLICY IF EXISTS "Allow all authenticated users to view document knowledge" ON public.document_knowledge;
DROP POLICY IF EXISTS "Users can view their own document knowledge" ON public.document_knowledge;

CREATE POLICY "Allow all authenticated users to view document knowledge"
ON public.document_knowledge
FOR SELECT
TO authenticated
USING (true);