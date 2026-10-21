const AUTH_PATHS = ['/login', '/enroll'];

/** Returns an in-app path for a post-login redirect; anything else falls back to `/`. */
export function safeRedirectPath(value: unknown, origin: string = window.location.origin): string {
  if (typeof value !== 'string' || !value.startsWith('/')) return '/';
  let url: URL;
  try {
    url = new URL(value, origin);
  } catch {
    return '/';
  }
  if (url.origin !== origin) return '/';
  if (AUTH_PATHS.some((path) => url.pathname === path || url.pathname.startsWith(`${path}/`))) return '/';
  return `${url.pathname}${url.search}${url.hash}`;
}
