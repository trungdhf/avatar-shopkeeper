# Mochi Mart

A 3D shop with a shopkeeper, built for ETHGlobal Tokyo 2026. Mochi stands beside a display stand on a Tokyo dusk set; click anything on the shelves and Mochi puts it on. Twelve styles are free to try, and two of them can be unlocked for a wallet on Ethereum Sepolia.

**What is actually for sale.** The deployed contract knows exactly two items: the Tokyo Cowboy hat (`PRICE`, `purchaseHat()`, `hasHat`) and the Shibuya Shades (`GLASSES_PRICE`, `purchaseGlasses()`, `hasGlasses`). The other ten shelf styles - three more hat shapes, two more eyewear styles and three tees - are try-on only, and the shop says so when you click them. Both unlocks are in-app entitlements stored in mappings; neither is **an NFT**, and neither grants exclusive ownership of the 3D mesh. The event wordmark on the hat, the shirt and the backdrop is an original event-themed design, not an official ETHGlobal product or a claim of sponsorship.

Clicking a shelf item opens a small menu beside it. Sellable items can be added to a cart, which lives behind the **Cart** button in the header; prices and totals appear only once you open checkout. Because the contract exposes one function per item and has no batch entry point, paying for two items prompts the wallet twice. Ownership is read back from the contract, so a reload re-equips whatever the wallet holds.

Live site: https://avatar-shopkeeper.vercel.app. Contract on Sepolia: [`0xaaa682cac7bbb85ad96b209f6a18fde687018973`](https://sepolia.etherscan.io/address/0xaaa682cac7bbb85ad96b209f6a18fde687018973), price 0.0001 ETH per item. Try-on needs no wallet.

To try VRoid Project's friendly peace sign or full-body spin, download the [free seven-motion pack](https://booth.pm/ja/items/5512385) from BOOTH, extract `VRMA_03.vrma` (Peace sign) or `VRMA_05.vrma` (Spin) and select it with **Play a VRoid motion** under the stage. The picker accepts other motions in the pack too, including `VRMA_02.vrma` (Greeting). Select several files at once for a runway show: they play back-to-back in file-name order, e.g. `VRMA_01` (Show full body) → `VRMA_05` (Spin) → `VRMA_06` (Model pose), then return to idle. The file is parsed in your browser and never uploaded. BOOTH's license permits use and testing but prohibits redistribution of extractable motion files; this project does not include or host them. Character animation credits to pixiv Inc.'s VRoid Project.

## Run locally

Requirements: Node.js 20.19+ and npm.

```sh
npm ci
cp .env.example .env
npm run dev
```

Open the URL printed by Vite. Trying things on needs no wallet. Checkout needs an injected Ethereum wallet, Sepolia ETH and `VITE_STORE_ADDRESS`.

`/debug.html` is a development-only tuning page: sliders for the idle turn, face, stance, hat badge, shirt print, stage layout and lip sync, a library of local `.vrma` files, and a block of constants to paste back into `src/Avatar.tsx`. Vite builds only `index.html`, so the page never reaches `dist`.

Two development-only environment hooks, both ignored by production builds:

- `VITE_IDLE_MOTION` swaps the looping idle clip for a local file. `import.meta.env.DEV` gates it, so a build can only ever request the bundled MIT clip.
- `VRMA_DIR` points the dev server's `/dev-motions` route at a folder of `.vrma` files (default `dev-motions/`, which is gitignored). The Vite plugin is `apply: 'serve'` only, so nothing there is ever published.
- `VITE_IDLE_CHAIN` is a comma separated list of files from that folder to play as a looping idle instead of the bundled clip, which is handy while recording. The live site always uses the bundled clip; visitors can still load the same motions themselves with the picker under the stage.

## Deploy the contract and enable checkout

A contract is already deployed and wired to the live site, so this section is only needed to run your own.

