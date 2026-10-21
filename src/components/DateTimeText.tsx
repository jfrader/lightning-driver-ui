import { formatDateTime } from '../lib/time';

/** A server timestamp in the local time zone; `null` reads "Not reported". */
export function DateTimeText({ value }: { value: string | null }) {
  const text = value === null ? null : formatDateTime(value);
  return <time dateTime={value ?? undefined}>{text ?? 'Not reported'}</time>;
}
