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
