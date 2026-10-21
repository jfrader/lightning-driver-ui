import { describe, expect, it } from 'vitest';
import { fixture } from '../test/fixtures';
import { AuthBootstrap, NodeSummary, Operation, Session } from './generated/validators';

const LABEL_MAX_LENGTH = 120;
const NON_BMP = '\u{1F600}';

describe('generated contract validators', () => {
  it('accept the frozen fixtures', () => {
    expect(Session(fixture('session'))).toBe(true);
    expect(Operation(fixture('operation_review'))).toBe(true);
    expect(AuthBootstrap(fixture('bootstrap'))).toBe(true);
    expect(NodeSummary(fixture('node_lnd'))).toBe(true);
  });

  it.each(['2026-10-21', 'not-a-date', '2026-13-40T25:00:00Z'])('reject the date-time %j', (value) => {
    expect(Session({ ...fixture('session'), expires_at: value })).toBe(false);
  });

  it.each(['not-a-uuid', '00000000-0000-4000-8000-00000000010'])('reject the UUID %j', (value) => {
    expect(Operation({ ...fixture('operation_review'), id: value })).toBe(false);
  });

  it.each(['not a uri', 'manager.example.invalid'])('reject the URI %j', (value) => {
    expect(AuthBootstrap({ ...fixture('bootstrap'), public_origin: value })).toBe(false);
  });

  it('count string length in code points, so non-BMP characters count once', () => {
    expect(NodeSummary({ ...fixture('node_lnd'), label: NON_BMP.repeat(LABEL_MAX_LENGTH) })).toBe(true);
    expect(NodeSummary({ ...fixture('node_lnd'), label: NON_BMP.repeat(LABEL_MAX_LENGTH + 1) })).toBe(false);
  });
});
