import type { StateLabel } from './StateWord';

/** The plain words of a state vocabulary, e.g. for a filter select. */
export function labelsOf<K extends string>(states: Record<K, StateLabel>): Record<K, string> {
  const entries = Object.entries<StateLabel>(states).map(([key, state]) => [key, state.label]);
  return Object.fromEntries(entries) as Record<K, string>;
}
