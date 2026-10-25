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
/** Floor between session re-checks, so a client clock ahead of the server cannot spin. */
export const SESSION_RECHECK_MIN_MS = 1_000;

/** Build-time app version (P-4); `null` when the build carries none. */
// The scaffold's 0.0.0 is a placeholder, not information; hide it until a real build version exists.
export const APP_VERSION: string | null = __APP_VERSION__ && __APP_VERSION__ !== '0.0.0' ? __APP_VERSION__ : null;

/** Overview shows at most this many of the newest payments; the full list is one link away. */
export const RECENT_PAYMENTS_LIMIT = 5;
/** Composition bar heights in px: inline in lists and groups, larger in an inspector. */
export const SHARE_BAR_HEIGHT = { inline: 8, detail: 14 } as const;

/** Breakpoints are single sources: lists become tables at 48rem, the aside sits beside content at 80rem. */
export const TABLE_QUERY = '(min-width: 48rem)';
export const TABLE_MEDIA = `@media ${TABLE_QUERY}`;
export const ASIDE_QUERY = '(min-width: 80rem)';
export const ASIDE_MEDIA = `@media ${ASIDE_QUERY}`;
export const READING_WIDTH = '42rem';
export const AUTH_COLUMN_WIDTH = '24rem';
export const ASIDE_WIDTH = '20rem';
export const NARROW_LAYOUT_MEDIA = '@media (max-width: 30rem)';
export const LIGHT_SCHEME_QUERY = '(prefers-color-scheme: light)';
export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
export const REDUCED_MOTION_MEDIA = `@media ${REDUCED_MOTION_QUERY}`;

/** Desktop workbench (sidebar + status strip) from here; below it the phone header and tabs. */
export const SHELL_QUERY = '(min-width: 64rem)';
export const SIDEBAR_WIDTH = '15rem';
export const STRIP_HEIGHT = '3.25rem';
/** One height for every control in the status strip; a floor, so 200% text can still grow it. */
export const STRIP_CONTROL = { minBlockSize: '2.5rem' } as const;
export const TAB_BAR_HEIGHT = '3.5rem';
export const TAB_BAR_CLEARANCE = '2em';
/** Smallest touch target on the phone layout: 44px at the default root size. */
export const TOUCH_TARGET = '2.75rem';

/** Every collection request asks for this many rows; the API allows up to 200. */
export const PAGE_LIMIT = 100;
