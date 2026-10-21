import { styled } from '@jfrader/ui';

/** quiet: settled or terminal-normal; info: in progress; warning: needs a look; danger: failure. */
export type StateTone = 'quiet' | 'info' | 'warning' | 'danger';

export interface StateLabel {
  label: string;
  tone: StateTone;
}

const Label = styled.span<{ tone: StateTone }>(({ theme, tone }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: theme.space[2],
  whiteSpace: 'nowrap',
  fontSize: theme.textSize.sm,
  color: {
    quiet: theme.color.textMuted,
    info: theme.color.info,
    warning: theme.color.warning,
    danger: theme.color.dangerText,
  }[tone],
  fontWeight: tone === 'quiet' ? theme.fontWeight.regular : theme.fontWeight.medium,
}));

const Marker = styled.span({ inlineSize: '0.5rem', blockSize: '0.5rem', borderRadius: '1px', backgroundColor: 'currentColor' });

/** A resource state as a word with a marker; colour is never the only signal. */
export function StateWord({ state }: { state: StateLabel }) {
  return (
    <Label tone={state.tone}>
      <Marker aria-hidden="true" />
      {state.label}
    </Label>
  );
}
