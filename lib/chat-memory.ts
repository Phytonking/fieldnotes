import { embed, embedMany, gateway } from 'ai'
import { neon } from '@neondatabase/serverless'

export type MemoryTurn = { id: string; role: 'user' | 'assistant' | 'system' | 'tool'; content: string }

function getSql() {
  const databaseUrl = process.env.DATABASE_URL
  return databaseUrl ? neon(databaseUrl) : null
}

export function isChatMemoryConfigured() {
  return Boolean(process.env.DATABASE_URL)
}

function vectorLiteral(vector: number[]) {
  return `[${vector.join(',')}]`
}

export async function persistTurns(input: {
  chatId: string
  title: string
  location: string
  turns: MemoryTurn[]
}) {
  const sql = getSql()
  if (!sql || input.turns.length === 0) return

  await sql`
    INSERT INTO chat_threads (id, title, location)
    VALUES (${input.chatId}, ${input.title}, ${input.location})
    ON CONFLICT (id) DO UPDATE SET
      title = EXCLUDED.title,
      location = EXCLUDED.location,
      updated_at = now()
  `

  const turns = input.turns.slice(-500).filter((turn) => turn.content.trim()).map((turn) => ({
    client_id: turn.id,
    role: turn.role,
    content: turn.content.slice(0, 8000),
  }))
  const inserted = await sql`
    INSERT INTO chat_messages (chat_id, client_id, role, content)
    SELECT ${input.chatId}, rows.client_id, rows.role, rows.content
    FROM jsonb_to_recordset(${JSON.stringify(turns)}::jsonb) AS rows(client_id text, role text, content text)
    ON CONFLICT (chat_id, client_id) DO UPDATE SET
      role = EXCLUDED.role,
      content = EXCLUDED.content
    WHERE chat_messages.role IS DISTINCT FROM EXCLUDED.role
      OR chat_messages.content IS DISTINCT FROM EXCLUDED.content
    RETURNING client_id, content
  `

  if (!inserted.length) return

  try {
    for (let offset = 0; offset < inserted.length; offset += 64) {
      const batch = inserted.slice(offset, offset + 64)
      const { embeddings } = await embedMany({
        model: gateway.embeddingModel('openai/text-embedding-3-small'),
        values: batch.map((row) => row.content as string),
      })
      await sql`
        UPDATE chat_messages AS message
        SET embedding = vector_rows.embedding::vector
        FROM jsonb_to_recordset(${JSON.stringify(batch.map((row, index) => ({
          client_id: row.client_id,
          embedding: vectorLiteral(embeddings[index]),
        })))}::jsonb) AS vector_rows(client_id text, embedding text)
        WHERE message.chat_id = ${input.chatId}
          AND message.client_id = vector_rows.client_id
      `
    }
  } catch {
    console.error('Chat messages saved, but semantic indexing is unavailable.')
  }
}

export async function findRelatedTurns(chatId: string, currentTurnId: string, query: string) {
  const sql = getSql()
  if (!sql || !query.trim()) return []

  let semantic: Array<Record<string, unknown>> = []
  try {
    const { embedding } = await embed({
      model: gateway.embeddingModel('openai/text-embedding-3-small'),
      value: query.slice(0, 8000),
    })
    const vector = vectorLiteral(embedding)
    semantic = await sql`
      SELECT message.client_id, message.role, message.content, message.chat_id, thread.title
      FROM chat_messages AS message
      JOIN chat_threads AS thread ON thread.id = message.chat_id
      WHERE message.chat_id = ${chatId}
        AND message.client_id <> ${currentTurnId}
        AND message.embedding IS NOT NULL
      ORDER BY message.embedding <=> ${vector}::vector
      LIMIT 10
    `
  } catch {
    console.error('Semantic chat search is unavailable; using full-text search.')
  }
  const lexical = await sql`
      SELECT message.client_id, message.role, message.content, message.chat_id, thread.title
      FROM chat_messages AS message
      JOIN chat_threads AS thread ON thread.id = message.chat_id
      WHERE message.chat_id = ${chatId}
        AND message.client_id <> ${currentTurnId}
        AND to_tsvector('english', message.content) @@ websearch_to_tsquery('english', ${query.slice(0, 1000)})
      ORDER BY ts_rank(to_tsvector('english', message.content), websearch_to_tsquery('english', ${query.slice(0, 1000)})) DESC
      LIMIT 10
    `

  const ranked = new Map<string, { role: string; content: string; chatId: string; title: string; score: number }>()
  for (const [results, weight] of [[semantic, 1], [lexical, 1]] as const) {
    results.forEach((row, index) => {
      const id = `${row.chat_id}:${row.client_id}`
      const previous = ranked.get(id)
      ranked.set(id, {
        role: row.role as string,
        content: row.content as string,
        chatId: row.chat_id as string,
        title: row.title as string,
        score: (previous?.score ?? 0) + weight / (60 + index + 1),
      })
    })
  }
  return [...ranked.values()].sort((a, b) => b.score - a.score).slice(0, 5).map((turn) => ({
    ...turn,
    content: turn.content.slice(0, 1200),
  }))
}
