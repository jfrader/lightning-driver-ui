# Visual QA inventory

Use isolated Chromium contexts and synthetic contract data, never a live node or a real credential. Screenshots are review evidence under `/tmp/lightning-driver-qa/<run>/`, not assertions or committed assets. `npm run verify` runs the existing browser job; `npm run screenshots` captures the README examples separately. Neither command alone completes the manual matrix.

## Viewports and text size

- Portrait: 320×844, 375×844, 390×844, 768×844, 1024×1000, 1440×1000.
- Transition neighbours: 479/480/481×844, 767/768/769×844, 1023×844 and 1025×1000, 1279/1280/1281×1000. These cover the 30rem narrow layout, 48rem tables, 64rem shell and 80rem aside transitions in `src/config.ts`.
- Short landscape: 844×390.
- Every applicable screen/state gets normal and 200% text-only sizing. `tests/browser/text-size.ts` snapshots and doubles computed font sizes and finite line heights on every body descendant, including fixed-pixel text and controls. It does not change viewport, root rem dimensions, page zoom or device scale. Wait for the intended state and fonts before applying it; use a new context to restore sizing. Reapply after navigation or creation of new content.
- Copy is English only. Numbers and dates use the browser locale via `DISPLAY_LOCALE`. Render en-US and de-DE at 390 and 1440 for balance/amount/fee wrapping; this is not evidence that German is the longest of all browser-supported number locales. Any unrendered locale candidate remains an explicit gap.

## Screens and states

Paths below are relative to `/nodes/lnd-lab` unless absolute. `selected` values come from the first matching record in `contract/examples.v1.json`, never a shortened displayed identifier.

| Surface | Routes / entry | Required states |
|---|---|---|
| Lightning overview | node root | populated; loading/error/empty balances, attention and recent payments; expanded node-details disclosure; large balances and fees |
| Payments | `/payments`, `?selected=<payment_hash>` | populated, inspector, selected record absent, empty, loading, error, next/first page, expired cursor, truncated snapshot, longest valid amounts |
| Invoices | `/invoices`, `?selected=<payment_hash>` | same list states; long description; inspector with technical details expanded and complete invoice/hash |
| On-chain | `/onchain`, `?selected=<txid>` | same list states; inspector with all outputs, long addresses and fees |
| Peers | `/peers`, `?selected=<pubkey>` | same list states; inspector, long address, connected/disconnected |
| Channels | `/channels`, `?selected=<id>` | same list states; inspector, opening/active/closing, balances absent and unaccounted capacity |
| Operations | `/operations`, `/operations/<id>` | same list states; awaiting confirmation, pending, unknown, failed, succeeded, historical/unconfigured node, result/copy controls, immutable review and node payment record |
| Forms | `/payments/new`, `/invoices/new`, `/onchain/send`, `/onchain/receive`, `/peers/new`, `/channels/new`, `/channels/<id>/close` | initial, filled, validation errors, loading/error policy, disabled/read-only capability, review, submitting and submission feedback; payment decode error; fee estimates missing/stale/outside bounds |
| Palette | Ctrl+K or desktop Go to | empty query, filtered results, no results, arrow navigation/Enter, Escape and focus return; scroll first/last result |
| Shared shell | all above; chooser; `/fleet`, `/more` | phone tabs and sibling links; desktop rail/status strip; chooser open; theme/unit choices; long node label; unresolved count |
| Authentication / route errors | `/login`, unknown/error route | signed out, enrollment, unavailable sign-in, session loss, retry notices; no node-only tabs expected |
| Bitcoin monitoring | `/nodes/bitcoin-lab`, `/peers` | populated, loading, empty/error, warning/mismatch/IBD, long inspector, pagination/expiry, unavailable Lightning destination |
| Watchtower | `/watchtower`, `/watchtower/server` | populated, loading, empty/error, unavailable capability, tower inspector, session truncation |

The shared `Section`, `WorkLayout`, `ListPager`, `PagedList` and `ErrorNotice` have consumers outside Bitcoin/watchtower. Do not treat monitoring-only evidence as coverage of Lightning, forms, operation reviews, More or sign-in.

