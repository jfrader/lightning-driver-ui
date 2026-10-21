import { styled } from '@jfrader/ui';
import { formatAge, formatClockTime } from '../../lib/time';
import { useNow } from '../../lib/use-now';

const Meta = styled.span(({ theme }) => ({ fontSize: theme.textSize.xs, color: theme.color.textMuted }));

const Mono = styled.span(({ theme }) => ({ fontFamily: theme.font.mono }));

/** When the server last checked this operation with the node: UTC time and age from one `now`. */
export function LastChecked({ at }: { at: string | null }) {
  const now = useNow();
  const clock = at === null ? null : formatClockTime(at);
  const age = at === null ? null : formatAge(at, now);
  if (!clock || !age) return <Meta>Not checked with the node yet</Meta>;
  return (
    <Meta>
      Last checked with the node <Mono>{clock}</Mono> UTC · {age}
    </Meta>
  );
}
