import { Mono, Muted } from '../../components/text';
import { formatAge, formatClockTime } from '../../lib/time';
import { useNow } from '../../lib/use-now';


/** When the server last checked this operation with the node: UTC time and age from one `now`. */
export function LastChecked({ at }: { at: string | null }) {
  const now = useNow();
  const clock = at === null ? null : formatClockTime(at);
  const age = at === null ? null : formatAge(at, now);
  if (!clock || !age) return <Muted size="xs">Not checked with the node yet</Muted>;
  return (
    <Muted size="xs">
      Last checked with the node <Mono>{clock}</Mono> UTC · {age}
    </Muted>
  );
}
