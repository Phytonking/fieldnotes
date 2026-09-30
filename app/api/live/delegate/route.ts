import { NextResponse } from 'next/server'
import { z } from 'zod'
import { Client } from 'eve/client'

export const runtime = 'nodejs'

const delegateSchema = z.object({
  caseId: z.string().max(80),
  delegationId: z.string().min(1),
  question: z.string().trim().min(1).max(2000),
  sessionId: z.string().min(1).optional(),
})

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const parsed = delegateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'A caseId, delegationId, and question are required.' }, { status: 400 })
  const { caseId, question, sessionId: existingSessionId } = parsed.data

  const client = new Client({ host: new URL(request.url).origin })
  const clientContext = { caseId, mode: 'live voice delegation, keep the reply speakable in one or two sentences' }

  try {
    const { sessionId, result } = existingSessionId
      ? await (async () => {
          const response = await client.sessions.attach(existingSessionId).send(question, { clientContext })
          return { sessionId: existingSessionId, result: await response.result() }
        })()
      : await (async () => {
          const { response } = await client.sessions.create({ message: question, clientContext })
          return { sessionId: response.sessionId, result: await response.result() }
        })()

    if (result.status === 'failed') return NextResponse.json({ error: 'Eve could not complete the delegated turn.' }, { status: 502 })
    return NextResponse.json({ sessionId, text: result.message ?? '' }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('Live voice delegation to Eve failed:', error instanceof Error ? error.message : 'unknown error')
    return NextResponse.json({ error: 'Could not reach Eve for the delegated turn.' }, { status: 502 })
  }
}
