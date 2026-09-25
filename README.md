# Mochi Mart

A tiny 3D shopkeeper for digital avatar accessories, built for ETHGlobal Tokyo 2026. Preview the Tokyo Cap in three colors, then unlock all three for one wallet on Ethereum Sepolia. The cap is an in-app entitlement stored in `AvatarShop.hasHat`; it is **not** an NFT or exclusive ownership of the 3D mesh.

## Run locally

Requirements: Node.js 20.19+ and npm.

```sh
npm ci
cp .env.example .env
npm run dev
```

Open the URL printed by Vite. Preview and color selection work without a wallet. Checkout requires an injected Ethereum wallet, Sepolia ETH and a deployed shop contract.

## Deploy the contract and enable checkout

1. Open [Remix](https://remix.ethereum.org/), create a file named `AvatarShop.sol`, and paste in [`contracts/AvatarShop.sol`](contracts/AvatarShop.sol). Compile with Solidity `0.8.37` (or any compatible `0.8.24+` compiler).
2. In **Deploy & Run Transactions**, select **Injected Provider**, switch your wallet to **Sepolia**, and deploy `AvatarShop`. The deploying wallet is the owner and can withdraw shop revenue. Keep some Sepolia ETH for gas.
3. Copy the deployed contract address into `.env` as `VITE_STORE_ADDRESS=0x...`. Restart `npm run dev`. The app reads `PRICE()` and `hasHat(address)` from the contract, sends `purchaseHat()` with exactly `PRICE()` wei, waits for confirmation, and equips the cap.
4. For production, set `VITE_STORE_ADDRESS` (and optionally `VITE_SEPOLIA_RPC_URL`) in the static hosting provider's build environment. Build with `npm ci && npm run build`; serve the generated `dist` directory. Redeploy the site after setting the address. Do not put private keys in the repository or frontend environment variables.

Use the [Sepolia explorer](https://sepolia.etherscan.io/) to check the deployment and purchase transaction. The default public RPC may rate-limit demos; supply a reliable Sepolia RPC URL if needed. `VITE_` variables are embedded in the public frontend and must never contain a secret.

## Verify

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm audit
```

The contract test compiles Solidity and executes real EVM calls in memory. It checks the exact price, rejection of underpayment and double purchase, independent ownership across wallets, event emission, and owner-only withdrawal. It does not replace a signed Sepolia purchase test.

## Demo and submission

1. Show the 3D avatar and switch cap colors without connecting a wallet.
2. Connect a funded Sepolia wallet; unlock the cap and show the confirmed transaction in the explorer.
3. Refresh the page: ownership is read from chain; equip/unequip and choose another color.
4. Submit the live site, this public repository, and a narrated 2–4 minute screen recording in the ETHGlobal Hacker Dashboard before **09:00 JST, Sunday 27 September 2026**. The venue finalist slide lists the video and live app as requirements. Present live if invited.

The shopkeeper's replies are scripted product guidance, not an AI agent. No World, ENS, Sui, Uniswap or 1inch SDK is integrated; do not select those partner prizes unless a qualifying integration is implemented. ETHGlobal permits selecting up to three partner prizes, and partner details should be checked again before submission.

## Attribution and project history

- The avatar, cap, and shop visuals are procedural shapes and styling created for this repository; no external 3D model is bundled. The model is a placeholder that can be replaced with the participant's own work where track rules allow it.
- React, Three.js, React Three Fiber, viem, Vite and Solidity compiler packages are open-source dependencies with their own licenses. No prior project-specific code was copied into this repository.
- Devin, an AI coding assistant, generated the initial application source, contract, tests and documentation from the participant's avatar shop concept during ETHGlobal Tokyo 2026. The participant must review, direct, test, present, and document their own contributions honestly in the final submission; AI assistance alone does not guarantee prize eligibility.
