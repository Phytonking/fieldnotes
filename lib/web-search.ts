// Backed by TinyFish's free Search and Fetch API: https://docs.tinyfish.ai
const SEARCH_URL = 'https://api.search.tinyfish.ai'
const FETCH_URL = 'https://api.fetch.tinyfish.ai'
const PURPOSE = 'On Scene field assistant: public background and public-law lookup for an officer on scene.'
const MAX_FETCH_CHARS = 6000

export type WebSearchResult = {
  position: number
  siteName: string
  title: string
  snippet: string
  url: string
}

export type WebFetchResult = {
  url: string
  finalUrl: string
  title: string
  description: string | null
  text: string
  truncated: boolean
}

export function isWebSearchConfigured() {
  return Boolean(process.env.TINYFISH_API_KEY)
}

export async function searchWeb(query: string): Promise<WebSearchResult[]> {
  const apiKey = process.env.TINYFISH_API_KEY
  if (!apiKey) throw new Error('TINYFISH_API_KEY is not configured.')

  const params = new URLSearchParams({ query, purpose: PURPOSE })
  const response = await fetch(`${SEARCH_URL}?${params.toString()}`, {
    headers: { 'X-API-Key': apiKey },
  })
  if (!response.ok) throw new Error(`Web search failed with HTTP ${response.status}`)

  const data = await response.json()
  const results = Array.isArray(data.results) ? data.results : []
  return results.map((result: Record<string, unknown>) => ({
    position: result.position as number,
    siteName: result.site_name as string,
    title: result.title as string,
    snippet: result.snippet as string,
    url: result.url as string,
  }))
}

export async function fetchWebPage(url: string): Promise<WebFetchResult> {
  const apiKey = process.env.TINYFISH_API_KEY
  if (!apiKey) throw new Error('TINYFISH_API_KEY is not configured.')

  const response = await fetch(FETCH_URL, {
    method: 'POST',
    headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ urls: [url], format: 'markdown', purpose: PURPOSE }),
  })
  if (!response.ok) throw new Error(`Web fetch failed with HTTP ${response.status}`)

  const data = await response.json()
  const [fetchError] = Array.isArray(data.errors) ? data.errors : []
  if (fetchError) throw new Error(`Could not fetch ${url}: ${fetchError.error}`)

  const [result] = Array.isArray(data.results) ? data.results : []
  if (!result) throw new Error(`Web fetch returned no result for ${url}`)

  const text = typeof result.text === 'string' ? result.text : JSON.stringify(result.text ?? '')
  const truncated = text.length > MAX_FETCH_CHARS
  return {
    url: result.url,
    finalUrl: result.final_url,
    title: result.title,
    description: result.description ?? null,
    text: truncated ? `${text.slice(0, MAX_FETCH_CHARS)}…` : text,
    truncated,
  }
}
