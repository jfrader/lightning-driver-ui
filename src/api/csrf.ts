// Authenticated CSRF token for the current session, kept in memory only.
let sessionToken: string | null = null;

export function setSessionCsrfToken(token: string): void {
  sessionToken = token;
}

export function clearSessionCsrfToken(): void {
  sessionToken = null;
}

export function sessionCsrfToken(): string | null {
  return sessionToken;
}
