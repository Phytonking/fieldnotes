import { defineTool } from 'eve/tools'
import { z } from 'zod'
import { isWebSearchConfigured, fetchWebPage } from '@/lib/web-search'

export default defineTool({
  description:
    'Fetch the readable text of one public web page, typically a URL returned by search_web. Only pass a URL obtained that way or otherwise clearly public. Returns unverified public web content, not legal or agency authority.',
  inputSchema: z.object({
    url: z.string().trim().url(),
  }),
  label: {
    start: ({ url }) => `Fetching ${url}`,
    complete: () => 'Web fetch complete',
  },
  async execute({ url }) {
    if (!isWebSearchConfigured()) return { status: 'unavailable', message: 'Web fetch is not configured.' }

    try {
      const page = await fetchWebPage(url)
      return { status: 'found', page }
    } catch (error) {
      console.error('Eve web fetch failed:', error)
      return { status: 'unavailable', message: 'That page could not be fetched.' }
    }
  },
})
