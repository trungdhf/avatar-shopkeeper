import { useEffect, useState } from 'react'
import { createWalletClient, custom, formatEther, type Address, type Hash } from 'viem'
import { sepolia } from 'viem/chains'
import Avatar from './Avatar'
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

export default function App() {
  const [color, setColor] = useState(colors[0])
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
  const [motionRequest, setMotionRequest] = useState<{ files: File[]; id: number } | null>(null)
  const [motionStatus, setMotionStatus] = useState('')
  const [answer, setAnswer] = useState('Hi! I’m Mochi. Pick a color and try on my Tokyo cowboy hat.')

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
        await client.switchChain({ id: sepolia.id })
        setChainId(sepolia.id)
      }
    } catch (error) {
      setNotice(errorMessage(error))
    }
  }

  async function purchase(product: Product) {
    if (!account) {
      await connect()
      return
    }
    const value = product === 'hat' ? price : glassesPrice
    if (!storeAddress || value === undefined) {
      setNotice('Checkout is not live yet. Set a deployed Sepolia store address first.')
      return
    }
    try {
      setBusy(product)
      setTxHash(undefined)
      setNotice('Confirm the purchase in your wallet…')
      const client = walletClient()
      if (await client.getChainId() !== sepolia.id) {
        await client.switchChain({ id: sepolia.id })
        setChainId(sepolia.id)
      }
      const hash = await client.writeContract({
        address: storeAddress,
        abi: shopAbi,
        functionName: product === 'hat' ? 'purchaseHat' : 'purchaseGlasses',
        account,
        chain: sepolia,
        value,
      })
      setTxHash(hash)
      setNotice('Transaction sent. Waiting for Sepolia confirmation…')
      const receipt = await publicClient.waitForTransactionReceipt({ hash })
      if (receipt.status !== 'success') throw new Error('Transaction reverted.')
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
      const item = product === 'hat' ? 'hat' : 'shades'
      setNotice(`The ${item} ${product === 'hat' ? 'is' : 'are'} yours! Now equipped on Mochi.`)
      setAnswer(`Looking good! Your wallet now holds the ${item} unlock on Sepolia.`)
    } catch (error) {
      setNotice(errorMessage(error))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href="#home" aria-label="Mochi Mart home"><span className="brand-mark">m<span>✳</span></span><span>mochi<span className="brand-light">mart</span></span></a>
        <nav aria-label="Main navigation"><a className="nav-active" href="#shop">The shop</a><a href="#how-it-works">How it works</a></nav>
        <button className="wallet-button" type="button" onClick={() => void connect()}>
          <span className="wallet-dot" />{account ? `${account.slice(0, 6)}…${account.slice(-4)}` : 'Connect wallet'}
        </button>
      </header>

      <main id="home">
        <div className="eyebrow-row"><span className="live-dot" /> YOUR LITTLE CORNER OF THE METAVERSE <span className="eyebrow-line" /></div>
        <div className="heading-row"><div><p className="overline">A SHOP WITH A PERSONALITY</p><h1>Meet your new<br /><em>favorite</em> look<span className="period">.</span></h1></div><p className="intro">Say hello to Mochi, your friendly 3D shopkeeper. Try it on, pick your color, and make it yours onchain.</p></div>

        <section className="shop-grid" id="shop" aria-label="Avatar shop">
          <div className={`avatar-panel${motionStatus.startsWith('Playing') ? ' motion-playing' : ''}`}>
            <div className="stage-label"><span className="stage-pulse" /> LIVE TRY-ON <span className="stage-count">01 / 01</span></div>
            <Avatar hatColor={color.hex} wearing={preview} wearingGlasses={glassesPreview} motionRequest={motionRequest} onMotionStatus={setMotionStatus} />
            <div className="stage-bottom"><span>✦ &nbsp; Say hi to Mochi</span><span>Move your cursor to say hello ↗</span></div>
            <div className="speech-bubble"><span className="sparkle">✳</span> {answer}</div>
          </div>

          <div className="details-panel">
            <div className="product-top"><span className="pill">DIGITAL ACCESSORY</span><span className="product-index">NO. 001 — TOKYO EDITION</span></div>
            <div><p className="product-kicker">THE FIRST DROP</p><h2>Tokyo Cowboy<span className="period">.</span></h2><p className="product-desc">A cowboy hat with an ETHGlobal Tokyo 2026 band patch. One unlock, three colors, endless good vibes.</p></div>
            <div className="divider" />
            <div className="color-area"><div className="field-heading"><span>01 / PICK A HAT COLOR</span><strong>{color.name}</strong></div><div className="swatches">{colors.map((item) => <button key={item.name} type="button" className={`swatch ${color.name === item.name ? 'selected' : ''}`} style={{ '--swatch': item.hex } as React.CSSProperties} aria-label={`Select ${item.name}`} aria-pressed={color.name === item.name} onClick={() => { setColor(item); setPreview(true) }}><span /></button>)}</div></div>
            <div className="divider" />
            <div className="purchase-area"><div className="price-row"><div><span className="price-label">ONE-TIME UNLOCK</span><strong>{price === undefined ? '0.0001 ETH' : `${formatEther(price)} ETH`}</strong></div><span className="network-badge"><span /> SEPOLIA TESTNET</span></div>
              <button className="buy-button" type="button" disabled={busy !== null || owned} onClick={() => void purchase('hat')}>{busy === 'hat' ? 'Processing…' : owned ? 'Owned by your wallet ✓' : !account ? 'Connect wallet to unlock ↗' : 'Unlock the hat ↗'}</button>
              <button className="preview-button" type="button" onClick={() => setPreview((current) => !current)}>{preview ? 'Take off the hat' : owned ? 'Equip my hat' : 'Try it on for free'} <span>↗</span></button>
              <div className="divider" />
              <div className="glasses-product"><div className="field-heading"><span>02 / SHIBUYA SHADES</span><strong>{glassesPrice === undefined ? '0.0001 ETH' : `${formatEther(glassesPrice)} ETH`}</strong></div><p className="product-desc">Sakura-tinted sunglasses, sold as a separate unlock.</p></div>
              <button className="buy-button" type="button" disabled={busy !== null || glassesOwned} onClick={() => void purchase('glasses')}>{busy === 'glasses' ? 'Processing…' : glassesOwned ? 'Shades owned by your wallet ✓' : !account ? 'Connect wallet to unlock ↗' : 'Unlock the shades ↗'}</button>
              <button className="preview-button" type="button" onClick={() => setGlassesPreview((current) => !current)}>{glassesPreview ? 'Take off the shades' : glassesOwned ? 'Equip my shades' : 'Try the shades for free'} <span>↗</span></button>
              <div className="divider" />
              <label className="motion-upload" htmlFor="motion-upload">Try an official VRoid motion (.vrma) ↗</label>
              <input id="motion-upload" className="motion-file" type="file" accept=".vrma" multiple aria-label="Choose one or more VRoid motion files" onChange={(event) => {
                const files = Array.from(event.target.files ?? []).sort((a, b) => a.name.localeCompare(b.name))
                if (files.length) setMotionRequest({ files, id: Date.now() })
                event.target.value = ''
              }} />
              <p className="motion-note">For a runway show, select VRMA_01 (show full body), VRMA_05 (spin) and VRMA_06 (model pose) together; they play in file order. VRMA_03 (peace sign) makes a friendly hello. Get them from the <a href="https://booth.pm/ja/items/5512385" target="_blank" rel="noreferrer">free VRoid motion pack ↗</a>. Your file stays in this browser. Character animation credits to pixiv Inc.'s VRoid Project.</p>
              {motionStatus && <p role="status" className="motion-status">{motionStatus}</p>}
              <p className="purchase-note">{owned ? 'Hat unlock found for this wallet. All colors are yours.' : 'Preview for free. The hat and shades are unlocked separately.'}{glassesOwned ? ' Shades unlock found.' : ''}</p>
              {!storeAddress && <p className="setup-note">Checkout opens after a Sepolia contract is deployed and configured.</p>}
              {chainId !== undefined && chainId !== sepolia.id && <p className="setup-note">Switch your wallet to Sepolia to check out.</p>}
              {notice && <p role="status" className="notice">{notice}</p>}
              {txHash && <a className="transaction-link" href={`https://sepolia.etherscan.io/tx/${txHash}`} target="_blank" rel="noreferrer">View transaction on Sepolia ↗</a>}
            </div>
          </div>
        </section>

        <section className="conversation" aria-label="Ask Mochi"><div><span className="conversation-icon">✳</span><div><strong>Ask Mochi anything</strong><p>Your shopkeeper has the answers.</p></div></div><div className="question-list">{answers.map((item) => <button type="button" key={item.question} onClick={() => setAnswer(item.reply)}>{item.question} <span>↗</span></button>)}</div></section>
        <section className="how" id="how-it-works"><span className="section-caption">THE MOCHI WAY</span><h2>Little things. Big personality.</h2><div className="steps"><div><span>01</span><strong>Meet Mochi</strong><p>A friendly face, a new look, and a tiny store built around your avatar.</p></div><div><span>02</span><strong>Try your style</strong><p>Preview the hat in 3D. Swap between three colors, no wallet needed.</p></div><div><span>03</span><strong>Make it yours</strong><p>Unlock the hat on Sepolia and equip it whenever you return with your wallet.</p></div></div></section>
      </main>
      <footer><span>MOCHI MART © 2026</span><span>MADE WITH ♥ FOR ETHGLOBAL TOKYO</span><a href="https://sepolia.etherscan.io/" target="_blank" rel="noreferrer">EXPLORE SEPOLIA ↗</a></footer>
    </div>
  )
}
