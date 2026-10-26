import { act, renderHook } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { useMediaQuery } from './use-media-query';

it.each(['48rem', '64rem', '80rem'])('keeps one subscription across renders at %s, follows changes, and cleans up', (width) => {
  const lists = new Map<string, MediaQueryList>();
  const add = vi.fn();
  const remove = vi.fn();
  vi.spyOn(window, 'matchMedia').mockImplementation((query) => {
    if (!lists.has(query)) {
      const target = new EventTarget();
      const subscribe = target.addEventListener.bind(target);
      const unsubscribe = target.removeEventListener.bind(target);
      lists.set(query, Object.assign(target, {
        matches: false, media: query, onchange: null,
        addListener: vi.fn(), removeListener: vi.fn(),
        addEventListener: (...args: Parameters<typeof subscribe>) => { add(...args); subscribe(...args); },
        removeEventListener: (...args: Parameters<typeof unsubscribe>) => { remove(...args); unsubscribe(...args); },
      }));
    }
    return lists.get(query)!;
  });
  const query = `(min-width: ${width})`;
  const view = renderHook(({ query }) => useMediaQuery(query), { initialProps: { query } });
  view.rerender({ query });
  view.rerender({ query });
  console.info('media-query subscriptions after mount + 2 renders:', add.mock.calls.length);
  expect(add).toHaveBeenCalledTimes(1);
  const list = lists.get(query)!;
  act(() => {
    Object.assign(list, { matches: true });
    list.dispatchEvent(new Event('change'));
  });
  expect(view.result.current).toBe(true);
  view.rerender({ query: '(min-width: 90rem)' });
  expect(view.result.current).toBe(false);
  expect(add).toHaveBeenCalledTimes(2);
  expect(remove).toHaveBeenCalledTimes(1);
  expect(remove.mock.calls[0]).toEqual(add.mock.calls[0]);
  view.unmount();
  expect(remove).toHaveBeenCalledTimes(2);
  expect(remove.mock.calls[1]).toEqual(add.mock.calls[1]);
});
