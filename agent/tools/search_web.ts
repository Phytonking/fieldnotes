import { defineTool } from 'eve/tools'
import { z } from 'zod'
import { isWebSearchConfigured, searchWeb } from '@/lib/web-search'

export default defineTool({
  description:
    'Search the public web for background information such as statutes, ordinances, or agency policy pages. Never include a case ID, a person\'s name, a precise incident address, or other private case detail in the query. Returns public web content, not verified legal authority or agency policy.',
  inputSchema: z.object({
    query: z.string().trim().min(2).max(300),
  }),
  label: {
    start: ({ query }) => `Searching the web for "${query}"`,
    complete: () => 'Web search complete',
  },
  async execute({ query }) {
    if (!isWebSearchConfigured()) return { status: 'unavailable', message: 'Web search is not configured.' }

    try {
      const results = await searchWeb(query)
      return results.length
        ? { status: 'found', results }
        : { status: 'not_found', message: 'No public web results were found for that query.' }
    } catch (error) {
      console.error('Eve web search failed:', error)
      return { status: 'unavailable', message: 'Web search could not be reached.' }
    }
  },
})
