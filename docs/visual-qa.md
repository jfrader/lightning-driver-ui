# Visual QA inventory

Use isolated Chromium contexts and synthetic contract data, never a live node or a real credential. Screenshots are review evidence under `/tmp/lightning-driver-qa/<run>/`, not assertions or committed assets. `npm run verify` runs the existing browser job; `npm run screenshots` captures the README examples separately. Neither command alone completes the manual matrix. Serve a run-owned build directory: the collector must not read the repository's `dist` while another verification command replaces its chunks.

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
| Operations | `/operations`, `/operations/<id>` | same list states; awaiting confirmation, pending, unknown, failed, succeeded, historical/unconfigured node, result/copy controls, immutable review and node payment record; every form kind's review/confirmation action at enlarged text size |
| Forms | `/payments/new`, `/invoices/new`, `/onchain/send`, `/onchain/receive`, `/peers/new`, `/channels/new`, `/channels/<id>/close` | initial, filled, validation errors, loading/error policy, disabled/read-only capability, review, submitting and submission feedback; payment decode error; fee estimates missing/stale/outside bounds |
| Palette | Ctrl+K or desktop Go to | empty query, filtered results, no results, arrow navigation/Enter, Escape and focus return; scroll first/last result |
| Shared shell | all above; chooser; `/fleet`, `/more` | phone tabs and sibling links; desktop rail/status strip; chooser open; theme/unit choices; long node label; unresolved count |
| Authentication / route errors | `/login`, unknown/error route, `/nodes/<unconfigured-id>` | signed out, bootstrap loading/error, enrollment, unavailable sign-in, session loss, retry notices; global unknown-route output and the missing-node fallback are distinct states; no node-only tabs expected |
| Bitcoin monitoring | `/nodes/bitcoin-lab`, `/peers` | populated, loading, empty/error, warning/mismatch/IBD, long inspector, pagination/expiry, unavailable Lightning destination |
| Watchtower | `/watchtower`, `/watchtower/server` | populated, loading, empty/error, unavailable capability, tower inspector, session truncation |

The shared `Section`, `WorkLayout`, `ListPager`, `PagedList` and `ErrorNotice` have consumers outside Bitcoin/watchtower. Do not treat monitoring-only evidence as coverage of Lightning, forms, operation reviews, More or sign-in.

## Fixtures and checks

Reuse `tests/browser/synthetic-api.ts` and `monitoring-api.ts`: fixed clock `2026-10-21T12:01:00Z`, UTC, synthetic session/policy/node responses, isolated storage and an external-network abort boundary. The synthetic API returns a distinct unresolved payment and three channel balance states. For list variants, override only that list's HTTP response: empty `items`, a retryable error, `cursor_expired`, `next_cursor`/`truncated`, or a gated loading response. Verify that the intended variant is visible before recording it. A long invoice description must open in the inspector in full.

For each cell record document overflow (≤1px), visible right edge with ancestor clipping accounted for, control-centre hit tests after real scrolling, ≥44×44 targets below 768px, clipped text/line clamps, keyboard reachability under fixed/sticky UI, and axe critical/serious findings including overlays. A table may scroll horizontally inside its own labelled, keyboard-focusable scroller; it may not widen the document. Scroll and tab forward/backward through both the document and nested scrollers. Inspect painted focus rings, not just `activeElement` or computed styles.

`@layout` tests in the existing browser suite protect enlarged header/control separation (including a valid large unresolved count), complete quick-action labels, inspector/fee-choice/form-action and all form-kind review geometry in en-US/de-DE, sign-in/enrollment action containment, phone keyboard clearance, desktop rail containment, and monitoring geometry. Completed-operation result details must retain usable copy targets, including at enlarged text size; phone copy targets and node chooser options meet the touch minimum. The palette keyboard journey also checks phone option hit areas. The channel-close audit uses `@axe-core/playwright` without disabling rules, at normal/hover in dark/light themes. These are not screenshot tests and do not replace truncation-intent or painted-focus review. Await the intended controls before applying the text override; doubling a loading placeholder is not enlarged-content coverage.

