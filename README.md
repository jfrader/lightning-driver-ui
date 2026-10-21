# Lightning Driver UI

Browser UI for the Lightning node manager: one operator, several server-configured nodes (LND gRPC,
LND REST, Core Lightning REST), passkey sign-in, per-node read-only policy.

Vite single-page app on [@jfrader/ui](https://ui.jfrader.com) and @jfrader/tokens, TanStack Router and
TanStack Query. The Rust API server is authoritative: it holds node credentials, enforces read-only
policy, journals every operation and performs all node actions. The browser only talks to
`/api/v1` on its own origin.

## Setup

Requires Node 24 and npm.

```sh
npm ci
npm run dev
```

`npm run dev` serves on `http://127.0.0.1:5173` and proxies `/api` to a backend on loopback,
`http://127.0.0.1:8080` by default. Set `LIGHTNING_DRIVER_DEV_API_ORIGIN` to another loopback origin
(`127.0.0.1`, `localhost` or `[::1]`) if needed; any other host is refused. The backend must be
configured with the dev server's origin for its Origin and CSRF checks.

In production, build static files with `npm run build` and serve `dist/` from the same HTTPS origin as
the API, with `/api/v1/*` routed to the API server and every other path falling back to `index.html`.

## API contract

`contract/openapi.v1.json` and `contract/examples.v1.json` are consumer copies of the frozen API v1
owned by the backend (GURI-2908, Specify and implement the Lightning node-manager MVP). Do not edit
them. `npm run api:generate` checks their SHA-256 against the frozen revision and regenerates:

- `src/api/generated/schema.ts`: types (openapi-typescript 7.13.0);
- `src/api/generated/validators.js`: response and request validators (Ajv standalone with
  ajv-formats, bundled with esbuild into one self-contained ES module), so malformed amounts,
  timestamps, IDs or over-long strings are rejected before rendering.

To adopt a new frozen revision, copy both files, update the hashes in `scripts/api-contract.mjs` and
run `npm run api:generate`.

## Checks

| Command | What it does |
| --- | --- |
| `npm run api:check` | Contract snapshot hashes and generated files are current |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript project build, no emit |
| `npm run test` | Vitest behavior tests (jsdom, MSW with contract fixtures, 2 workers) |
| `npm run build` | Typecheck and production build |
| `npm run verify` | All of the above in order |

Tests mock the network boundary with the frozen contract fixtures. They do not exercise the real
backend, real passkeys or real nodes.

## Limitations

- Amounts, fee rates, expiry and port are entered in `<input type="number">` with the display locale
  as `lang`. Reading localized digits and separators is the browser's job and varies between
  browsers; the app only accepts the canonical value the browser exposes.
- Passkey ceremonies are tested with a stubbed browser helper; WebAuthn round-trips against the
  backend need browser QA.
- The bundle is one chunk (about 1 MB, 266 kB gzip), including the generated validators.
