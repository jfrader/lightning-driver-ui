import examples from '../../contract/examples.v1.json';
import { EXAMPLE_GAPS } from './example-gaps';

type Fixtures = (typeof examples)['fixtures'];
export type FixtureName = keyof Fixtures;
type Gaps = typeof EXAMPLE_GAPS;
type Fixture<T extends FixtureName> = Fixtures[T]['value'] & (T extends keyof Gaps ? Gaps[T] : unknown);

const gaps: Partial<Record<FixtureName, object>> = EXAMPLE_GAPS;

/** A fresh copy of a frozen contract fixture, safe to modify in one test. */
export function fixture<T extends FixtureName>(name: T): Fixture<T> {
  return { ...structuredClone(examples.fixtures[name].value), ...gaps[name] } as Fixture<T>;
}
