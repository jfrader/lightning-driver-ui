import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useDeadlineNow, useNow } from './use-now';

function Clock({ name }: { name: string }) {
  const now = useNow();
  return <output aria-label={name}>{now}</output>;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('shared display clock', () => {
  it('shares one interval, pauses while hidden, refreshes on return and stops after the last subscriber', () => {
    vi.useFakeTimers();
    const interval = vi.spyOn(window, 'setInterval');
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    const initial = Date.now();
    const view = render(<><Clock name="one" /><Clock name="two" /></>);
    expect(interval).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(1);
    act(() => vi.advanceTimersByTime(15_000));
    expect(screen.getByLabelText('one')).toHaveTextContent(String(initial + 15_000));
    expect(screen.getByLabelText('two')).toHaveTextContent(String(initial + 15_000));

    hidden.mockReturnValue(true);
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(vi.getTimerCount()).toBe(0);
    act(() => vi.advanceTimersByTime(60_000));
    expect(screen.getByLabelText('one')).toHaveTextContent(String(initial + 15_000));
    hidden.mockReturnValue(false);
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(screen.getByLabelText('one')).toHaveTextContent(String(initial + 75_000));
    expect(vi.getTimerCount()).toBe(1);
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('uses real time for newly rendered data between display ticks', () => {
    const view = render(<Clock name="one" />);
    const later = Date.now() + 5_000;
    vi.setSystemTime(later);
    view.rerender(<Clock name="one" />);
    expect(screen.getByLabelText('one')).toHaveTextContent(String(later));
  });
});

it('updates an action deadline at the exact millisecond, even while hidden', () => {
  vi.useFakeTimers();
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
  const deadline = Date.now() + 1_234;
  function Action() {
    const now = useDeadlineNow(new Date(deadline).toISOString());
    return <button disabled={now >= deadline}>Confirm</button>;
  }
  const view = render(<Action />);
  act(() => vi.advanceTimersByTime(1_233));
  expect(screen.getByRole('button')).toBeEnabled();
  act(() => vi.advanceTimersByTime(1));
  expect(screen.getByRole('button')).toBeDisabled();
  view.unmount();
  expect(vi.getTimerCount()).toBe(0);
});
