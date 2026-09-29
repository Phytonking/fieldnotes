import { defineTool } from 'eve/tools'
import { z } from 'zod'
import { findDemoBodyCameraFootage } from '@/lib/demo-investigation'

export default defineTool({
  description: 'Search the On Scene demonstration body-worn camera index by officer, location, clip ID, or a short query. It only returns synthetic demo metadata, never video or a claim about unseen footage.',
  inputSchema: z.object({
    caseId: z.string().regex(/^CP-[0-9]{3,6}$/),
    query: z.string().trim().min(2).max(160).optional(),
    officer: z.string().trim().min(2).max(120).optional(),
    clipId: z.string().trim().min(3).max(80).optional(),
  }),
  label: {
    start: ({ caseId }) => `Checking demonstration body-camera footage for ${caseId}`,
    complete: () => 'Demonstration body-camera search complete',
  },
  execute({ caseId, query, officer, clipId }) {
    return findDemoBodyCameraFootage({ caseId, query, officer, id: clipId })
  },
})
