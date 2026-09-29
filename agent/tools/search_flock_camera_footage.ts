import { defineTool } from 'eve/tools'
import { z } from 'zod'
import { findDemoFlockCameraFootage } from '@/lib/demo-investigation'

export default defineTool({
  description: 'Search the On Scene demonstration Flock camera index by camera, location, clip ID, or a short query. It only returns synthetic demo metadata and observations; it cannot identify people or establish a vehicle match.',
  inputSchema: z.object({
    caseId: z.string().regex(/^CP-[0-9]{3,6}$/),
    query: z.string().trim().min(2).max(160).optional(),
    location: z.string().trim().min(2).max(160).optional(),
    clipId: z.string().trim().min(3).max(80).optional(),
  }),
  label: {
    start: ({ caseId }) => `Checking demonstration Flock footage for ${caseId}`,
    complete: () => 'Demonstration Flock-camera search complete',
  },
  execute({ caseId, query, location, clipId }) {
    return findDemoFlockCameraFootage({ caseId, query, location, id: clipId })
  },
})