## Fixtures and checks

Reuse `tests/browser/synthetic-api.ts` and `monitoring-api.ts`: fixed clock `2026-10-21T12:01:00Z`, UTC, synthetic session/policy/node responses, isolated storage and an external-network abort boundary. The synthetic API returns a distinct unresolved payment and three channel balance states. For list variants, override only that list's HTTP response: empty `items`, a retryable error, `cursor_expired`, `next_cursor`/`truncated`, or a gated loading response. Verify that the intended variant is visible before recording it. A long invoice description must open in the inspector in full.

For each cell record document overflow (≤1px), visible right edge with ancestor clipping accounted for, control-centre hit tests after real scrolling, ≥44×44 targets below 768px, clipped text/line clamps, keyboard reachability under fixed/sticky UI, and axe critical/serious findings including overlays. A table may scroll horizontally inside its own labelled, keyboard-focusable scroller; it may not widen the document. Scroll and tab forward/backward through both the document and nested scrollers. Inspect painted focus rings, not just `activeElement` or computed styles.

`@layout` tests in the existing browser suite protect enlarged header/control separation, complete quick-action labels, inspector/fee-choice/form-action document geometry in en-US/de-DE, phone keyboard clearance, desktop rail containment, and monitoring geometry. The palette keyboard journey also checks phone option hit areas. The channel-close audit uses `@axe-core/playwright` without disabling rules, at normal/hover in dark/light themes. These are not screenshot tests and do not replace truncation-intent or painted-focus review.

## Narrow exceptions

- The hidden Node label, hidden table captions and icon-copy accessible labels use the deliberate 1×1 visually-hidden pattern. Their full text remains in the accessibility tree. This exception does not cover other clipped spans.
- The node chooser's selected-value ellipsis is intentional. Opening the chooser exposes the complete option text and accessible option name. Check the open popup separately; a closed trigger is not proof that a very long option fits.
- Invoice descriptions clamp only in list cells/rows (`InvoiceCells.tsx`). The invoice inspector shows the complete description without that clamp; the list span also carries the complete `title`. Pointer hover alone is not the alternative access: keyboard users open the invoice row.
- Shortened identifiers in list rows open inspectors with full wrapping/copyable values. Operation review identifiers retain their full copy value.
- Phone sibling navigation (`GroupLinks`) is an intentional horizontal scroller. Scroll it and Tab to both end links to read their complete labels; clipped inactive ends are not document overflow. The focused link must be revealed, not hidden behind the scroller edge.
- The skip link is deliberately off-canvas until keyboard focus. Exclude it from an unfocused control-centre scan, then inspect it painted and reachable on Tab.
- An open native modal makes background controls inert. Exclude the background, not the dialog's controls. Chromium may move focus to its browser chrome between native-dialog Tab stops; that is not an app control outside the modal.
- Forced-colour contrast is **not waived**. In the existing 27 monitoring cells, axe 4.14 reports author foregrounds such as `#efebe3` against forced white while screenshots paint system black/white and native blue links. Forced values apply at paint time, not in the cascade ([MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/forced-colors)). Keep those cells BLOCKED with the raw axe findings and painted evidence unless an unsuppressed audit resolves the discrepancy. Never disable the rule, force the author palette, or relabel them PASS solely from a screenshot.

## Reporting

Each run records commit/dirty source, browser/version, OS, locale/timezone, fixtures, viewport heights and the text override. Keep an explicit screen × width × mode table with screenshot paths and PASS/FAIL/BLOCKED/NOT RUN. Report automated measurements separately from the full protocol verdict. Missing manual focus, clipping, state or locale inspection is NOT RUN, even if automated geometry and axe pass. Prior monitoring evidence is at `/tmp/lightning-driver-qa/lightning-monitoring-20261023/report.md`; the Lightning supplement is at `/tmp/lightning-driver-qa/lightning-supplement-20261023/report.md`. Neither path is a blanket readiness claim.
