import { useEffect, useState } from 'react'
import { createWalletClient, custom, formatEther, isAddress, type Address, type Hash } from 'viem'
import { sepolia } from 'viem/chains'
import Avatar, { say, speech, type ShelfItem, type Sku } from './Avatar'
// Type only: erased at build time, so no server code reaches the bundle.
import type { Screening } from '../api/screen'
import { publicClient, shopAbi, storeAddress } from './shop'

const colors = [
  { name: 'Sakura', hex: '#e89281' },
  { name: 'Midnight', hex: '#607a9c' },
  { name: 'Honey', hex: '#deb261' },
]

const answers = [
  { question: 'Will it fit?', reply: 'Made for Mochi! Try it on and watch the hat follow my moves.' },
  { question: 'What do I get?', reply: 'One onchain unlock for your wallet. All three hat colors are yours to wear here.' },
  { question: 'Which network?', reply: 'Checkout is on Ethereum Sepolia. You will need a little Sepolia ETH for each accessory and gas.' },
]

type Product = 'hat' | 'glasses'

function walletClient() {
  if (!window.ethereum) throw new Error('Install an Ethereum wallet to check out.')
  return createWalletClient({ chain: sepolia, transport: custom(window.ethereum) })
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message.split('\n')[0] : 'Something went wrong. Please try again.'
}

function isUnknownChain(error: unknown) {
  for (let level: unknown = error, depth = 0; level && depth < 3; depth += 1) {
    if ((level as { code?: unknown }).code === 4902) return true
    level = (level as { cause?: unknown }).cause
  }
  return /unrecognized chain|unsupported chain|chain .*not been added/i.test(String(error))
}

async function switchToSepolia(client: ReturnType<typeof walletClient>) {
  try {
    await client.switchChain({ id: sepolia.id })
  } catch (error) {
    if (!isUnknownChain(error)) throw error
    await client.addChain({ chain: sepolia })
    await client.switchChain({ id: sepolia.id })
  }
}

// One Intercepta verdict, shown in the checkout before anything is signed.
function ScreenRow({ label, address, result }: { label: string; address?: Address; result: Screening | null }) {
  const blocked = result?.state === 'ok' && result.blocked
  return (
    <>
      <div className={`screen-row${blocked ? ' blocked' : ''}`}>
        <span className="price-label">{label} · INTERCEPTA SCREENING</span>
        {!address && <span>Connect a wallet to screen it</span>}
        {address && result === null && <span>Checking {address.slice(0, 6)}…{address.slice(-4)}...</span>}
        {result?.state === 'skipped' && <span>Not configured</span>}
        {result?.state === 'error' && <span>Unavailable: {result.reason}</span>}
        {result?.state === 'ok' && (
          <span>
            {blocked ? 'Flagged, payment held' : 'No blocking flags'}
            {result.score !== null ? ` - risk score ${result.score}` : ''}
            {result.score === 0 && result.flags.length === 0 ? ', no mainnet history on this address' : ''}
          </span>
        )}
      </div>
      {result?.state === 'ok' && result.flags.length > 0 && (
        <ul className="cart-list screen-flags">
          {result.flags.map((flag) => (
            <li key={flag.name} title={flag.description}><span>{flag.name.replace(/_/g, ' ')}</span><span>risk {flag.risk}</span></li>
          ))}
        </ul>
      )}
    </>
  )
}

