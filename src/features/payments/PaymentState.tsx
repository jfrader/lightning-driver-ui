import { styled } from '@jfrader/ui';
import type { PaymentState as State } from '../../api/types';
import { PAYMENT_STATE, type StateTone } from './labels';

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

/** A payment's state as a word with a marker; colour is never the only signal. */
export function PaymentState({ state }: { state: State }) {
  const { label, tone } = PAYMENT_STATE[state];
  return (
    <Label tone={tone}>
      <Marker aria-hidden="true" />
      {label}
    </Label>
  );
}
