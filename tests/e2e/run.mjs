#!/usr/bin/env node
/**
 * Opt-in real-node e2e orchestration. Starts a disposable Polar-image regtest
 * stack (bitcoind + LND + CLN), funds it, starts the real API and UI, then runs
 * tests/e2e/real.spec.ts. Never part of `npm run verify`.
 *
 * Requirements: Docker, openssl, a built api-server. Set
 * LIGHTNING_DRIVER_BACKEND=/absolute/path/to/lightning-driver.
 */
import { execFileSync, spawn } from 'node:child_process';
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { openSync } from 'node:fs';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const UI_ROOT = path.resolve(import.meta.dirname, '..', '..');
const COMPOSE = path.join(import.meta.dirname, 'stack', 'docker-compose.yml');
const PROJECT = 'lightning-driver-e2e';
const BACKEND = process.env.LIGHTNING_DRIVER_BACKEND;
const DATA = process.env.E2E_DATA ?? `/tmp/opencode/lightning-driver-e2e-${Date.now()}`;
const KEEP = process.env.E2E_KEEP === '1';
const API_PORT = 8080;
const UI_PORT = 5174;
const env = { ...process.env, E2E_DATA: DATA };
const children = [];

if (!BACKEND || !existsSync(path.join(BACKEND, 'target/release/api-server'))) {
  console.error('Set LIGHTNING_DRIVER_BACKEND to a checkout with target/release/api-server built.');
  process.exit(2);
}
if (existsSync(DATA)) rmSync(DATA, { recursive: true, force: true });
mkdirSync(path.join(DATA, 'certs'), { recursive: true, mode: 0o700 });
mkdirSync(path.join(DATA, 'lnd'), { recursive: true, mode: 0o700 });

const sh = (file, args, options = {}) =>
  execFileSync(file, args, { env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...options }).trim();
const docker = (args, options = {}) => sh('docker', ['compose', '-p', PROJECT, '-f', COMPOSE, ...args], options);
const openssl = (args) => sh('openssl', args);

function start(name, file, args, cwd, log) {
  const fd = openSync(log, 'a');
  const child = spawn(file, args, {
    cwd,
    env,
    detached: false,
    stdio: ['ignore', fd, fd],
  });
  children.push({ name, child, log });
  return child;
}

async function waitFor(label, fn, seconds = 120) {
  const end = Date.now() + seconds * 1000;
  let last;
  while (Date.now() < end) {
    try {
      const value = await fn();
      if (value !== false && value !== undefined) return value;
    } catch (error) {
      last = error;
    }
    await sleep(500);
  }
  throw new Error(`${label} did not become ready${last ? `: ${last.message}` : ''}`);
}

async function free(port) {
  try {
    await fetch(`http://localhost:${port}/`, { signal: AbortSignal.timeout(1000) });
    return false;
  } catch {
    return true;
  }
}

function certs() {
  openssl(['req', '-x509', '-newkey', 'rsa:2048', '-nodes',
    '-keyout', path.join(DATA, 'certs', 'ca.key'), '-out', path.join(DATA, 'certs', 'ca.crt'),
    '-days', '2', '-subj', '/CN=lightning-driver e2e CA',
    '-addext', 'basicConstraints=critical,CA:TRUE',
    '-addext', 'keyUsage=critical,keyCertSign,cRLSign']);
  openssl(['req', '-newkey', 'rsa:2048', '-nodes',
    '-keyout', path.join(DATA, 'certs', 'lnd.key'), '-out', path.join(DATA, 'certs', 'lnd.csr'),
    '-subj', '/CN=localhost']);
  writeFileSync(path.join(DATA, 'certs', 'lnd.ext'),
    'subjectAltName=DNS:localhost,DNS:lnd1,IP:127.0.0.1\nextendedKeyUsage=serverAuth\nkeyUsage=critical,digitalSignature,keyEncipherment\n');
  openssl(['x509', '-req', '-in', path.join(DATA, 'certs', 'lnd.csr'),
    '-CA', path.join(DATA, 'certs', 'ca.crt'), '-CAkey', path.join(DATA, 'certs', 'ca.key'),
    '-CAcreateserial', '-out', path.join(DATA, 'certs', 'lnd.crt'), '-days', '2',
    '-extfile', path.join(DATA, 'certs', 'lnd.ext')]);
  copyFileSync(path.join(DATA, 'certs', 'lnd.crt'), path.join(DATA, 'lnd', 'tls.cert'));
  copyFileSync(path.join(DATA, 'certs', 'lnd.key'), path.join(DATA, 'lnd', 'tls.key'));
  chmodSync(path.join(DATA, 'lnd', 'tls.cert'), 0o644);
  chmodSync(path.join(DATA, 'lnd', 'tls.key'), 0o600);
  chmodSync(path.join(DATA, 'certs', 'ca.crt'), 0o644);
}

