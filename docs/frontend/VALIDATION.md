# Frontend validation

Worker validation on 2026-11-12. This is contributor evidence, not independent certification of behavior, contract security or publication.

| Area | Final result |
| --- | --- |
| Assignment criteria | 7 met; source/export files ready but local Git commit blocked; 1 design-document location constrained by the explicit write scope |
| Contract actions | 5 of 5 external write methods exposed and tested with mocked wallet/RPC |
| Broken features observed after fixes | 0 in the tested scope |
| Product and main control at 390×844 | Yes; wallet, state, side, amount and main button are visible |
| Pinned taste@1 probe | 16 of 16 checks pass |
| Meaningful interaction scenarios | 18 pass |
| Unit checks | 6 pass |
| Accessibility scan | 0 axe violations, 0 incomplete checks in the base-page scan; wallet-sheet scan also passes |
| Copy findings remaining | 0 observed |
| Share metadata | Title, favicon, description, og:title, og:image present; bundled PNG |
| Live-chain transactions / WebKit | Not run; limitations below |

The implemented visual idea is a compact market ticket with a warm neutral page, one light trading surface and a lime action, keeping the stake decision before explanation.

## Scope and requirements

The assignment is the frontend stage for the already deployed, ownerless `GtaSixMarket`. Contracts, deployment scripts, Foundry configuration, vendored libraries and root build files are unchanged. There is no token/pool launch, so swaps, token approval, quotes, liquidity and owner setup are not applicable. IPFS pinning, naming, public hosting and GitHub publication belong to the later publisher stage.

| Requirement | Status and implementation |
| --- | --- |
| “dist/index.html and its assets are committed alongside source and lockfile” | Files ready: Vite/React/TypeScript source, npm lockfile and root static export; relative `./` base, tested beneath `/preview/`. Local staging/commit was refused by read-only Git metadata, so no worker commit is claimed. |
| “every primary contract action has a control on the page” | Met: `betYes`, `betNo`, `resolve`, `settle`, `claim`; ABI-derived method-set test confirms this is the full write set. Live-read integration is exercised with synthetic chain responses, including wallet-specific stakes and claimable ETH. |
| “contract addresses, chain IDs, ABIs and public RPC settings are centralized” | Met: the browser loads only `imd-deployment.json`, then its ABI path. The archived handoff is build input, not a second browser map. No credentials. |
| “worker runs build, typecheck and meaningful interaction validation” | Met: commands and output artifacts below, with explicit live-chain limits. |
| “applies the pinned Better Interface guide … six domains” | Met: six-domain coverage, reproduced fixes and final rendered review below. |
| “first screen at 390 wide … nothing scrolls sideways at 320 or 390 … title, favicon, description, og:title and og:image” | Met in rendered Chromium. Also checked at 720 and 1440. Long values and enlarged text were exercised. |
| “DESIGN.md at the repository root” | Scoped relocation: `docs/DESIGN.md`. The overriding rule permits only `web/**`, `dist/**`, `docs/**` and explicitly `web/.gitignore`; a root document would violate that budget. Its full required content is delivered under `docs/`. |
| “dist/imd-deployment.json is the app's runtime deployment configuration” | Met: exact handoff identity, deployed source commit, contract set/address/ABI hash, runtime ABI load and 13-file SHA-256 inventory; verification passes. No pool key exists in this handoff. |
| “network block is copied unchanged … wallet_addEthereumChain after switching fails” | Met: deep equality against the supplied network file; mocked unknown-chain test checks exact addition parameters and switch/add/switch ordering. No Uniswap action is invented for this application-contract handoff. |

The deployed interpretation includes all of December 31, 2026, through 23:59:59 UTC. This is explicit in the UI. Only a YES settled in this contract by January 7, 2027 at 23:59:59 UTC counts. The frontend does not reinterpret or modify those immutable rules.

## Build and binding evidence

From the repository root, the final app source was checked with:

