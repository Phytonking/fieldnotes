import { defineTool } from 'eve/tools'
import { z } from 'zod'
import { findRelatedTurns, isChatMemoryConfigured } from '@/lib/chat-memory'

export default defineTool({
  description: 'Search prior officer and Scout messages saved under the currently selected case chat. Never use this to search other case IDs. Use a short, specific query and cite the returned chat title when answering.',
  inputSchema: z.object({
    caseId: z.string().regex(/^CP-[0-9]{3,6}$/),
    query: z.string().trim().min(2).max(1000),
  }),
  async execute({ caseId, query }, ctx) {
    const caller = ctx.session.auth.current
    if (!caller) throw new Error('A verified caller is required to search case chat memory.')

    // Local development uses synthetic data. Production callers must carry an
    // authorized case list in their verified Scout session attributes.
    if (caller.principalId !== 'local-dev') {
      const allowedCases = caller.attributes?.caseIds
      if (!Array.isArray(allowedCases) || !allowedCases.includes(caseId)) {
        throw new Error('The verified caller is not authorized for this case chat.')
      }
    }

    if (!isChatMemoryConfigured()) return { status: 'unavailable', message: 'Neon chat memory is not configured.' }

    let notes: Array<{ role: string; content: string; source: { title: string; chatId: string } }>
    try {
      const results = await findRelatedTurns(caseId, '', query)
      notes = results
        .filter((turn) => turn.role === 'user' || turn.role === 'assistant')
        .map(({ role, content, title, chatId }) => ({ role, content, source: { title, chatId } }))
    } catch (error) {
      console.error('Eve case memory search failed:', error)
      return { status: 'unavailable', message: 'Neon case chat memory could not be searched.' }
    }

    return notes.length
      ? { status: 'found', notes }
      : { status: 'not_found', message: 'No matching prior notes were found in this case chat.' }
  },
})