Desktop enlarged-text checks include status-strip unit labels and the Go to control, not only the rail: a centre hit can succeed while an adjacent label spills out of a shrunken control group. The strip wraps its facts and intrinsically sized control groups rather than compressing their labels.

## Narrow exceptions

- The hidden Node label, hidden table captions and icon-copy accessible labels use the deliberate 1×1 visually-hidden pattern. Their full text remains in the accessibility tree. This exception does not cover other clipped spans.
- The node chooser's selected-value ellipsis is intentional. Opening the chooser exposes the complete option text and accessible option name. Check the open popup separately; a closed trigger is not proof that a very long option fits.
- Invoice descriptions clamp only in list cells/rows (`InvoiceCells.tsx`). The invoice inspector shows the complete description without that clamp; the list span also carries the complete `title`. Pointer hover alone is not the alternative access: keyboard users open the invoice row.
- Shortened identifiers in list rows open inspectors with full wrapping/copyable values. Operation review identifiers retain their full copy value.
- Native single-line editable inputs can scroll long values horizontally with Home/End and arrow keys. This is not an exception for a clipped label or read-only rendered value; the exact-amount keyboard-editing browser journeys protect the full input value.
- Phone sibling navigation (`GroupLinks`) is an intentional horizontal scroller. Scroll it and Tab to both end links to read their complete labels; clipped inactive ends are not document overflow. The focused link must be revealed, not hidden behind the scroller edge.
- The skip link is deliberately off-canvas until keyboard focus. Exclude it from an unfocused control-centre scan, then inspect it painted and reachable on Tab.
- An open native modal makes background controls inert. Exclude the background, not the dialog's controls. Chromium may move focus to its browser chrome between native-dialog Tab stops; that is not an app control outside the modal.
- An open node chooser temporarily covers background content. Audit its trigger and popup options while open; close it and check the previously covered background separately. This exception does not cover an obscured popup option or a background control that remains covered after dismissal.
- A multiline inline anchor has separate hit rectangles. Test a visible fragment's centre, not empty space between lines inside their bounding-box union. This is not an exception for a button, a stretched row link or a genuinely covered fragment.
- Forced-colour contrast is **not waived**. Axe 4.14 can report author foregrounds such as `#efebe3` against forced white while the browser paints system text colours and native links. Forced values apply at paint time, not in the cascade ([MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/forced-colors)). Keep the unsuppressed findings and screenshots. The author-colour contrast calculation may be recorded N/A only when the run documents actual system-colour text/link output, including any `forced-color-adjust: none` text. Decorative status markers keep their adjacent literal status text and are not evidence about text contrast. Unresolved painted contrast remains BLOCKED; screenshots alone never turn an unsuccessful axe audit into PASS.

## Reporting

Current extended-run evidence: `/tmp/lightning-driver-qa/lightning-final-20261024/report.md`. The matrix is incomplete; `/tmp/lightning-driver-qa/lightning-final-20261024/remaining.json` enumerates every remaining width/mode, actual pagination-transition and missing-node fallback cell.

Each run records commit/dirty source, browser/version, OS, locale/timezone, fixtures, viewport heights and the text override. Keep an explicit screen × width × mode table with screenshot paths and PASS/FAIL/BLOCKED/NOT RUN; N/A requires an individual reason. Report automated measurements separately from the full protocol verdict. Define and link painted-focus, truncation-intent and locale samples for each screen/state; do not infer manual inspection from a screenshot's existence or `activeElement`. Missing manual focus, clipping, state or locale inspection is NOT RUN, even if automated geometry and axe pass. Discard malformed synthetic responses instead of counting an unexpected-response screen as the requested state. Historical-node operations use that node's historical URL and a missing registry entry, not an operation with a mismatched current-node URL. Prior monitoring evidence is at `/tmp/lightning-driver-qa/lightning-monitoring-20261023/report.md`; the Lightning supplement is at `/tmp/lightning-driver-qa/lightning-supplement-20261023/report.md`. Neither path is a blanket readiness claim.
