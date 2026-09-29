CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS chat_threads (
  id text PRIMARY KEY,
  title text NOT NULL,
  location text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chat_messages (
  chat_id text NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
  client_id text NOT NULL,
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
  content text NOT NULL,
  embedding vector(1536),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (chat_id, client_id)
);

CREATE INDEX IF NOT EXISTS chat_messages_chat_time_idx
  ON chat_messages (chat_id, created_at DESC);

CREATE INDEX IF NOT EXISTS chat_messages_search_idx
  ON chat_messages USING gin (to_tsvector('english', content));

CREATE INDEX IF NOT EXISTS chat_messages_embedding_idx
  ON chat_messages USING hnsw (embedding vector_cosine_ops)
  WHERE embedding IS NOT NULL;
