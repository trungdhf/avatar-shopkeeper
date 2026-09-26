import { screenAddress } from './intercepta'

// Vercel serverless function. Typed against the shape Vercel actually passes
// rather than pulling in @vercel/node just for two interfaces.
type Req = { method?: string; query?: Record<string, string | string[] | undefined>; url?: string }
type Res = {
  statusCode: number
  setHeader: (name: string, value: string) => void
  end: (body?: string) => void
}

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)

export default async function handler(request: Req, response: Res) {
  response.setHeader('Content-Type', 'application/json')
  response.setHeader('Cache-Control', 'no-store')

  if (request.method && request.method !== 'GET') {
    response.statusCode = 405
    response.end(JSON.stringify({ state: 'error', reason: 'Use GET' }))
    return
  }

  const address = first(request.query?.address)
    ?? new URL(request.url ?? '', 'http://localhost').searchParams.get('address')
    ?? ''

  const result = await screenAddress(address, process.env.INTERCEPTA_API_KEY)
  response.statusCode = result.state === 'error' ? 502 : 200
  response.end(JSON.stringify(result))
}
