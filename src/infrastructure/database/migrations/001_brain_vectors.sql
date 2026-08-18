-- Phase 5: Vector RAG for Obsidian Brain
-- Enable the pgvector extension to work with OpenAI embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Table to store project/experience text chunks and their embeddings
CREATE TABLE brain_vectors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  project_id text,
  content text NOT NULL,
  embedding vector(1536), -- text-embedding-3-small uses 1536 dimensions
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create an index to speed up vector similarity search
CREATE INDEX ON brain_vectors USING hnsw (embedding vector_cosine_ops);

-- RLS Policies
ALTER TABLE brain_vectors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own vectors" 
  ON brain_vectors FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read their own vectors" 
  ON brain_vectors FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own vectors" 
  ON brain_vectors FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own vectors" 
  ON brain_vectors FOR DELETE 
  USING (auth.uid() = user_id);
