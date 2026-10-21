import { DISPLAY_LOCALE, DISPLAY_TIME_ZONE } from '../config';

const RELATIVE_UNITS: readonly (readonly [Intl.RelativeTimeFormatUnit, number])[] = [
  ['day', 86_400],
  ['hour', 3_600],
  ['minute', 60],
  ['second', 1],
];

function parseTime(iso: string): number | null {
  const time = Date.parse(iso);
  return Number.isNaN(time) ? null : time;
}

/** "3 minutes ago"; `null` when the timestamp cannot be parsed. */
export function formatAge(iso: string, now: number, locale: Intl.LocalesArgument = DISPLAY_LOCALE): string | null {
  const time = parseTime(iso);
  if (time === null) return null;
  const seconds = Math.round((time - now) / 1000);
  const [unit, size] = RELATIVE_UNITS.find(([, unitSeconds]) => Math.abs(seconds) >= unitSeconds) ?? ['second', 1];
  return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(Math.round(seconds / size), unit);
}

export function formatDateTime(iso: string, locale: Intl.LocalesArgument = DISPLAY_LOCALE): string | null {
  const time = parseTime(iso);
  if (time === null) return null;
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(time);
}

/** "14:05:09", 24-hour clock in the display time zone (UTC). */
export function formatClockTime(iso: string, locale: Intl.LocalesArgument = DISPLAY_LOCALE): string | null {
  const time = parseTime(iso);
  if (time === null) return null;
  return new Intl.DateTimeFormat(locale, { timeStyle: 'medium', hourCycle: 'h23', timeZone: DISPLAY_TIME_ZONE }).format(time);
}

export function isPast(iso: string, now: number): boolean {
  const time = parseTime(iso);
  return time !== null && time <= now;
}
