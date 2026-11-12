# Six market frontend

A static React and TypeScript interface for the already deployed `GtaSixMarket`. It offers YES and NO ETH bets, release-evidence submission, Judge settlement and claims. The deployed contract, its economics and its dependencies are unchanged. This is an application-contract launch: there is no token, swap, liquidity or approval flow.

## Install, build and preview

Use Node.js 24 and npm. From the repository:

```sh
cd web
npm ci
npm run build
npm run verify
npm run preview
```

`build` typechecks, retains dependency license notices, exports Vite assets to repository-root `dist/`, copies the verified ABI, then writes `dist/imd-deployment.json` from the final file bytes. It cleans the previous export. `verify` compares the complete manifest, ABI binding and asset inventory against the pinned assignment inputs when available, or the archived handoff otherwise. Commit the source, lockfile and entire new export together.

For editing, run `npm run dev` **after an initial production build**. Vite's development middleware serves the same production deployment manifest and referenced ABI; it does not create a second deployment map. Use the preview command to inspect the actual production files. Never use a `file://` URL. A static HTTP server can serve `dist/` at a directory subpath; no server rewrites are needed. All navigation is on one page with hash anchors, and Vite uses `base: './'`.

## Deployment configuration

`web/deployment/handoff.json` and `network.json` archive the supplied deployment and chain records so rebuilding does not depend on temporary `.imd/` files. `GtaSixMarket.json` was copied byte for byte with `git show` from `docs/abi/GtaSixMarket.json` at deployed source commit `e1e2aafda2d789723da1884a6a98f2753f1a7f18`. Its canonical Keccak-256 is:

```text
0d7283d4cca5392b0cd17c8232a9f70d33871d0025e6306d9c6ea3efa1a62c78
```

Canonicalization recursively sorts object keys, preserves array order and serializes without whitespace. Build and runtime both verify this binding. `scripts/export.mjs` copies the exact handoff contract set, source commit, launch ID and attestation hash; it copies `network` and `walletAddChain` unchanged. This handoff has no `poolKey`, so none is invented. Every exported file except the manifest itself is inventoried with lowercase SHA-256. The script refuses more than 128 assets, an asset over 8 MiB or an export over 8 MiB.

The app only loads addresses, chain, public RPCs and ABI paths from **`dist/imd-deployment.json` at runtime**, through `src/config.ts`; it then fetches the referenced ABI. It never imports the archived handoff into the browser. Updating a deployment requires a new validated handoff and matching implementation ABI, followed by build and verification. Do not edit an address in a component or edit the export by hand.

No environment file, private RPC URL, key, relay or WalletConnect project ID is needed. Public reads try the handoff's RPCs in order and may fall back to the connected wallet only on the configured chain. Chain ID and nonempty deployed code are checked before transaction controls unlock. This is a code-presence check, not a comparison of runtime bytecode against a compiler artifact.

## Wallets and transactions

