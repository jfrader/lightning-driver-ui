# Real-node e2e (opt-in)

This suite runs the real API and UI against disposable Polar-image regtest
containers. It is not part of `npm run verify`.

```sh
LIGHTNING_DRIVER_BACKEND=/absolute/path/to/lightning-driver npm run test:e2e
# Passkey scenario only (also starts and tears down the regtest stack):
LIGHTNING_DRIVER_BACKEND=/absolute/path/to/lightning-driver npm run test:e2e:passkey
```

Requirements: Docker with Compose, `openssl`, Chromium installed by
`npx playwright install chromium` (or `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`), and a release
`api-server` already built at `$LIGHTNING_DRIVER_BACKEND/target/release/api-server`.
Build it from the backend checkout with `CARGO_BUILD_JOBS=2 cargo build --release -p api-server`.
The runner generates a test CA, starts bitcoind + LND + CLN, funds them, issues
a fresh host enrollment token per scenario using `api-server auth enrollment --config …`,
starts the API and Vite, then runs both scenarios in `tests/e2e/real.spec.ts`.
All data is disposable; failures always keep their data and print its location.
`E2E_KEEP=1` also keeps data on success. Enrollment tokens are never logged.
The API defaults to port 8080; set `E2E_API_PORT` if another local API uses it.
The UI uses port 5174. Both ports must be free.

The first scenario uses Chromium's CDP WebAuthn virtual authenticator (CTAP2,
internal transport, resident-key support and user verification). It enrolls through
the real `/login` UI, signs out, signs back in with the same credential without
re-enrollment, reads the LND node overview and reloads it with the same session.
No WebAuthn or API response is stubbed on the successful path. Negative checks
reject `navigator.credentials.get` to simulate cancellation and ask the virtual
authenticator for a bogus assertion signature: neither may establish a session
or silently fall back to Nostr. The Rust API must reject the bogus signature with
`authentication_failed`, and the UI must show the failed sign-in.

The second, Nostr journey covers every read route on LND gRPC, LND REST and CLN REST; the
eight mutation kinds through LND gRPC and LND REST; a real CLN invoice;
`fundchannel` and `xpay` through the CLN adapter; a cooperative CLN `close`; and
two channel open/close cycles. Its authentication uses an injected NIP-07 signer; no
real identity or credentials are involved.

`polarlightning/clightning:25.12` cannot fund a channel in this stack: its
`fundchannel` broadcast is rejected by bitcoind 29 with
`mandatory-script-verify-flag-failed (OP_EQUALVERIFY)`. The compose file pins
`25.09.3`, which funds and pays against the same bitcoind.

CLN needs the peer online to close cooperatively: `close` without
`unilateraltimeout` (the adapter's choice) negotiates the closing fee. A dropped
link makes CLN broadcast the commitment instead, and that channel then stays
onchain through its CSV delay. The suite connects and waits for both ends
before closing.

CLN 25.09 keeps a cooperatively closed channel in `listpeerchannels` as
`ONCHAIN` with no close cause and does not list it in `listclosedchannels`, so
the adapter cannot observe the close type the contract requires. The close is
accepted and broadcast and the operation stays `pending`; the suite asserts that
honest projection.

CLN's `channeld` occasionally dies under load. The node then fails the payment
and the operation correctly stays `unknown`; the suite retries once with a fresh
invoice and reports a second failure instead of hiding it.

The suite deliberately uses a CA-signed LND certificate, so it exercises the
default `tls_verification = "ca"` mode. Stock LND ships a self-signed leaf that
rustls rejects as a CA-used-as-end-entity; `tls_verification = "pinned"` accepts
exactly that certificate while still verifying its host or IP subject and its
dates, and is covered for both REST and gRPC in
`api-server/src/operations/lnd/tests.rs`. Never disable certificate or hostname
verification.

## CI

`.github/workflows/ci.yml` runs `npm run verify` on every push and pull request.
The real e2e is a manual `workflow_dispatch` job (`e2e: true`); it needs a runner
with Docker and a `LIGHTNING_DRIVER_CHECKOUT_TOKEN` secret that can read
`jfrader/lightning-driver`, because the backend checkout is a second repository.
Image digests are pinned in `tests/e2e/stack/docker-compose.yml`.