```sh
npm --prefix web run build
npm --prefix web run verify
npm --prefix web test
npm --prefix web run test:browser
git show e1e2aafda2d789723da1884a6a98f2753f1a7f18:docs/abi/GtaSixMarket.json | cmp - web/deployment/GtaSixMarket.json
node .imd/reads/skills/design-critic/scripts/taste.mjs --out test/scratch/taste
```

Build (including `tsc --noEmit`), manifest verification, six unit checks, 18 interaction scenarios, pinned ABI byte comparison and the probe all exited 0. Browser commands used the available compatible headless Chromium executable via `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`; the unmodified probe used its `IMD_PLAYWRIGHT` adapter option. The provided MCP browser tool failed to start because its Chrome distribution was absent. Direct Playwright supplied the rendered checks and screenshots instead. WebKit's executable was unavailable.

The development middleware was separately started and closed in a foreground smoke check: it served the exact production deployment manifest and the referenced implementation ABI. This is a middleware check, not an additional browser-engine result.

Final export: **13 assets, 718,088 bytes**, plus a 3,709-byte manifest. Largest asset: 493,738 bytes. Every exported file except the manifest is declared; index, ABI, scripts, CSS, favicon, share image, wallet marks and license notices are included. There are no dependency archives, caches or `node_modules` in the submission. These figures are far below both the 8 MiB submission ceiling and the publication response budget.

The ABI is the raw implementation JSON array from deployed source commit `e1e2aafda2d789723da1884a6a98f2753f1a7f18`, Git blob `b827ae9b1d80f6f6948e307a20e5a0672a19b9ff`. Its canonical Keccak-256 matches the attested handoff:

```text
0d7283d4cca5392b0cd17c8232a9f70d33871d0025e6306d9c6ea3efa1a62c78
```

The manifest retains the **deployed contract source commit**, not the later frontend commit. Its SHA-256 and exact sizes are recorded in [build-evidence.json](build-evidence.json). That file binds the final asset export to this worker evidence. The sole ignore-file path budget used was `web/.gitignore`; its generated-directory patterns apply at every nesting level in `web/`.

The final submission-file audit found 65 eligible files totaling approximately **1.79 MB**, below 8,388,608 bytes. Every path is in the allowed scope, generated dependency/cache directories are excluded, every export hash matches, and protected deployed source/configuration is unchanged. Git metadata is read-only, so this was a read-only file audit rather than a staged-tree audit.

## Interaction coverage

The production export was served under `/preview/`. The shipped test harness uses clearly synthetic chain/wallet fixtures and checks calldata with the shipped implementation ABI. It never imports a mock into production code and never broadcasts a real transaction.

| Flow | Observed result |
| --- | --- |
| Disconnected and connected market | Wallet available before public reads complete; pool state and account-specific balances/claim data load from mocked RPC. |
| YES and NO | Invalid zero amount is explained; review sends nothing; confirmation simulates then sends exact wei and the correct method to the manifest address. |
| Full keyboard path | Enter opens wallet sheet, Tab/Enter chooses wallet, radio arrow keys change side, Tab reaches the amount, Enter opens review, Tab/Enter confirms a mocked NO bet. |
| Wrong / unknown chain | Switch/add/switch with the unchanged walletAddChain object. Rejected switch leaves a visible switch control and disabled contract actions. |
| Wallet and simulation errors | Rejected signature and `BettingClosed` custom error are recoverable and broadcast nothing. |
| Pending / failed receipt | Other actions stay locked; no duplicate send; reverted receipt explains that gas was spent. |
| Pending across reload | Hash restored, actions locked, explicit confirmation check completes without a second send. |
| Resolve | Empty, Unicode and over-budget proof rules are unit/browser checked; reviewed ASCII evidence and exact 0.002 ETH budget are encoded for `resolve`. |
| Settle | Pending questions suspend bets; still-voting simulation blocks signing; successful settlement encodes the market's question ID. |
| Claim | On-chain claimable value drives review; payable value is zero. YES resolution and deadline NO/refund states disable betting/evidence appropriately. |
| RPC verification and fallback | Primary endpoint failure falls back; wrong chain or empty code keeps actions disabled; read failure locks actions and explicit refresh recovers. |
| Mobile and wallet state | Four app-browser links plus Coinbase Smart Wallet, no WalletConnect row; account removal, silent reconnect with a different per-page provider UUID, and local disconnect tested. |
| Integrity | Altered ABI fails at bootstrap and exposes no transaction controls. |
| Reflow and long values | 320, 390, 720, 1440px; full account, a 20-digit ETH balance with 18 fractional places, opened wallet sheet and 200% root-text enlargement. No horizontal overflow observed. |

