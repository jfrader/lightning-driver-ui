import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@jfrader/ui';
import { describe, expect, it, vi } from 'vitest';
import { TEST_NOW } from '../test/environment';
import { Freshness } from './Freshness';

const at = (offsetSeconds: number) => new Date(TEST_NOW.getTime() + offsetSeconds * 1000).toISOString();
const renderFreshness = (observedAt: string) =>
  render(
    <ThemeProvider>
      <Freshness observedAt={observedAt} stale={false} />
    </ThemeProvider>,
  );

describe('relative age against a fixed clock', () => {
  it('reads an observation from a minute ago as such', () => {
    renderFreshness(at(-60));
    expect(screen.getByText('Observed 1 minute ago')).toBeInTheDocument();
  });

  it('reads a timestamp that arrived after the last tick as now, not in the future', () => {
    const view = renderFreshness(at(-60));
    // The clock moves on between ticks; new data arrives stamped with the present.
    vi.setSystemTime(new Date(TEST_NOW.getTime() + 5_000));
    view.rerender(
      <ThemeProvider>
        <Freshness observedAt={at(5)} stale={false} />
      </ThemeProvider>,
    );
    expect(screen.getByText('Observed now')).toBeInTheDocument();
    expect(screen.queryByText(/in \d+ seconds?/)).not.toBeInTheDocument();
  });
});