`src/wallet.ts` discovers named browser extensions through EIP-6963, with an EIP-1193 fallback when none is named. Coinbase Smart Wallet uses a lazy-loaded Coinbase SDK in `smartWalletOnly` mode. A phone without an injected wallet offers the current page in MetaMask, Coinbase Wallet, Rabby and Phantom. The sheet supports Escape, backdrop dismissal, keyboard focus containment and return to its trigger. Wallet selection is remembered locally by the stable reverse-DNS identifier, since the [EIP-6963 UUID identifies a page session](https://eips.ethereum.org/EIPS/eip-6963#provider-info). Reconnection uses `eth_accounts`, not a fresh permission prompt. Disconnect clears this local session without revoking the wallet's site permission.

Connection also attempts the configured chain. Unknown-chain error 4902 triggers the unchanged handoff `wallet_addEthereumChain` parameters, then another switch. A rejected switch leaves one visible header switch action and disables contract actions.

Every action requires fresh contract state, the current signing account and the correct chain. Public state is refreshed every 15 seconds while the page is visible, on focus, on explicit refresh and after confirmation. All snapshot reads use one block number. Failed reads or state older than 60 seconds disable actions. Repeated reads are coalesced; a post-confirmation refresh supersedes an older request.

Every transaction has a review dialog with the action, ETH value, account and destination. The app rechecks the wallet account/chain and simulates the contract call before asking for a signature. Pending labels apply to the active action, and other transaction controls stay locked through confirmation and the state refresh. Wallet rejection, custom reverts, Judge still voting, reverted receipts and unknown confirmation status have persistent recovery messages with explorer links. Pending hashes are stored per chain/contract and restored after reload; confirmation must be checked before another action unlocks. If browser storage is blocked, tracking lasts for the open page only. Repriced transactions can complete normally; cancelled or otherwise replaced transactions are not reported as successful market actions.

## Market behavior

- The deployed cutoff is inclusive: **December 31, 2026 at 23:59:59 UTC counts**. The timeline reads all three deadlines from `marketState()` after it loads.
- Bets are irreversible, carry no fixed odds, and suspend while any Judge question is pending. The return preview includes the new stake in both the selected total and pot; it is an estimate for that new stake, not a guaranteed quote.
- Evidence is ASCII, at most 650 bytes, and must include an HTTP(S) link. The editable 0.002 ETH question budget is a suggestion from the contract's guidance, not a live fee quote. The contract returns unused ETH; gas is additional.
- Anyone can settle a question. The UI lists asking account, time and verdict, and also accepts an ID from this market's on-chain list. Simulation catches a still-voting or already-settled question. Details are paginated eight at a time; the contract exposes the complete ID array in one read.
- Claims use the contract's `claimable(account)`, including the refund case when nobody backed the winning side. No YES by the final deadline makes NO win without a resolution transaction.
- The contract has no owner or unset administration settings. There is no setup panel to invent.
- The three oracle risks appear beside the bet controls and in the rules: a wrong YES is final; unlimited asks can produce one false YES; Judge, payment-door or IMD-pool outages can make NO win despite a release.
- Amounts are ETH. There is no supplied USD feed, and the site says USD values are unavailable. Exact pool and wallet balances are disclosed, and individual stakes/claims retain full precision. Full checksummed addresses, explorer links and copy controls are available. ENS lookup is not implemented.

## Validation

```sh
npm run typecheck
npm test
npx playwright install chromium
npm run test:browser
npm run verify
```

`test:browser` starts and closes its own static preview under `/preview/` in a bounded foreground process. It uses synthetic RPC and wallet fixtures, **never real funds or a real broadcast**. It tests all five write methods, exact calldata/value/destination, network addition, reverts, pending locks, reload recovery, state verification, mobile wallets, reconnect/disconnect, reflow, keyboard dialog behavior and axe accessibility. It saves results and screenshots to `docs/frontend/`. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` only if using an already installed compatible Chromium executable.

During this assignment the pinned probe was also run from the repository root:

```sh
node .imd/reads/skills/design-critic/scripts/taste.mjs --out test/scratch/taste
```

An adapter supplied the installed headless Chromium executable through the probe's `IMD_PLAYWRIGHT` option because the supplied browser tool could not start Chrome. That adapter is scratch scaffolding, not a production dependency. The pinned probe is an assignment input that is removed after submission; `test:browser` remains in the delivered source.

See [validation](../docs/frontend/VALIDATION.md), [design system](../docs/DESIGN.md) and the adjacent evidence. Real RPC requests returned HTTP 403 on this worker; live chain/code and funded wallet behavior remain unverified. WebKit and physical wallet-app handoff/passkey signing were not run. The app enforces these runtime prerequisites instead of presenting mock state as live.

## Publishing and attribution

Deliver `dist/` as-is to the publisher. This worker does not deploy contracts, pin IPFS, publish GitHub source or choose a live domain. Relative share-image metadata becomes absolute only when a publisher knows the site URL. The share card is bundled as `share.png`; its editable artwork is `art/share.svg`.

The assignment's explicit write budget excludes root `DESIGN.md`; the requested implemented design document is therefore at `docs/DESIGN.md`. The only ignore-file budget used is **`web/.gitignore`**. Its dependency/cache patterns apply at every depth under `web/`; dependencies, caches and archives are excluded from the submission.

Design guidance: Jakub Krehel's Better Interface, MIT, pinned commit `267330e1adfc66a718fb65fa6918c1f06d0a689e`. Documentation method: Paul Bakaus's Impeccable, Apache-2.0, pinned commit `9d715cc4f5564a990ca8345abfdd5df6dc9b41c8`. ETH UX guidance: Austin Griffith's ethskills, MIT, pinned commit `06ea4efa08076ff04f6ca4945ef4a2ca881115b0`. Retained licenses are in `docs/frontend/`.

MetaMask, Rabby and Phantom marks come from [RainbowKit](https://github.com/rainbow-me/rainbowkit), with its MIT license retained in `art/`. Rabby's browser URL follows the `_cmd=open-dapp`/`dapp` handler in its [mobile source](https://github.com/RabbyHub/rabby-mobile/blob/develop/apps/mobile/src/hooks/universalLink.ts) and its [universal-link constants](https://github.com/RabbyHub/rabby-mobile/blob/develop/apps/mobile/src/constant/universalLink.ts). Phone-app dispatch still needs physical-device verification. Bundled production dependency licenses are regenerated into `dist/third-party.txt`.