See [interaction-results.json](interaction-results.json), [accessibility.json](accessibility.json), [dev-preview.json](dev-preview.json) and [taste.json](taste.json). The test runner's scenario names give the exact grouping; this table consolidates related assertions.

## Better Interface: six-domain review

The pinned guide's workflow and core principles in all six domains were read before implementation, with supporting form, focus, typography and documentation sections consulted as needed. Source checks supplemented rendered checks; they do not stand in for screen-reader or physical-device sessions.

| Domain | Coverage | Evidence and limitations |
| --- | --- | --- |
| Accessibility | Checked | Native buttons/links/dialog/radios, labels, field errors, status regions, visible focus, full keyboard bet flow, focus restoration and axe. Screen reader, native zoom and forced-colors rendering not verified. |
| Layout | Checked | Mobile first screen, desktop/subpath export, full addresses, long balances, wallet sheet and 320/390/720/1440 reflow. Root text enlarged to 200%; localization/RTL variants are not part of this English-only product. |
| Writing | Checked | Verb/action labels, reviewed ETH consequences, unknown/loading/error/empty states, changing returns, USD-unavailable text, inclusive cutoff and all three oracle risks. No invented live data or price. |
| Typography | Checked | Six defined tokens, no more than three repeated sizes in the probe's measured base states, computed 400/600/700 weights, natural casing and wrapping. Platform font substitution is not a downloaded-font verification. |
| Colors | Checked | Source roles, rendered text contrast via taste and axe, YES/NO selection and focus screenshots. Lowest measured base-page text pair was muted `#62635b` on page `#f6f4ef`, **5.53:1**. No dark theme exists; native forced-colors and external wallet/passkey UI are unverified. |
| UI | Checked | Rest, hover definitions, focus, selected, disabled, loading, empty, error, pending and success states; flat surfaces, no nested cards, no infinite motion, reduced-motion probe. Animation-panel slow playback and external wallet UI were not run. |

All 16 pinned taste checks pass: render, layout, targets, contrast, casing, tracking, eyebrows, type sizes, type faces, glyphs, slogans, repetition, copy budget, chrome, motion and share. It measured 30 first-screen prose words at 390 and 48 at 1440. Four controls are below the optional 44px comfortable target size; they meet the 24px baseline with spacing. All measured text met 4.5:1 (3:1 for large text). The probe's record is retained without machine-specific paths.

### Findings, fixes and rechecks

