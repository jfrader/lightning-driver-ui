import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

const workflow = readFileSync('.github/workflows/ci.yml', 'utf8');

it('runs secret-free UI checks on fork PRs and reserves the credentialed job for dispatch', () => {
  const [ui, privileged] = workflow.split('  ui:')[1].split('  real-e2e:');
  expect(workflow).toContain('  pull_request:');
  expect(workflow).not.toContain('pull_request_target');
  expect(workflow).toContain('permissions:\n  contents: read');
  expect(ui).not.toMatch(/\bif:|secrets\.|self-hosted|write/);
  expect(ui).toContain('npm run verify');
  expect(privileged).toContain("if: github.event_name == 'workflow_dispatch' && inputs.e2e");
  expect(privileged).toContain('secrets.LIGHTNING_DRIVER_CHECKOUT_TOKEN');
  expect(workflow.match(/persist-credentials: false/g)).toHaveLength(3);
});

it('pins every Action and the backend checkout to a full revision', () => {
  const actions = [...workflow.matchAll(/uses: (\S+)/g)].map(match => match[1]);
  expect(actions.length).toBeGreaterThan(0);
  for (const action of actions) expect(action).toMatch(/@[a-f0-9]{40}$/);
  expect(workflow).toMatch(/repository: jfrader\/lightning-driver\n\s+ref: [a-f0-9]{40}\n/);
});

it('publishes only the host API ports on loopback; peer traffic stays on Compose', () => {
  const compose = readFileSync('tests/e2e/stack/docker-compose.yml', 'utf8');
  const publications = [...compose.matchAll(/^ {6}- "([\d.:]+)"$/gm)].map(match => match[1]);
  expect(publications).toEqual([
    '127.0.0.1:18443:18443', '127.0.0.1:10009:10009',
    '127.0.0.1:8081:8080', '127.0.0.1:3011:3010',
  ]);
  const runner = readFileSync('tests/e2e/run.mjs', 'utf8');
  for (const port of [10009, 8081, 3011]) expect(runner).toContain(`https://localhost:${port}`);
  expect(runner).toContain('@cln:9735');
});
