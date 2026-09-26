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
// list fifteen names; these three are the unambiguous ones.
//
// toxicScore is reported, never thresholded. Probing the live API showed it is a
// float on an undocumented scale, and that low values are ordinary: a long-lived
// mainnet wallet scored 0.04 purely from non_kyc_transfers, a trait most active
// addresses carry. Blocking on a number would stop honest buyers, so the decision
// stays on these names.
//
// The index covers Ethereum mainnet. An address with no mainnet history scores 0
// with no traits, which means absent rather than cleared, so callers should screen
// something that has mainnet history to learn anything: a buyer's wallet, not a
// freshly deployed testnet contract.
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
