// Intercepta / Web3 Antivirus address screening.
//
// Runs server side only. The key lives in INTERCEPTA_API_KEY, deliberately
// without a VITE_ prefix: Vite inlines the value of every VITE_ variable into
// the published bundle, so a key named that way would be readable by anyone who
// opens the page.
//
// https://docs.web3antivirus.io/reference/quick-scan-address

const BASE = 'https://api.web3antivirus.io'
const PATH = (address: string) => `/api/public/v2/extension/account/${address}/quick-scan`

// Traits that should stop a payment rather than merely warn about it. The docs
// list fifteen trait names; these are the unambiguous ones. toxicScore is left
// out of this decision on purpose, because its scale is not documented in the
// reference page, so it is reported rather than thresholded.
const BLOCKING = new Set(['sanction_address', 'known_scammer', 'blacklist'])

export type Flag = { name: string; risk: number; description: string; txsCount: number }

export type Screening =
  | { state: 'skipped'; reason: string }
  | { state: 'ok'; address: string; score: number | null; flags: Flag[]; blocked: boolean }
  | { state: 'error'; reason: string }

type QuickScan = {
  toxicScore?: number
  traits?: { risk?: number; name?: string; txsCount?: number; description?: string }[]
}

const isAddress = (value: string) => /^0x[0-9a-fA-F]{40}$/.test(value)

export async function screenAddress(address: string, key: string | undefined): Promise<Screening> {
  if (!key) return { state: 'skipped', reason: 'INTERCEPTA_API_KEY is not set' }
  if (!isAddress(address)) return { state: 'error', reason: 'Not a 20 byte hex address' }

  let response: Response
  try {
    response = await fetch(`${BASE}${PATH(address)}`, {
      headers: { 'X-API-KEY': key, Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    })
  } catch (error) {
    return { state: 'error', reason: error instanceof Error ? error.message : 'Request failed' }
  }

  if (!response.ok) {
    return { state: 'error', reason: `Screening API returned HTTP ${response.status}` }
  }

  let body: QuickScan
  try {
    body = (await response.json()) as QuickScan
  } catch {
    return { state: 'error', reason: 'Screening API returned a body that is not JSON' }
  }

  const flags: Flag[] = (body.traits ?? [])
    .filter((trait) => typeof trait.name === 'string')
    .map((trait) => ({
      name: trait.name as string,
      risk: typeof trait.risk === 'number' ? trait.risk : 0,
      description: trait.description ?? '',
      txsCount: typeof trait.txsCount === 'number' ? trait.txsCount : 0,
    }))

  return {
    state: 'ok',
    address,
    score: typeof body.toxicScore === 'number' ? body.toxicScore : null,
    flags,
    blocked: flags.some((flag) => BLOCKING.has(flag.name)),
  }
}
