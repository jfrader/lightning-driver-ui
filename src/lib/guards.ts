export function isKeyOf<T extends object>(map: T, key: unknown): key is Extract<keyof T, string> {
  return typeof key === 'string' && Object.hasOwn(map, key);
}

/** Keys of an exhaustive label map, typed as its key union. */
export function keysOf<T extends object>(map: T): Extract<keyof T, string>[] {
  return Object.keys(map).filter((key) => isKeyOf(map, key));
}