1. Open [Remix](https://remix.ethereum.org/), create a file named `AvatarShop.sol`, and paste in [`contracts/AvatarShop.sol`](contracts/AvatarShop.sol). Compile with Solidity `0.8.37` (or any compatible `0.8.24+` compiler).
2. In **Deploy & Run Transactions**, select **Injected Provider**, switch your wallet to **Sepolia**, and deploy `AvatarShop`. The deploying wallet is the owner and can withdraw shop revenue. Keep some Sepolia ETH for gas.
3. Copy the deployed contract address into `.env` as `VITE_STORE_ADDRESS=0x...`. Restart `npm run dev`. The app reads `PRICE()`/`GLASSES_PRICE()` and `hasHat(address)`/`hasGlasses(address)` from the contract, sends `purchaseHat()` or `purchaseGlasses()` with the exact price in wei, waits for confirmation, and equips the purchased accessory.
4. For production, set `VITE_STORE_ADDRESS` (and optionally `VITE_SEPOLIA_RPC_URL`) in the static hosting provider's build environment. Build with `npm ci && npm run build`; serve the generated `dist` directory. Redeploy the site after setting the address. Do not put private keys in the repository or frontend environment variables.

Use the [Sepolia explorer](https://sepolia.etherscan.io/) to check the deployment and purchase transaction. The default public RPC may rate-limit demos; supply a reliable Sepolia RPC URL if needed. `VITE_` variables are embedded in the public frontend and must never contain a secret.

## Destination screening

Opening checkout screens the **paying wallet** with [Intercepta](https://intercepta.io/) before it is asked to sign, using the [quick scan address](https://docs.web3antivirus.io/reference/quick-scan-address) endpoint. A `sanction_address`, `known_scammer` or `blacklist` trait holds the payment; other traits are reported.

It screens the wallet rather than the shop contract on purpose. The provider indexes Ethereum mainnet, so an address deployed only on Sepolia returns a score of 0 with no traits: absent data rather than a clean result, which would make the check a gate that can never close. A wallet address is the same on every chain, so its mainnet history is real signal. `toxicScore` is displayed but never used as a threshold, because probing the live API showed it is a float on an undocumented scale where low values are ordinary, and a zero means the address has no mainnet history at all.

The key is read as `INTERCEPTA_API_KEY`, with no `VITE_` prefix on purpose: Vite inlines the value of every `VITE_` variable into the published bundle, so a key named that way would be readable by anyone who opens the page. Requests therefore go through this project's own `/api/screen` route, served by `api/screen.ts` on Vercel and by a `apply: 'serve'` Vite plugin during development. Set `INTERCEPTA_API_KEY` in `.env` locally and in the hosting provider's environment for production. With no key the route answers `{"state":"skipped"}` and checkout continues unscreened.

The client bundle was checked to confirm the separation holds: it contains no vendor hostname, no `X-API-KEY`, and no reference to the key's name.

## Verify

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm audit
```

The contract test compiles Solidity and executes real EVM calls in memory. It checks the exact price, rejection of underpayment and double purchase, independent ownership across wallets, event emission, owner-only withdrawal, and that shades ownership is independent of the cap. It does not replace a signed Sepolia purchase test.

## Demo and submission

1. Click hats, eyewear and tees on the shelf; Mochi puts each one on, greets you with silent lip sync, and the menu marks which styles are try-on only. No wallet needed.
2. Connect a funded Sepolia wallet, add the cowboy hat and the shades to the cart, open checkout to reveal the total, and pay. Show the confirmed transactions in the explorer.
3. Reload the page: ownership is read from the contract and both items come back on, with no wallet prompt.
4. Submit the live site, this public repository, and a narrated 2–4 minute screen recording in the ETHGlobal Hacker Dashboard before **09:00 JST, Sunday 27 September 2026**. The venue finalist slide lists the video and live app as requirements. Present live if invited.

The shopkeeper's replies are scripted product guidance, not an AI agent, and the lip sync is a vowel-to-viseme mapping over that text rather than speech recognition or audio. Intercepta screens the payment destination at checkout, as described above. No World, ENS, Sui, Uniswap or 1inch SDK is integrated; do not select those partner prizes unless a qualifying integration is implemented, and check each partner's own definition of a qualifying integration before selecting it. ETHGlobal permits selecting up to three partner prizes, and partner details should be checked again before submission.

## Attribution and project history

- The default avatar `public/avatars/real2.vrm` is copied unchanged from [Trung's pre-existing chatbot3D project](https://github.com/trungdhf/chatbot3D/tree/d8726b908fb6d2d94ca225ccbc47d14339a45b00) with the owner's permission. Its VRM metadata names Trung as author and restricts redistribution and modification; publishing it here does not grant others permission to reuse the model. The original GLB's provenance should be described in the hackathon submission. The cap, shades, extra hat and eyewear styles, the worn tee, the shirt print, the display stand, the shop sign, the Tokyo dusk backdrop and the floor were all made for this repository as geometry and canvas drawings, with no external art assets.
- The idle/head movement (`public/anims/LookAround.vrma`) is copied from [TK256's VRM Viewer](https://github.com/tk256ailab/vrm-viewer/tree/0cd2267f36939da589afc8eac449b5b9ccce4c01/VRMA), whose repository carries an MIT license (notice reproduced in `LICENSE`). Its README asks users to ensure they have rights to animations; no separate asset-level origin or license is documented there. The avatar's own VRM `blink` expression supplies the blink, rather than an external animation file. This external motion also predates this project. For a friendly shopkeeper gesture, select the official Peace sign clip locally; the bundled Goodbye and Relax motions were removed after their large arm movements did not suit this shopkeeper.
- Reusing this pre-event avatar and these motions affects ETHGlobal track eligibility: do not present the project as entirely From Scratch. Choose a track that permits prior assets, or replace them with assets created during the event before submitting to From Scratch.
- The application source is MIT-licensed (see `LICENSE`); the imported VRM avatar is excluded. React, Three.js, React Three Fiber, @pixiv/three-vrm, viem, Vite and Solidity compiler packages are open-source dependencies with their own licenses. No prior project-specific application code was copied into this repository.
- Devin, an AI coding assistant, generated the initial application source, contract, tests and documentation from the participant's avatar shop concept during ETHGlobal Tokyo 2026. The participant must review, direct, test, present, and document their own contributions honestly in the final submission; AI assistance alone does not guarantee prize eligibility.
