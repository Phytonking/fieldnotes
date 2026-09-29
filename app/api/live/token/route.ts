import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { NextResponse } from 'next/server'
import { z } from 'zod'

export const runtime = 'nodejs'

const callSlipSchema = z.object({
  caseId: z.string().max(80),
  title: z.string().max(160),
  location: z.string().max(160),
  address: z.string().max(240).optional(),
  callTime: z.string().max(80).optional(),
  callType: z.string().max(120).optional(),
})

export async function POST(request: Request) {
  const apiKey = process.env.AI_GATEWAY_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'AI Gateway is not configured.' }, { status: 503 })

  const body = await request.json().catch(() => null)
  const parsed = callSlipSchema.safeParse(body?.callSlip)
  if (!parsed.success) return NextResponse.json({ error: 'A valid call slip is required.' }, { status: 400 })

  try {
    const systemPrompt = await readFile(join(process.cwd(), 'agent/instructions.md'), 'utf8')
    const { caseId, title, location, address, callTime, callType } = parsed.data
    const instructions = `${systemPrompt}\n\n# Current call slip\n- Case/chat ID: ${caseId}\n- Call title: ${title}\n- Location: ${location}\n- Address: ${address || 'not supplied by the connected app'}\n- Call time: ${callTime || 'not supplied by the connected app'}\n- Call type: ${callType || 'not supplied by the connected app'}\n\nTreat only supplied fields as facts. The current workspace contains demonstration case labels, not an authenticated dispatch call slip.`

    const response = await fetch('https://ai-gateway.vercel.sh/v1/realtime/client-secrets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: 'openai/gpt-live-1', routeKind: 'live' }),
      signal: AbortSignal.timeout(10_000),
      cache: 'no-store',
    })

    if (!response.ok) {
      console.error('AI Gateway could not create a GPT-Live session:', response.status)
      return NextResponse.json({ error: 'GPT-Live is not available for this AI Gateway account.' }, { status: 502 })
    }

    const token = await response.json() as { token?: unknown; expiresAt?: unknown }
    if (typeof token.token !== 'string' || typeof token.expiresAt !== 'number') {
      return NextResponse.json({ error: 'AI Gateway returned an invalid live-session token.' }, { status: 502 })
    }

    return NextResponse.json({ ...token, instructions }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('GPT-Live session setup failed:', error instanceof Error ? error.message : 'unknown error')
    return NextResponse.json({ error: 'Could not start GPT-Live.' }, { status: 502 })
  }
}
