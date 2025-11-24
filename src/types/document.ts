
export interface DocumentSummary {
  document_name: string;
  chunks: number;
  processed_at: string;
}

export interface DocumentKnowledge {
  id: string;
  document_name: string;
  content_chunk: string;
  similarity: number;
  metadata?: Record<string, unknown>;
}