export default function App() {
  const [color] = useState(colors[0])
  const [preview, setPreview] = useState(true)
  const [account, setAccount] = useState<Address>()
  const [chainId, setChainId] = useState<number>()
  const [owned, setOwned] = useState(false)
  const [price, setPrice] = useState<bigint>()
  const [glassesPreview, setGlassesPreview] = useState(false)
  const [glassesOwned, setGlassesOwned] = useState(false)
  const [glassesPrice, setGlassesPrice] = useState<bigint>()
  const [busy, setBusy] = useState<Product | null>(null)
  const [txHash, setTxHash] = useState<Hash>()
  const [notice, setNotice] = useState('')
  const [motionRequest, setMotionRequest] = useState<{ files: File[]; id: number; loop?: boolean } | null>(null)
  const [motionStatus, setMotionStatus] = useState('')
  const [answer, setAnswer] = useState(speech.line)
  const [selected, setSelected] = useState<ShelfItem | null>(null)
  const [cart, setCart] = useState<Sku[]>([])
  const [checkingOut, setCheckingOut] = useState(false)
  const [cartOpen, setCartOpen] = useState(false)
  const [screening, setScreening] = useState<Screening | null>(null)
  // Gifting needs the version 2 contract; the first deployment has no VERSION.
  const [giftsEnabled, setGiftsEnabled] = useState(false)
  const [giftTo, setGiftTo] = useState('')
  const [recipientScreening, setRecipientScreening] = useState<Screening | null>(null)

  // Development only recording aid: chain local VRoid motions as the idle loop.
  // DEV gates it and /dev-motions exists only under the dev server, so a build
  // cannot request these files and falls back to the bundled MIT idle clip.
  useEffect(() => {
    if (!import.meta.env.DEV) return
    const names = String(import.meta.env.VITE_IDLE_CHAIN ?? '')
      .split(',')
      .map((name) => name.trim())
      .filter((name) => name.length > 0)
    if (names.length === 0) return
    let alive = true
    void (async () => {
      try {
        const files = await Promise.all(names.map(async (name) => {
          const response = await fetch(`/dev-motions/${encodeURIComponent(name)}`)
          if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`)
          return new File([await response.blob()], name, { type: 'model/gltf-binary' })
        }))
        if (alive) setMotionRequest({ files, id: Date.now(), loop: true })
      } catch {
        // No local pack: the bundled idle clip keeps playing.
      }
    })()
    return () => { alive = false }
  }, [])

  useEffect(() => {
    say()
    let frame = 0
    let shown = -1
    const reveal = () => {
      if (speech.visible !== shown) {
        shown = speech.visible
        setAnswer(speech.line.slice(0, shown))
      }
      frame = requestAnimationFrame(reveal)
    }
    frame = requestAnimationFrame(reveal)
    return () => cancelAnimationFrame(frame)
  }, [])

  useEffect(() => {
    if (!window.ethereum) return
    const provider = window.ethereum
    const onAccountsChanged = (accounts: Address[]) => {
      setAccount(accounts[0])
      setOwned(false)
      setGlassesOwned(false)
    }
    const onChainChanged = (id: string) => setChainId(Number(id))
    provider.on('accountsChanged', onAccountsChanged)
    provider.on('chainChanged', onChainChanged)
    void walletClient().getAddresses().then(onAccountsChanged).catch(() => {})
    void walletClient().getChainId().then(setChainId).catch(() => {})
    return () => {
      provider.removeListener('accountsChanged', onAccountsChanged)
      provider.removeListener('chainChanged', onChainChanged)
    }
  }, [])

  useEffect(() => {
    if (!storeAddress) return
    let active = true
    void publicClient.readContract({ address: storeAddress, abi: shopAbi, functionName: 'PRICE' })
      .then((value) => { if (active) setPrice(value) })
      .catch((error: unknown) => { if (active) setNotice(`Cannot read the store: ${errorMessage(error)}`) })
    void publicClient.readContract({ address: storeAddress, abi: shopAbi, functionName: 'VERSION' })
      .then((value) => { if (active) setGiftsEnabled(value >= 2n) })
      .catch(() => { if (active) setGiftsEnabled(false) })
    void publicClient.readContract({ address: storeAddress, abi: shopAbi, functionName: 'GLASSES_PRICE' })
      .then((value) => { if (active) setGlassesPrice(value) })
      .catch((error: unknown) => { if (active) setNotice(`Cannot read the store: ${errorMessage(error)}`) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!account || !storeAddress) return
    let active = true
    void publicClient.readContract({ address: storeAddress, abi: shopAbi, functionName: 'hasHat', args: [account] })
      .then((value) => { if (active) setOwned(value) })
      .catch((error: unknown) => { if (active) setNotice(`Cannot check ownership: ${errorMessage(error)}`) })
    void publicClient.readContract({ address: storeAddress, abi: shopAbi, functionName: 'hasGlasses', args: [account] })
      .then((value) => { if (active) setGlassesOwned(value) })
      .catch((error: unknown) => { if (active) setNotice(`Cannot check ownership: ${errorMessage(error)}`) })
    return () => { active = false }
  }, [account])

  async function connect() {
    try {
      setNotice('')
      const client = walletClient()
      const [address] = await client.requestAddresses()
      setAccount(address)
      const network = await client.getChainId()
      setChainId(network)
      if (network !== sepolia.id) {
        await switchToSepolia(client)
        setChainId(sepolia.id)
      }
    } catch (error) {
      setNotice(errorMessage(error))
    }
  }

  // Screen the paying wallet before it is asked to sign. The wallet is screened
  // rather than the shop contract because the provider indexes Ethereum mainnet:
  // an address is the same on every chain, so a buyer's mainnet history is real
  // signal, while a contract deployed only on Sepolia always comes back empty and
  // would make this a gate that can never close.
  // The key stays server side, so this calls our own route, not the vendor.
  useEffect(() => {
    if (!checkingOut || !account) return
    let alive = true
    setScreening(null)
    void fetch(`/api/screen?address=${account}`)
      .then((response) => response.json() as Promise<Screening>)
      .then((result) => { if (alive) setScreening(result) })
      .catch(() => { if (alive) setScreening({ state: 'error', reason: 'Screening route unreachable' }) })
    return () => { alive = false }
  }, [checkingOut, account])

  // A gift recipient is where the value lands, so it is screened too, and it is
  // the check most likely to bite: anyone can type any address into the field.
  const giftText = giftTo.trim()
  const recipient = giftsEnabled && isAddress(giftText) ? giftText as Address : undefined
  const giftInvalid = giftsEnabled && giftText.length > 0 && !recipient
  useEffect(() => {
    setRecipientScreening(null)
    if (!checkingOut || !recipient) return
    let alive = true
    void fetch(`/api/screen?address=${recipient}`)
      .then((response) => response.json() as Promise<Screening>)
      .then((result) => { if (alive) setRecipientScreening(result) })
      .catch(() => { if (alive) setRecipientScreening({ state: 'error', reason: 'Screening route unreachable' }) })
    return () => { alive = false }
  }, [checkingOut, recipient])

  const payerBlocked = screening?.state === 'ok' && screening.blocked
  const recipientBlocked = recipientScreening?.state === 'ok' && recipientScreening.blocked
  const screenBlocked = payerBlocked || recipientBlocked
  // Nothing is signed until every screen that applies has answered.
  const screenPending = (account !== undefined && screening === null) || (recipient !== undefined && recipientScreening === null)
  const heldReason = payerBlocked
    ? 'Held: paying wallet flagged'
    : recipientBlocked ? 'Held: gift recipient flagged' : ''

  const skuPrice = (sku: Sku) => (sku === 'hat' ? price : glassesPrice)
  const skuLabel = (sku: Sku) => (sku === 'hat' ? 'Tokyo Cowboy hat' : 'Shibuya Shades')
  const skuOwned = (sku: Sku) => (sku === 'hat' ? owned : glassesOwned)
  const cartTotal = cart.reduce((sum, sku) => sum + (skuPrice(sku) ?? 0n), 0n)

  function addToCart(sku: Sku) {
    setCart((current) => (current.includes(sku) ? current : [...current, sku]))
    setCartOpen(true)
  }

  // One transaction per item, because the deployed contract exposes
  // purchaseHat and purchaseGlasses separately and has no batch entry point.
  // Ownership is re-read from chain each round so a stale flag cannot make the
  // second call revert with Already owned.
  async function checkout() {
    if (!account) {
      await connect()
      return
    }
    if (!storeAddress) {
      setNotice('Checkout is not live yet. Set a deployed Sepolia store address first.')
      return
    }
    if (giftInvalid) {
      setNotice('The gift address is not a valid 0x address.')
      return
    }
    if (screenBlocked || screenPending) return
    const to = recipient
    const holder = to ?? account
    for (const sku of [...cart]) {
      const already = await publicClient.readContract({
        address: storeAddress,
        abi: shopAbi,
        functionName: sku === 'hat' ? 'hasHat' : 'hasGlasses',
        args: [holder],
      })
      if (already) {
        setCart((current) => current.filter((item) => item !== sku))
        continue
      }
      const done = await purchase(sku, to)
      if (!done) return
      setCart((current) => current.filter((item) => item !== sku))
    }
    setCheckingOut(false)
    if (to) setGiftTo('')
  }

  async function purchase(product: Product, to?: Address): Promise<boolean> {
    if (!account) {
      await connect()
      return false
    }
    const value = product === 'hat' ? price : glassesPrice
    if (!storeAddress || value === undefined) {
      setNotice('Checkout is not live yet. Set a deployed Sepolia store address first.')
      return false
    }
    try {
      setBusy(product)
      setTxHash(undefined)
      setNotice('Confirm the purchase in your wallet…')
      const client = walletClient()
      if (await client.getChainId() !== sepolia.id) {
        await switchToSepolia(client)
        setChainId(sepolia.id)
      }
      const hash = to
        ? await client.writeContract({
          address: storeAddress,
          abi: shopAbi,
          functionName: product === 'hat' ? 'purchaseHatFor' : 'purchaseGlassesFor',
          args: [to],
          account,
          chain: sepolia,
          value,
        })
        : await client.writeContract({
          address: storeAddress,
          abi: shopAbi,
          functionName: product === 'hat' ? 'purchaseHat' : 'purchaseGlasses',
          account,
          chain: sepolia,
          value,
        })
      setTxHash(hash)
      setNotice('Transaction sent. Waiting for Sepolia confirmation…')
      // An unbounded wait here left the cart stuck on Processing: the public RPC
      // rate-limits, the poll never resolved, so the finally block that clears
      // busy was never reached even though the transaction had landed. Bound the
      // wait, then ask the contract who owns what, which is the real answer.
      let confirmed = false
      try {
        const receipt = await publicClient.waitForTransactionReceipt({
          hash,
          timeout: 60_000,
          pollingInterval: 2_000,
        })
        confirmed = receipt.status === 'success'
      } catch {
        setNotice('Confirmation is slow on this RPC. Checking ownership onchain instead...')
        confirmed = await publicClient.readContract({
          address: storeAddress,
          abi: shopAbi,
          functionName: product === 'hat' ? 'hasHat' : 'hasGlasses',
          args: [to ?? account],
        })
      }
      if (!confirmed) {
        throw new Error('Sepolia has not confirmed this yet. Open the transaction link, then reload the page.')
      }
      const item = product === 'hat' ? 'hat' : 'shades'
      if (to) {
        setNotice(`Gift sent: the ${item} unlock now belongs to ${to.slice(0, 6)}…${to.slice(-4)}.`)
        say(`What a nice gift! The ${item} are wrapped and on their way on Sepolia.`.replace('hat are', 'hat is'))
        return true
      }
      const [currentAccount] = await client.getAddresses()
      if (currentAccount?.toLowerCase() === account.toLowerCase()) {
        if (product === 'hat') {
          setOwned(true)
          setPreview(true)
        } else {
          setGlassesOwned(true)
          setGlassesPreview(true)
        }
      }
      setNotice(`The ${item} ${product === 'hat' ? 'is' : 'are'} yours! Now equipped on Mochi.`)
      say(`Looking good! Your wallet now holds the ${item} unlock on Sepolia.`)
      return true
    } catch (error) {
      setNotice(errorMessage(error))
      return false
    } finally {
      setBusy(null)
    }
  }

  const selectedSku = selected?.sku

  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href="#home" aria-label="Mochi Mart home"><span className="brand-mark">m<span>✳</span></span><span>mochi<span className="brand-light">mart</span></span></a>
        <nav aria-label="Main navigation"><a className="nav-active" href="#shop">The shop</a><a href="#how-it-works">How it works</a></nav>
        <div className="header-actions">
          <button className="wallet-button" type="button" onClick={() => void connect()}>
            <span className="wallet-dot" />{account ? `${account.slice(0, 6)}…${account.slice(-4)}` : 'Connect wallet'}
          </button>
          <button
            className={`cart-button${cart.length > 0 ? ' has-items' : ''}`}
            type="button"
            aria-expanded={cartOpen}
            onClick={() => setCartOpen((current) => !current)}
          >
            Cart{cart.length > 0 ? <span className="cart-count">{cart.length}</span> : null}
          </button>

          {cartOpen && (
            <div className="cart-drawer" role="dialog" aria-label="Cart">
              {cart.length === 0 && (
                <p className="item-menu-note">Nothing in the cart yet. Click the cowboy hat or the shades on the shelf, then add them here. Every other style is try-on only.</p>
              )}

              {cart.length > 0 && !checkingOut && (
                <>
                  <ul className="cart-list">
                    {cart.map((sku) => (
                      <li key={sku}>
                        <span>{skuLabel(sku)}</span>
                        <button type="button" className="cart-remove" onClick={() => setCart((current) => current.filter((item) => item !== sku))}>remove</button>
                      </li>
                    ))}
                  </ul>
                  <button className="buy-button" type="button" onClick={() => setCheckingOut(true)}>Checkout {cart.length} item{cart.length > 1 ? 's' : ''}</button>
                </>
              )}

              {/* Totals appear only after checkout is opened. */}
              {checkingOut && (
                <div className="pay-area">
                  <div className="price-row"><span className="price-label">PAYMENT</span><span className="network-badge"><span /> SEPOLIA</span></div>
                  <ul className="cart-list">
                    {cart.map((sku) => (
                      <li key={sku}>
                        <span>{skuLabel(sku)}{skuOwned(sku) ? ' - owned' : ''}</span>
                        <span>{skuPrice(sku) === undefined ? '0.0001 ETH' : `${formatEther(skuPrice(sku) as bigint)} ETH`}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="price-row"><div><span className="price-label">TOTAL</span><strong>{formatEther(cartTotal)} ETH</strong></div></div>
                  <p className="item-menu-note">{cart.length} transaction{cart.length > 1 ? 's' : ''}: the contract sells each item through its own function, so the wallet prompts once per item.</p>

                  {giftsEnabled && (
                    <label className="gift-field">
                      <span className="price-label">GIFT TO (OPTIONAL)</span>
                      <input
                        type="text"
                        inputMode="text"
                        spellCheck={false}
                        placeholder="0x… leave empty to buy for yourself"
                        value={giftTo}
                        disabled={busy !== null}
                        onChange={(event) => setGiftTo(event.target.value)}
                      />
                      {giftInvalid && <span className="gift-error">Not a valid 0x address</span>}
                    </label>
                  )}

                  <ScreenRow label="PAYING WALLET" address={account} result={screening} />
                  {recipient && <ScreenRow label="GIFT RECIPIENT" address={recipient} result={recipientScreening} />}

                  <button className="buy-button" type="button" disabled={busy !== null || cart.length === 0 || screenBlocked || screenPending || giftInvalid} onClick={() => void checkout()}>{busy !== null ? 'Processing...' : screenBlocked ? heldReason : screenPending ? 'Screening with Intercepta...' : !account ? 'Connect wallet to pay' : recipient ? `Gift for ${formatEther(cartTotal)} ETH` : `Pay ${formatEther(cartTotal)} ETH`}</button>
                  {busy !== null
                    ? <button className="cart-remove" type="button" onClick={() => setBusy(null)}>Stop waiting</button>
                    : <button className="preview-button" type="button" onClick={() => setCheckingOut(false)}>Back</button>}
                </div>
              )}

              {!storeAddress && <p className="setup-note">Checkout opens after a Sepolia contract is configured.</p>}
              {chainId !== undefined && chainId !== sepolia.id && <p className="setup-note">Switch your wallet to Sepolia to check out.</p>}
              {notice && <p role="status" className="notice">{notice}</p>}
              {txHash && <a className="transaction-link" href={`https://sepolia.etherscan.io/tx/${txHash}`} target="_blank" rel="noreferrer">View transaction on Sepolia</a>}
            </div>
          )}
        </div>
      </header>

      <main id="home">
        <section className="shop-grid" id="shop" aria-label="Avatar shop">
          <div className={`avatar-panel${motionStatus.startsWith('Playing') ? ' motion-playing' : ''}`}>
            <div className="stage-label"><span><span className="stage-pulse" /> LIVE TRY-ON</span><span className="stage-count">12 TO TRY · 2 FOR SALE</span></div>
            <Avatar hatColor={color.hex} wearing={preview} wearingGlasses={glassesPreview} motionRequest={motionRequest} onMotionStatus={setMotionStatus} onSelect={setSelected} />
            <div className="stage-bottom">
              <span>✦ &nbsp; Say hi to Mochi</span>
              <label className="stage-motion" htmlFor="motion-upload">Play a VRoid motion (.vrma)</label>
              <input id="motion-upload" className="motion-file" type="file" accept=".vrma" multiple aria-label="Choose one or more VRoid motion files" onChange={(event) => {
                const files = Array.from(event.target.files ?? []).sort((a, b) => a.name.localeCompare(b.name))
                if (files.length) setMotionRequest({ files, id: Date.now() })
                event.target.value = ''
              }} />
            </div>
            {motionStatus && <p role="status" className="stage-status">{motionStatus}</p>}
            <div className="speech-bubble"><span className="sparkle">✳</span> {answer}</div>
            {selected && (
              <div
                className="item-menu"
                style={{
                  left: Math.min(Math.max(120, selected.screen.x), window.innerWidth - 130),
                  top: Math.max(96, selected.screen.y - 14),
                }}
              >
                <div className="item-menu-top">
                  <strong>{selected.label}</strong>
                  <button type="button" aria-label="Close" onClick={() => setSelected(null)}>&#215;</button>
                </div>
                {selectedSku === undefined && (
                  <p className="item-menu-note">Try-on only. The onchain shop sells the Tokyo Cowboy hat and the Shibuya Shades.</p>
                )}
                {selectedSku !== undefined && skuOwned(selectedSku) && (
                  <p className="item-menu-note">Already unlocked by this wallet.</p>
                )}
                {selectedSku !== undefined && !skuOwned(selectedSku) && (
                  <>
                    <p className="item-menu-price">{skuPrice(selectedSku) === undefined ? '0.0001 ETH' : `${formatEther(skuPrice(selectedSku) as bigint)} ETH`}</p>
                    <button type="button" disabled={cart.includes(selectedSku)} onClick={() => { addToCart(selectedSku); setSelected(null) }}>
                      {cart.includes(selectedSku) ? 'In the cart' : 'Add to cart'}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

        </section>

        <section className="conversation" aria-label="Ask Mochi"><div><span className="conversation-icon">✳</span><div><strong>Ask Mochi anything</strong><p>Your shopkeeper has the answers.</p></div></div><div className="question-list">{answers.map((item) => <button type="button" key={item.question} onClick={() => say(item.reply)}>{item.question} <span>↗</span></button>)}</div></section>
        <section className="how" id="how-it-works"><span className="section-caption">THE MOCHI WAY</span><h2>Little things. Big personality.</h2><div className="steps"><div><span>01</span><strong>Meet Mochi</strong><p>A friendly face, a new look, and a tiny store built around your avatar.</p></div><div><span>02</span><strong>Try the whole shelf</strong><p>Click any hat, pair of shades or tee on the shelf to try it on. Six hat shapes to play with, no wallet needed.</p></div><div><span>03</span><strong>Make it yours</strong><p>Unlock the hat on Sepolia and equip it whenever you return with your wallet.</p></div></div></section>
      </main>
      <footer><span>MOCHI MART © 2026</span><span>MADE WITH ♥ FOR ETHGLOBAL TOKYO</span><a href="https://sepolia.etherscan.io/" target="_blank" rel="noreferrer">EXPLORE SEPOLIA ↗</a></footer>
    </div>
  )
}