async function main() {
  if (!(await free(API_PORT)) || !(await free(UI_PORT))) {
    throw new Error(`ports ${API_PORT} and ${UI_PORT} must be free`);
  }
  certs();
  writeFileSync(path.join(DATA, 'compose.log'), '');
  docker(['down', '-v', '--remove-orphans'], { stdio: ['ignore', 'pipe', 'pipe'] });
  docker(['up', '-d']);
  await waitFor('bitcoind', () => docker(['exec', '-T', 'bitcoind', 'bitcoin-cli', '-regtest', '-rpcuser=polar', '-rpcpassword=polar', 'getblockchaininfo']));
  await waitFor('lnd', () => docker(['exec', '-T', 'lnd', 'lncli', '--lnddir=/home/lnd/.lnd', '--network=regtest', 'getinfo']));
  await waitFor('cln', () => docker(['exec', '-T', 'cln', 'lightning-cli', '--lightning-dir=/home/clightning/.lightning', '--network=regtest', 'getinfo']));
  await waitFor('cln REST certificate', () => existsSync(path.join(DATA, 'cln', 'certs', 'ca.pem')));

  try { docker(['exec', '-T', 'bitcoind', 'bitcoin-cli', '-regtest', '-rpcuser=polar', '-rpcpassword=polar', 'createwallet', 'e2e']); } catch {}
  const btc = (args) => docker(['exec', '-T', 'bitcoind', 'bitcoin-cli', '-regtest', '-rpcuser=polar', '-rpcpassword=polar', '-rpcwallet=e2e', ...args]);
  const mine = (n, address) => btc(['generatetoaddress', String(n), address]);
  const newAddress = () => btc(['getnewaddress']);
  mine(101, newAddress());

  const lnd = (args) => docker(['exec', '-T', 'lnd', 'lncli', '--lnddir=/home/lnd/.lnd', '--network=regtest', ...args]);
  const cln = (args) => docker(['exec', '-T', 'cln', 'lightning-cli', '--lightning-dir=/home/clightning/.lightning', '--network=regtest', ...args]);
  const lndInfo = JSON.parse(lnd(['getinfo']));
  const clnInfo = JSON.parse(cln(['getinfo']));
  btc(['sendtoaddress', JSON.parse(lnd(['newaddress', 'p2wkh'])).address, '5']);
  btc(['sendtoaddress', JSON.parse(cln(['newaddr'])).bech32, '2']);
  mine(1, newAddress());
  await waitFor('lnd synced', () => JSON.parse(lnd(['getinfo'])).synced_to_chain === true);
  await waitFor('cln funded', () => JSON.parse(cln(['listfunds'])).outputs.length > 0);
  lnd(['connect', `${clnInfo.id}@cln:9735`]);

  const rune = JSON.parse(cln(['createrune'])).rune;
  writeFileSync(path.join(DATA, 'cln', 'rune'), `${rune}\n`, { mode: 0o600 });
  chmodSync(path.join(DATA, 'lnd', 'data/chain/bitcoin/regtest/admin.macaroon'), 0o600);

  const policy = {
    create_invoice_msat: { min: '1', max: '100000000000' },
    pay_invoice_msat: { min: '1', max: '10000000000' },
    open_channel_sat: { min: '100000', max: '16000000' },
    send_onchain_sat: { min: '1000', max: '100000000' },
    fee_rate_sat_vbyte: { min: '1', max: '100' },
    max_routing_fee_msat: '1000000',
    default_max_routing_fee_msat: '1000',
    invoice_expiry_seconds: { min: 60, max: 86400, default: 3600 },
  };
  const peer = { allowed_hosts: ['cln', 'lnd', 'localhost'], allowed_ports: [9735] };
  const node = (id, label, backend, endpoint, cert, cred, pub) => ({
    id, label, backend, endpoint,
    certificate_file: cert, credential_file: cred,
    expected_pubkey: pub, network: 'regtest', read_only: false,
    policy, peer_policy: peer,
  });
  const config = {
    api: {
      bind: `127.0.0.1:${API_PORT}`,
      public_origin: `http://localhost:${UI_PORT}`,
      rp_id: 'localhost',
      database: 'manager.sqlite',
      invoice_key_file: 'invoice.key',
      allow_insecure_loopback: true,
      reauth: { mode: 'every_operation' },
      limits: { rpc_seconds: 30, preauth_seconds: 3600, session_idle_seconds: 3600, session_absolute_seconds: 28800 },
    },
    nodes: [
      node('lnd-grpc', 'Polar LND gRPC', 'lnd_grpc', 'https://localhost:10009',
        path.join(DATA, 'certs', 'ca.crt'),
        path.join(DATA, 'lnd/data/chain/bitcoin/regtest/admin.macaroon'), lndInfo.identity_pubkey),
      node('lnd-rest', 'Polar LND REST', 'lnd_rest', 'https://localhost:8081',
        path.join(DATA, 'certs', 'ca.crt'),
        path.join(DATA, 'lnd/data/chain/bitcoin/regtest/admin.macaroon'), lndInfo.identity_pubkey),
      node('cln', 'Polar CLN', 'cln_rest', 'https://localhost:3011',
        path.join(DATA, 'cln', 'certs', 'ca.pem'),
        path.join(DATA, 'cln', 'rune'), clnInfo.id),
    ],
  };
  const configPath = path.join(DATA, 'config.json');
  writeFileSync(configPath, JSON.stringify(config, null, 2), { mode: 0o600 });

  const uiLog = path.join(DATA, 'ui.log');
  start('ui', process.execPath, ['node_modules/vite/bin/vite.js', '--host', 'localhost', '--port', String(UI_PORT), '--strictPort'], UI_ROOT, uiLog);
  await waitFor('ui', async () => (await fetch(`http://localhost:${UI_PORT}/`, { signal: AbortSignal.timeout(1000) })).status === 200);

  const apiLog = path.join(DATA, 'api.log');
  start('api', path.join(BACKEND, 'target/release/api-server'), ['serve', '--config', configPath], BACKEND, apiLog);
  await waitFor('api', async () => {
    const response = await fetch(`http://localhost:${UI_PORT}/api/v1/auth/bootstrap`, { signal: AbortSignal.timeout(1000) });
    return response.status === 200;
  });
  const token = execFileSync(path.join(BACKEND, 'target/release/api-server'),
    ['auth', 'enrollment', '--config', configPath], { encoding: 'utf8' }).trim();
  if (!/^[0-9a-f]{64}$/.test(token)) throw new Error('enrollment token was not issued');

  const test = spawn('npx', ['playwright', 'test', '--config', 'tests/e2e/playwright.config.ts'], {
    cwd: UI_ROOT,
    env: {
      ...env,
      E2E_BASE_URL: `http://localhost:${UI_PORT}`,
      E2E_TOKEN: token,
      E2E_PROJECT: PROJECT,
      E2E_COMPOSE_FILE: COMPOSE,
      E2E_DATA: DATA,
      E2E_LND_PUBKEY: lndInfo.identity_pubkey,
      E2E_CLN_PUBKEY: clnInfo.id,
    },
    stdio: 'inherit',
  });
  const code = await new Promise((resolve) => test.on('exit', resolve));
  if (code !== 0) throw new Error(`Playwright e2e exited ${code}`);
}

let failed = false;
try {
  await main();
} catch (error) {
  failed = true;
  console.error(`e2e failed: ${error.message}`);
  console.error(`evidence: ${DATA}`);
} finally {
  for (const { child } of children) {
    try { child.kill('SIGTERM'); } catch {}
  }
  await sleep(1000);
  for (const { child } of children) {
    try { child.kill('SIGKILL'); } catch {}
  }
  try { docker(['down', '-v', '--remove-orphans'], { stdio: ['ignore', 'pipe', 'pipe'] }); } catch {}
  if (!KEEP && !failed) rmSync(DATA, { recursive: true, force: true });
  else console.log(`kept e2e data at ${DATA}`);
}
process.exit(failed ? 1 : 0);
