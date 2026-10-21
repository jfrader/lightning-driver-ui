export const API_BASE_PATH = '/api/v1';

/** Browser storage holds only these non-secret preferences: the last node ID and the theme choice. */
export const REMEMBERED_NODE_STORAGE_KEY = 'lightning-driver.last-node-id';
export const THEME_STORAGE_KEY = 'lightning-driver.theme';

/** `undefined` uses the browser's locale for numbers, dates and relative times. */
export const DISPLAY_LOCALE: Intl.LocalesArgument = undefined;
/** Node observations and operation times read in UTC. */
export const DISPLAY_TIME_ZONE = 'UTC';

export const REQUEST_TIMEOUT_MS = 20_000;
export const CONFIRM_TIMEOUT_MS = 30_000;
export const NODE_REFRESH_MS = 30_000;
export const READ_STALE_MS = 10_000;

export const WIDE_LAYOUT_QUERY = '(min-width: 60rem)';
export const WIDE_LAYOUT_MEDIA = `@media ${WIDE_LAYOUT_QUERY}`;
export const NARROW_LAYOUT_MEDIA = '@media (max-width: 30rem)';
export const LIGHT_SCHEME_QUERY = '(prefers-color-scheme: light)';
export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
export const REDUCED_MOTION_MEDIA = `@media ${REDUCED_MOTION_QUERY}`;

/** Desktop workbench (sidebar + status strip) from here; below it the phone header and tabs. */
export const SHELL_QUERY = '(min-width: 64rem)';
export const SIDEBAR_WIDTH = '15rem';
export const STRIP_HEIGHT = '3.25rem';
export const TAB_BAR_HEIGHT = '3.5rem';
