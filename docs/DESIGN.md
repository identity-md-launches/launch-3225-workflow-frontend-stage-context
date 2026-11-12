# Six market design

## Overview

This is a compact prediction-market interface for ETH bettors, claimants and anyone bringing release evidence to Judge. The implemented visual idea is an uncluttered market ticket: a warm page, a single light trading surface and a lime primary action. Contract data and controls lead; the timeline, personal stakes, evidence and rules follow.

The page is intentionally light-only. There are no marketing illustrations, charts implying a price feed, motion on load or invented market activity. The visual choices were inferred for this new interface, not supplied as requester branding. The write budget excludes a root `DESIGN.md`, so this document lives in the allowed `docs/` scope.

## Colors

Canonical definitions are at `web/src/style.css:1`. Reuse semantic custom properties in components.

| Token | Value | Role |
| --- | --- | --- |
| `--color-page` | `#f6f4ef` | Warm background and quiet shortcut buttons |
| `--color-surface` | `#fffefb` | Trade panel, fields and dialogs |
| `--color-text` | `#242522` | Primary copy and structural action borders |
| `--color-muted` | `#62635b` | Supporting text and labels |
| `--color-border` | `#d3d4c9` | Field edges, dividers and empty stake bar |
| `--color-accent` | `#d4f189` | Primary action fill; brand mark detail |
| `--color-accent-hover` | `#c3e572` | Primary hover fill |
| `--color-yes` / `--color-yes-soft` | `#326044` / `#eef4e8` | Selected YES text, edge and background |
| `--color-no` / `--color-no-soft` | `#874737` / `#f9ede7` | Selected NO text, edge and background |
| `--color-error` | `#922d25` | Persistent errors and invalid field edges |
| `--color-focus` | `#5b3ab5` | 3px keyboard focus perimeter |

The stake bar and small pool keys use `#86a56a` and `#c2907c`; they are categorical graphics with text equivalents, not text colors. Disabled controls use `#e9e9e1`, neutral notices `#eeede6`, and dialog backdrops `#24252288`. These local treatments are defined beside their components. Measured rendered contrast and its coverage are recorded in `docs/frontend/VALIDATION.md`; no dark-theme contrast is claimed.

## Typography

The prose stack is `Arial, Helvetica, sans-serif`; code and hashes use `ui-monospace, SFMono-Regular, Consolas, monospace`. These are platform fonts, without a network font request or a bundled font dependency. Actual face substitution and weight mapping can vary by device; the probe reports computed family/weight, not proof of an installed Arial face.

The six semantic size tokens are 14, 16, 20, 24, 32 and 48px at the default 16px root. `h1` is 48px on desktop and 32px at 45rem and below, weight 700, line-height 1.1, tracking -0.045em. Section headings are 20px/600 with 1.25 line-height and -0.02em tracking. Subheadings are 16px/600; body is 16px/400 with 1.5 line-height, and supporting labels/captions are 14px. Dialog titles use 24px, and values use 20 or 24px. No weight beyond 400, 600 and 700 is requested.

Headings balance their lines, prose uses `text-wrap: pretty`, and longer explanatory copy is capped around 56–75ch where it spans a wide container. ETH values use tabular numerals. Stats may show six fractional places, with exact balances disclosed separately; individual stakes, claims, review values and full addresses remain available without ellipsis. Amount inputs are 24px; the other fields remain at least 16px to avoid mobile input zoom. Full addresses and hashes wrap anywhere.

## Layout

`.wrap` caps content at 1120px with 32px page margins on each side. Desktop uses a 1.08:1 market grid and a 64px gap, then a full-width position strip, two columns for evidence/questions and three for rules. Spaces of 8–12px group fields; 20–32px separate local groups; 40–48px separate major sections.

At 60rem and below, the main column gap is 32px, the ticket padding is 24px, and the position action moves below its values. At 45rem and below, page margins are 16px, grids become one column, the title is 32px, the header is compact, and the auxiliary wordmark/network label are hidden. The header can wrap under text enlargement. The trading panel has 20px padding; below 22rem it uses 16px padding and a 16px panel heading.

The phone order is wallet, product, state/pot, prediction, stake, primary action, risks, timeline, pool reads, position, resolution and rules. There is no fixed control covering content. Statuses and errors stay beside their action. Observed production reflow was checked at 320, 390, 720 and 1440 CSS pixels, including long balances and full addresses. The 390×844 first screen contains the wallet, product, stake controls and primary button. A 200% root-text test was performed; it is not browser-native zoom.

