import { NextResponse } from 'next/server'
import { persistTurns, type MemoryTurn } from '@/lib/chat-memory'

type Entry = {
  id?: number
  memoryId?: string
  kind?: string
  text?: string
  detail?: string
  transcript?: string
  duration?: string
}

type Chat = { id?: string; title?: string; location?: string; logs?: Entry[] }

export async function POST(request: Request) {
  if (!process.env.DATABASE_URL) return new Response(null, { status: 204 })

  let body: { chats?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid chat sync request.' }, { status: 400 })
  }

  if (!Array.isArray(body.chats) || body.chats.length > 200) {
    return NextResponse.json({ error: 'Expected up to 200 chats.' }, { status: 400 })
  }

  try {
    for (const value of body.chats) {
      if (!value || typeof value !== 'object') continue
      const chat = value as Chat
      if (typeof chat.id !== 'string' || !chat.id) continue
      const turns: MemoryTurn[] = (chat.logs ?? []).slice(-500).flatMap((entry, index) => {
        if (!entry || typeof entry !== 'object' || entry.duration === 'live' || entry.duration === '…') return []
        const role = entry.kind === 'officer' ? 'user' : entry.kind === 'assistant' ? 'assistant' : entry.kind === 'tool' ? 'tool' : 'system'
        const content = [entry.transcript, entry.text, entry.detail].filter((part) => typeof part === 'string' && part.trim()).join('\n')
        if (!content) return []
        return [{
          id: (entry.memoryId || `${chat.id}:entry:${entry.id ?? index}`).slice(0, 160),
          role,
          content: content.slice(0, 8000),
        }]
      })

      await persistTurns({
        chatId: chat.id.slice(0, 80),
        title: String(chat.title || 'Untitled chat').slice(0, 160),
        location: String(chat.location || '').slice(0, 160),
        turns,
      })
    }
    return NextResponse.json({ saved: true })
  } catch (error) {
    console.error('Chat history sync failed:', error)
    return NextResponse.json({ error: 'Could not sync chat history. Check DATABASE_URL and apply the chat memory migration.' }, { status: 503 })
  }
}
