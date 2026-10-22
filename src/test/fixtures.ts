import examples from '../../contract/examples.v1.json';

type Fixtures = (typeof examples)['fixtures'];
export type FixtureName = keyof Fixtures;

/** A fresh copy of a frozen contract fixture, safe to modify in one test. */
export function fixture<T extends FixtureName>(name: T): Fixtures[T]['value'] {
  return structuredClone(examples.fixtures[name].value);
}
