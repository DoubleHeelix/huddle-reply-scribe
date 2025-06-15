
-- Enable the vector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Create a table to store processed documents
CREATE TABLE public.document_knowledge (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  document_name TEXT NOT NULL,
  document_type TEXT DEFAULT 'pdf',
  content_chunk TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  embedding vector(1536), -- OpenAI embeddings are 1536 dimensions
  metadata JSONB DEFAULT '{}',
  processed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add Row Level Security (RLS)
ALTER TABLE public.document_knowledge ENABLE ROW LEVEL SECURITY;

-- Create policies for users to manage their own document knowledge
CREATE POLICY "Users can view their own document knowledge" 
  ON public.document_knowledge 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own document knowledge" 
  ON public.document_knowledge 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own document knowledge" 
  ON public.document_knowledge 
  FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own document knowledge" 
  ON public.document_knowledge 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- Create indexes for faster searches
CREATE INDEX document_knowledge_user_id_idx ON public.document_knowledge (user_id);
CREATE INDEX document_knowledge_document_name_idx ON public.document_knowledge (document_name);

-- Create a function to search similar document chunks using cosine similarity
CREATE OR REPLACE FUNCTION search_document_knowledge(
  query_embedding vector(1536),
  target_user_id UUID,
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  document_name TEXT,
  content_chunk TEXT,
  similarity float,
  metadata JSONB
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dk.id,
    dk.document_name,
    dk.content_chunk,
    1 - (dk.embedding <=> query_embedding) AS similarity,
    dk.metadata
  FROM public.document_knowledge dk
  WHERE dk.user_id = target_user_id
    AND 1 - (dk.embedding <=> query_embedding) > match_threshold
  ORDER BY dk.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
