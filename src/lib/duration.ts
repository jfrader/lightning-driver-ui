import { DISPLAY_LOCALE } from '../config';

interface DurationParts {
  hours: number;
  minutes: number;
  seconds: number;
}

/** `Intl.DurationFormat` is in every current browser engine but not yet in TypeScript's lib. */
interface DurationFormatter {
  format(duration: Partial<DurationParts>): string;
}
type DurationFormatConstructor = new (locale: Intl.LocalesArgument, options: { style: 'long' }) => DurationFormatter;

function durationFormat(): DurationFormatConstructor | null {
  const candidate: unknown = Reflect.get(Intl, 'DurationFormat');
  return typeof candidate === 'function' ? (candidate as DurationFormatConstructor) : null;
}

/**
 * A whole number of seconds as a readable duration ("1 hour", "1 hour, 30 minutes"), through
 * `Intl.DurationFormat`; engines without it fall back to an `Intl` seconds count ("5,400 seconds").
 */
export function formatDurationSeconds(totalSeconds: number, locale: Intl.LocalesArgument = DISPLAY_LOCALE): string {
  const Format = durationFormat();
  if (!Format) {
    return new Intl.NumberFormat(locale, { style: 'unit', unit: 'second', unitDisplay: 'long' }).format(totalSeconds);
  }
  const parts: DurationParts = {
    hours: Math.floor(totalSeconds / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };
  const present = Object.fromEntries(Object.entries(parts).filter(([, value]) => value > 0));
  return new Format(locale, { style: 'long' }).format(Object.keys(present).length > 0 ? present : { seconds: 0 });
}
