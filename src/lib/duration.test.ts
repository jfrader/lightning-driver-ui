import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatDurationSeconds } from './duration';

const EN = 'en-US';

describe('durations', () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each([
    [60, '1 minute'],
    [3600, '1 hour'],
    [5400, '1 hour, 30 minutes'],
    [86_400, '24 hours'],
    [61, '1 minute, 1 second'],
  ])('formats %s seconds as %s', (seconds, expected) => {
    expect(formatDurationSeconds(seconds, EN)).toBe(expected);
  });

  it('falls back to an Intl seconds count where DurationFormat is missing', () => {
    vi.stubGlobal('Intl', { ...Intl, DurationFormat: undefined, NumberFormat: Intl.NumberFormat });
    expect(formatDurationSeconds(5400, EN)).toBe('5,400 seconds');
  });
});