## Elevation & Depth

The page is flat. A border defines the main ticket and form edges; rules and secondary regions use spacing and thin dividers. No surface combines a shadow with a border, and content sections are not stacked as nested cards. The native modal top layer supplies elevation over a translucent backdrop; no application z-index stack is needed for it. The skip link uses z-index 10 only when focused.

## Shapes

The trading panel and desktop dialogs use a 12px radius; inputs, secondary actions, primary actions and wallet rows use 6px. Small shortcut buttons use 4px; status dots and radio indicators are circular. Dialogs become full-width bottom sheets below 45rem, with square bottom corners and safe-area bottom padding. Critical text is never clipped to a decorative shape.

## Components

| Component or pattern | Source | Reuse and behavior |
| --- | --- | --- |
| `Dialog` | `web/src/components.tsx:6` | Native dialog with a title, close button, Escape/backdrop dismissal, focus containment and explicit focus return. Used for wallet selection and transaction review. |
| `AddressView` | `web/src/components.tsx:21` | `address`, `config`, `label` props. Full checksummed address, configured explorer link, copy button, and an announced clipboard result/fallback. |
| `WalletSheet` | `web/src/components.tsx:37` | Receives the active wallet and runtime config. Named EIP-6963 rows or mobile app links, local wallet marks, per-row opening state, rejection text and disconnect. Its `useWallet` state in `web/src/wallet.ts` reconnects by stable reverse-DNS identity across page-session UUID changes. |
| Trade ticket | `web/src/App.tsx`, `.trade-panel` | Public pot/state, native YES/NO radio group, labeled decimal ETH input, shortcut values, changing-return explanation and reviewed bet action. Both radio headings align to the top even when captions wrap. |
| Primary/secondary/text actions | `web/src/style.css` | `.primary` uses lime fill; `.secondary` uses an outlined neutral treatment; `.text-button` uses an underlined label. Minimum heights are 48/44/44px. Shortcuts are 40px and spaced apart. |
| Market data | `web/src/App.tsx`, `.data-list`, `.position-values` | Description lists for totals, question state, precise balances and claims. Long numeric values wrap. Loading, stale, read-failure and empty states make no claim to live values they have not loaded. |
| Transaction feedback | `web/src/App.tsx`, `.action-feedback` | Persistent status near the affected control, explorer link once a hash exists, a retry-confirmation control for unknown receipt state, and dismissal after a final result. Other contract actions remain locked while it is pending. |
| Question list | `web/src/App.tsx`, `.question-list` | Asking account, time, verdict and settlement action; eight question details per page, with an explicit ID form below. Empty state explains how questions appear. |

Every form control has a visible label. Native radio buttons support arrow keys. `:focus-visible` uses the purple perimeter; the hidden radio transfers that perimeter to its visible label. Errors bind to fields via `aria-describedby`/`aria-invalid`, routine feedback uses status regions, and the page begins with a skip link. Focus is preserved in forced-colors mode with `Highlight`.

Hover backgrounds are gated by pointer capability. Color/transform transitions are 120ms; a 0.96 press scale exists only when reduced motion is not requested. There are no infinite animations or page-load entrances.

## Do's and Don'ts

- Start another surface with `.wrap`, existing heading sizes, description lists and native form controls. Keep the main contract task above explanations.
- Reuse `Dialog`, `AddressView` and the button variants. Use the runtime config passed from `src/config.ts` for every chain/explorer/contract reference.
- Keep ETH units, current eligibility, exact values, transaction consequences and oracle risks visible or explicitly disclosed. A stake-share bar must not be labeled a release probability.
- Keep filled lime for the primary action. YES/NO background colors express choice, with text and native checked state as redundant cues.
- Preserve whitespace hierarchy, wrapping and focus perimeter. Do not introduce a new type scale, tracked capital labels, fixed overlays, fake price context or cropped addresses.
- A new page should reuse the token file and shared components, preserve static/hash navigation, then repeat the mobile, keyboard, error-state and deployment verification checks.

Design guidance and documentation-method licenses are retained in `docs/frontend/better-interface-LICENSE.txt`; see `web/README.md` for attribution and the validation record for coverage limitations.
