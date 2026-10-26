import { isKeyOf } from '../lib/guards';

const CURSOR_MAX_LENGTH = 1024;

export const booleanCodec = {
  parse: (value: unknown): boolean => value === 1 || value === '1',
  serialize: (value: boolean): 1 | undefined => value ? 1 : undefined,
};

export function booleanParam(value: unknown): 1 | undefined {
  return booleanCodec.serialize(booleanCodec.parse(value));
}

const OPERATION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function operationIdParam(value: unknown): string | undefined {
  return typeof value === 'string' && OPERATION_ID.test(value) ? value : undefined;
}

export const MONEY_ACTIONS = { send: ['pay_invoice', 'send_onchain'], receive: ['create_invoice', 'new_address'] } as const;
export type MoneyAction = (typeof MONEY_ACTIONS)[keyof typeof MONEY_ACTIONS][number];

export interface MoneySearch {
  send?: 1;
  receive?: 1;
  operation?: string;
  action?: MoneyAction;
  confirmation?: 'unanswered';
}

export function moneySearch(search: Record<string, unknown>): MoneySearch {
  const operation = operationIdParam(search.operation);
  const send = operation ? undefined : booleanParam(search.send);
  const receive = operation || send ? undefined : booleanParam(search.receive);
  const actions = send ? MONEY_ACTIONS.send : MONEY_ACTIONS.receive;
  const action = send || receive ? actions.find((candidate) => candidate === search.action) : undefined;
  return {
    send, receive, operation,
    action,
    confirmation: search.confirmation === 'unanswered' ? 'unanswered' as const : undefined,
  };
}

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

const HASH32 = /^[0-9a-f]{64}$/;

/** A 32-byte hex hash (payment hash), or nothing. */
export function hashParam(value: unknown): string | undefined {
  return typeof value === 'string' && HASH32.test(value) ? value : undefined;
}

const PUBKEY = /^0[23][0-9a-f]{64}$/;

/** A compressed node public key (peer), or nothing. */
export function pubkeyParam(value: unknown): string | undefined {
  return typeof value === 'string' && PUBKEY.test(value) ? value : undefined;
}

export function decimalParam(value: unknown): string | undefined {
  const text = typeof value === 'number' && Number.isSafeInteger(value) ? String(value) : value;
  return typeof text === 'string' && /^(0|[1-9][0-9]*)$/.test(text) ? text : undefined;
}

const RESOURCE_ID_MAX_LENGTH = 256;

/** An opaque resource id from the server (channel id), or nothing. */
export function resourceIdParam(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 && value.length <= RESOURCE_ID_MAX_LENGTH ? value : undefined;
}

export const SORT_DIRECTIONS = { asc: 'Ascending', desc: 'Descending' } as const;
export type SortDirection = keyof typeof SORT_DIRECTIONS;

export interface SortSearch<T extends string> {
  sort?: T;
  dir?: SortDirection;
}

/** Client-side sort of the loaded snapshot, kept in the URL; only the list's own columns are accepted. */
export function sortSearch<T extends object>(
  search: Record<string, unknown>,
  columns: T,
): SortSearch<Extract<keyof T, string>> {
  const sort = enumParam(search.sort, columns);
  return { sort, dir: sort ? enumParam(search.dir, SORT_DIRECTIONS) : undefined };
}

export interface PagedSearch {
  cursor?: string;
}

export function pagedSearch(search: Record<string, unknown>): PagedSearch {
  return { cursor: cursorParam(search.cursor) };
}
