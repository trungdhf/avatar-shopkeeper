import { useEffect, useState } from 'react'
import { createWalletClient, custom, formatEther, type Address } from 'viem'
import { sepolia } from 'viem/chains'
import Avatar from './Avatar'
import { publicClient, shopAbi, storeAddress } from './shop'

const colors = [
  { name: 'Sakura', hex: '#e89281' },
  { name: 'Midnight', hex: '#607a9c' },
  { name: 'Honey', hex: '#deb261' },
]

const answers = [
  { question: 'Will it fit?', reply: 'Made for Mochi! Try it on and see how the cap moves with your avatar.' },
  { question: 'What do I get?', reply: 'One onchain unlock for your wallet. All three cap colors are yours to wear here.' },
  { question: 'Which network?', reply: 'Checkout is on Ethereum Sepolia. You will need a little Sepolia ETH for the cap and gas.' },
]

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
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [answer, setAnswer] = useState('Hi! I’m Mochi. Pick a color and try on my favorite cap.')

  useEffect(() => {
    if (!window.ethereum) return
    const provider = window.ethereum
    const onAccountsChanged = (accounts: Address[]) => {
      setAccount(accounts[0])
      setOwned(false)
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
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!account || !storeAddress) return
    let active = true
    void publicClient.readContract({ address: storeAddress, abi: shopAbi, functionName: 'hasHat', args: [account] })
      .then((value) => { if (active) setOwned(value) })
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

  async function purchase() {
    if (!account) {
      await connect()
      return
    }
    if (!storeAddress || price === undefined) {
      setNotice('Checkout is not live yet. Set a deployed Sepolia store address first.')
      return
    }
    try {
      setBusy(true)
      setNotice('Confirm the purchase in your wallet…')
      const client = walletClient()
      if (await client.getChainId() !== sepolia.id) {
        await client.switchChain({ id: sepolia.id })
        setChainId(sepolia.id)
      }
      const hash = await client.writeContract({
        address: storeAddress,
        abi: shopAbi,
        functionName: 'purchaseHat',
        account,
        chain: sepolia,
        value: price,
      })
      setNotice('Transaction sent. Waiting for Sepolia confirmation…')
      const receipt = await publicClient.waitForTransactionReceipt({ hash })
      if (receipt.status !== 'success') throw new Error('Transaction reverted.')
      setOwned(true)
      setPreview(true)
      setNotice('The Tokyo Cap is yours! It is now equipped on Mochi.')
      setAnswer('Looking good! Your wallet now holds this cap unlock on Sepolia.')
    } catch (error) {
      setNotice(errorMessage(error))
    } finally {
      setBusy(false)
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
          <div className="avatar-panel">
            <div className="stage-label"><span className="stage-pulse" /> LIVE TRY-ON <span className="stage-count">01 / 01</span></div>
            <Avatar hatColor={color.hex} wearing={preview} />
            <div className="stage-bottom"><span>✦ &nbsp; Say hi to Mochi</span><span>Move your cursor to say hello ↗</span></div>
            <div className="speech-bubble"><span className="sparkle">✳</span> {answer}</div>
          </div>

          <div className="details-panel">
            <div className="product-top"><span className="pill">DIGITAL ACCESSORY</span><span className="product-index">NO. 001 — TOKYO EDITION</span></div>
            <div><p className="product-kicker">THE FIRST DROP</p><h2>Tokyo Cap<span className="period">.</span></h2><p className="product-desc">A little souvenir for your digital self. One unlock, three shades, endless good vibes.</p></div>
            <div className="divider" />
            <div className="color-area"><div className="field-heading"><span>01 / PICK A COLOR</span><strong>{color.name}</strong></div><div className="swatches">{colors.map((item) => <button key={item.name} type="button" className={`swatch ${color.name === item.name ? 'selected' : ''}`} style={{ '--swatch': item.hex } as React.CSSProperties} aria-label={`Select ${item.name}`} aria-pressed={color.name === item.name} onClick={() => { setColor(item); setPreview(true) }}><span /></button>)}</div></div>
            <div className="divider" />
            <div className="purchase-area"><div className="price-row"><div><span className="price-label">ONE-TIME UNLOCK</span><strong>{price === undefined ? '0.0001 ETH' : `${formatEther(price)} ETH`}</strong></div><span className="network-badge"><span /> SEPOLIA TESTNET</span></div>
              <button className="buy-button" type="button" disabled={busy || owned} onClick={() => void purchase()}>{busy ? 'Processing…' : owned ? 'Owned by your wallet ✓' : !account ? 'Connect wallet to unlock ↗' : 'Unlock this cap ↗'}</button>
              <button className="preview-button" type="button" onClick={() => setPreview((current) => !current)}>{preview ? 'Take off the cap' : owned ? 'Equip my cap' : 'Try it on for free'} <span>↗</span></button>
              <p className="purchase-note">{owned ? 'Onchain unlock found for this wallet. All colors are yours.' : 'Preview for free. Buy once to unlock every color for this wallet.'}</p>
              {!storeAddress && <p className="setup-note">Checkout opens after a Sepolia contract is deployed and configured.</p>}
              {chainId !== undefined && chainId !== sepolia.id && <p className="setup-note">Switch your wallet to Sepolia to check out.</p>}
              {notice && <p role="status" className="notice">{notice}</p>}
            </div>
          </div>
        </section>

        <section className="conversation" aria-label="Ask Mochi"><div><span className="conversation-icon">✳</span><div><strong>Ask Mochi anything</strong><p>Your shopkeeper has the answers.</p></div></div><div className="question-list">{answers.map((item) => <button type="button" key={item.question} onClick={() => setAnswer(item.reply)}>{item.question} <span>↗</span></button>)}</div></section>
        <section className="how" id="how-it-works"><span className="section-caption">THE MOCHI WAY</span><h2>Little things. Big personality.</h2><div className="steps"><div><span>01</span><strong>Meet Mochi</strong><p>A friendly face, a new look, and a tiny store built around your avatar.</p></div><div><span>02</span><strong>Try your style</strong><p>Preview the cap in 3D. Swap between three colors, no wallet needed.</p></div><div><span>03</span><strong>Make it yours</strong><p>Unlock the cap on Sepolia and equip it whenever you return with your wallet.</p></div></div></section>
      </main>
      <footer><span>MOCHI MART © 2026</span><span>MADE WITH ♥ FOR ETHGLOBAL TOKYO</span><a href="https://sepolia.etherscan.io/" target="_blank" rel="noreferrer">EXPLORE SEPOLIA ↗</a></footer>
    </div>
  )
}
