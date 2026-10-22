# Real-node e2e (opt-in)

This suite runs the real API and UI against disposable Polar-image regtest
containers. It is not part of `npm run verify`.

```sh
LIGHTNING_DRIVER_BACKEND=/absolute/path/to/lightning-driver npm run test:e2e
```

Requirements: Docker, `openssl`, `/usr/bin/chromium`, and a release
`api-server` already built at `$LIGHTNING_DRIVER_BACKEND/target/release/api-server`.
The runner generates a test CA, starts bitcoind + LND + CLN, funds them, issues
an enrollment token, starts the API and Vite, then runs
`tests/e2e/real.spec.ts`. All data is disposable; `E2E_KEEP=1` keeps it on
failure.

The journey covers every read route on LND gRPC, LND REST and CLN REST, a real
CLN invoice, a real LND channel open, an LND payment to CLN, a real on-chain
send, and a channel close. Authentication uses an injected NIP-07 signer; no
real identity or credentials are involved.

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

