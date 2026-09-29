import { NextResponse } from 'next/server'
import { z } from 'zod'
import { findRelatedTurns, isChatMemoryConfigured } from '@/lib/chat-memory'

export const runtime = 'nodejs'

const searchSchema = z.object({
  caseId: z.string().regex(/^CP-[0-9]{3,6}$/),
  query: z.string().trim().min(2).max(1000),
})

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const parsed = searchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'A valid case ID and search query are required.' }, { status: 400 })
  if (!isChatMemoryConfigured()) return NextResponse.json({ error: 'Neon case chat memory is not configured.' }, { status: 503 })

  try {
    const results = await findRelatedTurns(parsed.data.caseId, '', parsed.data.query, { semantic: false })
    return NextResponse.json({
      system: 'Neon case chat memory',
      checkedAt: new Date().toISOString(),
      results: results
        .filter((turn) => turn.role === 'user' || turn.role === 'assistant')
        .map(({ role, content, title, chatId, createdAt }) => ({
          role,
          content,
          record: { title, chatId, savedAt: createdAt },
        })),
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('Live Scout case-memory search failed:', error instanceof Error ? error.message : 'unknown error')
    return NextResponse.json({ error: 'Neon case chat memory could not be searched.' }, { status: 503 })
  }
}
