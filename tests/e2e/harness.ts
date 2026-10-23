import { execFileSync } from 'node:child_process';

export function enrollmentToken() {
  const binary = process.env.E2E_BACKEND_BINARY;
  const config = process.env.E2E_CONFIG;
  if (!binary || !config) throw new Error('Run this suite through npm run test:e2e');
  const token = execFileSync(binary, ['auth', 'enrollment', '--config', config], { encoding: 'utf8' }).trim();
  if (!/^[0-9a-f]{64}$/.test(token)) throw new Error('Invalid enrollment token');
  return token;
}

export function composeCommand(...args: string[]) {
  const project = process.env.E2E_PROJECT;
  const file = process.env.E2E_COMPOSE_FILE;
  if (!project || !file || !process.env.E2E_DATA) throw new Error('Compose environment missing; use the e2e runner');
  return execFileSync('docker', ['compose', '-p', project, '-f', file, ...args], {
    encoding: 'utf8', env: process.env, timeout: 60_000,
  }).trim();
}
