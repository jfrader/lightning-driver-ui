export const API_BASE_PATH = '/api/v1';

/** Only the non-secret node identifier is remembered between visits. */
export const REMEMBERED_NODE_STORAGE_KEY = 'lightning-driver.last-node-id';

/** `undefined` uses the browser's locale for numbers, dates and relative times. */
export const DISPLAY_LOCALE: Intl.LocalesArgument = undefined;

export const REQUEST_TIMEOUT_MS = 20_000;
export const CONFIRM_TIMEOUT_MS = 30_000;
export const NODE_REFRESH_MS = 30_000;
export const READ_STALE_MS = 10_000;

export const WIDE_LAYOUT_QUERY = '(min-width: 60rem)';
export const WIDE_LAYOUT_MEDIA = `@media ${WIDE_LAYOUT_QUERY}`;
export const NARROW_LAYOUT_MEDIA = '@media (max-width: 30rem)';
export const LIGHT_SCHEME_QUERY = '(prefers-color-scheme: light)';
