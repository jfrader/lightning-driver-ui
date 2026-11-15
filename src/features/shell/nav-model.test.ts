import { describe, expect, it } from 'vitest';
import { phoneTabsFor } from './nav-model';

describe('phone tabs', () => {
  it('keeps the full set without a current node so the bar is not a lone More tab', () => {
    expect(phoneTabsFor(null).map((tab) => tab.label)).toEqual(['Fleet', 'More']);
  });
});
