import { styled } from '@jfrader/ui';

/** quiet: settled or terminal-normal; success: healthy and settled; info: in progress; warning: needs a look; danger: failure. */
export type StateTone = 'quiet' | 'success' | 'info' | 'warning' | 'danger';

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
    success: theme.color.success,
    info: theme.color.info,
    warning: theme.color.warning,
    danger: theme.color.dangerText,
  }[tone],
  fontWeight: tone === 'quiet' ? theme.fontWeight.regular : theme.fontWeight.medium,
}));

/** The marker keeps its shape in forced colors (backgrounds are dropped there); the word carries the state. */
const Marker = styled.span({
  inlineSize: '0.5rem',
  blockSize: '0.5rem',
  borderRadius: '1px',
  backgroundColor: 'currentColor',
  forcedColorAdjust: 'none',
});

/** A resource state as a word with a marker; colour is never the only signal. */
export function StateWord({ state }: { state: StateLabel }) {
  return (
    <Label tone={state.tone}>
      <Marker aria-hidden="true" />
      {state.label}
    </Label>
  );
}
