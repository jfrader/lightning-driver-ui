import { isKeyOf } from '../lib/guards';

const CURSOR_MAX_LENGTH = 1024;

export function cursorParam(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 && value.length <= CURSOR_MAX_LENGTH ? value : undefined;
}

/** Accepts only keys of the exhaustive label map for that filter. */
export function enumParam<T extends object>(value: unknown, labels: T): Extract<keyof T, string> | undefined {
  return isKeyOf(labels, value) ? value : undefined;
}

export function stringParam(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

export interface PagedSearch {
  cursor?: string;
}

export function pagedSearch(search: Record<string, unknown>): PagedSearch {
  return { cursor: cursorParam(search.cursor) };
}
