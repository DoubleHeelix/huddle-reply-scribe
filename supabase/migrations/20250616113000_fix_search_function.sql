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