| Severity / domain | Final source location | Finding, fix and evidence |
| --- | --- | --- |
| Medium / accessibility | `web/src/components.tsx:10` | Escape originally lost the opening control's focus when React removed the native dialog. Explicitly capture and restore the trigger. Reproduced in the first browser run; final focus-return assertion and keyboard flow pass. |
| High / accessibility, colors | `web/src/style.css:101` | The compact breakpoint hid the radio marker, leaving a visual selection dependent on color. Keep the filled/empty circle at every width. Final 320/390 screenshots and keyboard-selected NO screenshot show the independent shape cue and focus perimeter. |
| Medium / layout, typography | `web/src/style.css:93` | Wrapped NO caption vertically displaced its heading against YES. Top-align the two option contents. Final 390 screenshot shows shared heading baselines. |
| Medium / writing, UI | `web/src/App.tsx:30` | Unloaded state could say “No odds yet” with a 50/50 bar, implying an empty or balanced market before a read. Use “Loading…”, a neutral empty bar and explicit unavailable/stale labels with retry. Read-failure/recovery scenarios pass. |
| Medium / writing | `web/src/domain.ts:3`, `web/src/market.ts:55` | Generic error filtering hid the specific wrong-RPC-chain explanation. Use typed safe user errors while keeping raw provider internals out of UI. Wrong-chain and code-absence scenarios now show the verification reason and keep actions locked. |
| High / UI | `web/src/market.ts:113`, `web/src/market.ts:142` | A receipt failure must not be treated as proof that the transaction failed. Preserve unknown confirmation state and keep actions locked through receipt/state refresh; restore pending hashes after reload. Pending, reverted-receipt and reload-recovery tests pass. The exact 180-second timeout and replacement callbacks were reviewed in source, not exhaustively timer-tested. |
| Medium / wallet UI | `web/src/wallet.ts:48` | Persisting the provider UUID would lose reconnection when an extension changes its page-session ID. Remember its stable reverse-DNS identity instead. The final reconnect scenario generates a new UUID on reload and confirms that only `eth_accounts` is requested. |

No unresolved applicable high or medium finding remains in the tested frontend scope. The exact root `DESIGN.md` path is a documented scope exception, not an unreported file.

### Rendered artifacts inspected

- [390.png](390.png): final first screen with synthetic pool data; wallet and main action visible.
- [320.png](320.png), [720.png](720.png), [1440.png](1440.png): reflow and full desktop page.
- [wallet-mobile.png](wallet-mobile.png): actual wallet bottom sheet, local wallet marks and no QR route.
- [focus.png](focus.png), [focus-radio.png](focus-radio.png): visible keyboard perimeter on the wallet control and selected NO option.

Screenshots show test fixtures, not mainnet balances or claims. The pinned probe separately rendered the unmocked export in the public-RPC loading/failure environment; its screenshots are temporary scratch artifacts, while its 16-check result is retained here.

## Remaining limits and completion

Both configured public endpoints returned **HTTP 403** to worker `eth_chainId` requests. See [live-rpc.json](live-rpc.json). Therefore actual chain ID, deployed code, live market values, Judge/ETH-door availability, gas estimation and funded on-chain writes remain unverified here. The application itself requires a successful configured-chain/nonempty-code/read check before acting. No key or wallet was funded or used; no mainnet transaction was sent.

WebKit, physical iPhone/Android wallet dispatch, Coinbase passkey creation/signing, screen-reader sessions, browser-native 200% zoom and native forced-colors rendering were not run. The four mobile URLs and SDK configuration are implemented; a rendered chooser is not evidence that every external app opens or signs. ENS reverse resolution and a USD feed are not implemented; the interface exposes checksummed addresses and explicitly unavailable USD context. Pending recovery depends on browser storage, and tabs do not coordinate simultaneous independent transactions. Large histories still fetch the contract's full ID array before displaying eight question details at a time.

**Source, static export and worker validation are complete. Local Git staging/commit could not be performed:** `git add -- web dist docs` answered that `.git/index.lock` could not be created because the filesystem is read-only. All deliverable files remain in the workspace for the submission/publisher process. No local commit is claimed. The design-document relocation and untested live-chain/platform behavior remain as described above. Publication checks against immutable/named hosting, RPC and ABI attestation are later control-plane checks; none is claimed as having run or as proving browser behavior.

Guide attribution and retained licenses: [Better Interface / documentation method](better-interface-LICENSE.txt), [ethskills](eth-frontend-ux-LICENSE.txt); source attribution is detailed in [web/README.md](../../web/README.md).
