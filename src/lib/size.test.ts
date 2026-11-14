import { describe, expect, it } from 'vitest';
import { formatByteSize, formatBytes } from './size';

describe('formatByteSize', () => {
  it('keeps bytes exact below one KiB', () => {
    expect(formatByteSize(0n, 'en-US')).toBe('0 bytes');
    expect(formatByteSize(1023n, 'en-US')).toBe('1,023 bytes');
  });

  it('uses binary units with one decimal below ten', () => {
    expect(formatByteSize(1024n, 'en-US')).toBe('1 KiB');
    expect(formatByteSize(1536n, 'en-US')).toBe('1.5 KiB');
    expect(formatByteSize(1024n * 1024n * 3n, 'en-US')).toBe('3 MiB');
    expect(formatByteSize(1024n ** 4n * 652n, 'en-US')).toBe('652 TiB');
  });

  it('rounds values at or above ten to whole units', () => {
    expect(formatByteSize(1024n * 12n, 'en-US')).toBe('12 KiB');
  });

  it('formats the exact count with the long unit', () => {
    expect(formatBytes(9_007_199_254_740_993n, 'en-US')).toBe('9,007,199,254,740,993 bytes');
  });
});
