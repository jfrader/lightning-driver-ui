import { DISPLAY_LOCALE, DISPLAY_TIME_ZONE } from '../config';
import { formatterCache } from './formatter-cache';

const dateFormat = formatterCache((locale, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale, options));
const relativeFormat = formatterCache((locale, options: Intl.RelativeTimeFormatOptions) => new Intl.RelativeTimeFormat(locale, options));

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
  return relativeAge(iso, now, locale, 'long');
}

/** "3 min ago": the compact form for dense table cells. */
export function formatAgeShort(iso: string, now: number, locale: Intl.LocalesArgument = DISPLAY_LOCALE): string | null {
  return relativeAge(iso, now, locale, 'short');
}

function relativeAge(
  iso: string,
  now: number,
  locale: Intl.LocalesArgument,
  style: Intl.RelativeTimeFormatStyle,
): string | null {
  const time = parseTime(iso);
  if (time === null) return null;
  const seconds = Math.round((time - now) / 1000);
  const [unit, size] = RELATIVE_UNITS.find(([, unitSeconds]) => Math.abs(seconds) >= unitSeconds) ?? ['second', 1];
  return relativeFormat(locale, { numeric: 'auto', style }).format(Math.round(seconds / size), unit);
}

export function formatDateTime(iso: string, locale: Intl.LocalesArgument = DISPLAY_LOCALE): string | null {
  const time = parseTime(iso);
  if (time === null) return null;
  return dateFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(time);
}

/** "14:05:09", 24-hour clock in the display time zone (UTC). */
export function formatClockTime(iso: string, locale: Intl.LocalesArgument = DISPLAY_LOCALE): string | null {
  const time = parseTime(iso);
  if (time === null) return null;
  return dateFormat(locale, { timeStyle: 'medium', hourCycle: 'h23', timeZone: DISPLAY_TIME_ZONE }).format(time);
}

/** List time in UTC: "14:05" today, with the date on other days. */
export function formatListTime(iso: string, now: number, locale: Intl.LocalesArgument = DISPLAY_LOCALE): string | null {
  const time = parseTime(iso);
  if (time === null) return null;
  const day = dateFormat(locale, { dateStyle: 'short', timeZone: DISPLAY_TIME_ZONE });
  const sameDay = day.format(time) === day.format(now);
  return dateFormat(locale, {
    ...(sameDay ? {} : { dateStyle: 'medium' }),
    timeStyle: 'short',
    hourCycle: 'h23',
    timeZone: DISPLAY_TIME_ZONE,
  }).format(time);
}

/** Detail time in UTC with seconds and the date: "Oct 21, 2026, 12:00:40". */
export function formatDetailTime(iso: string, locale: Intl.LocalesArgument = DISPLAY_LOCALE): string | null {
  const time = parseTime(iso);
  if (time === null) return null;
  return dateFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'medium',
    hourCycle: 'h23',
    timeZone: DISPLAY_TIME_ZONE,
  }).format(time);
}

export function isPast(iso: string, now: number): boolean {
  const time = parseTime(iso);
  return time !== null && time <= now;
}
