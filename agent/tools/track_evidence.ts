import { defineTool } from 'eve/tools'
import { z } from 'zod'
import { trackDemoEvidence } from '@/lib/demo-investigation'

export default defineTool({
  description: 'Search the On Scene demonstration evidence ledger for a physical item or its ledger ID. This is synthetic demo data, not an agency evidence system. Use it for evidence tracking requests and state that the returned records are demo records.',
  inputSchema: z.object({
    caseId: z.string().regex(/^CP-[0-9]{3,6}$/),
    query: z.string().trim().min(2).max(160).optional().describe('Item, location, or status to search for.'),
    evidenceId: z.string().trim().min(3).max(80).optional().describe('Exact evidence-ledger ID when supplied by the officer.'),
  }),
  label: {
    start: ({ caseId }) => `Checking demonstration evidence for ${caseId}`,
    complete: () => 'Demonstration evidence search complete',
  },
  execute({ caseId, query, evidenceId }) {
    return trackDemoEvidence({ caseId, query, id: evidenceId })
  },
})
