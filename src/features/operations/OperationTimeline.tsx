import { styled } from '@jfrader/ui';
import type { Operation } from '../../api/types';
import { TABLE_MEDIA } from '../../config';
import { formatAge, formatClockTime } from '../../lib/time';
import { useNow } from '../../lib/use-now';
import { operationSteps, type OperationStep, type StepStatus } from './operation-steps';

const List = styled.ol({ margin: 0, padding: 0, listStyle: 'none' });

const Step = styled.li(({ theme }) => ({
  position: 'relative',
  display: 'grid',
  gridTemplateColumns: `${theme.space[6]} minmax(0, 1fr)`,
  columnGap: theme.space[2],
  paddingBlockEnd: theme.space[4],
  '&:last-of-type': { paddingBlockEnd: 0 },
  '&:not(:last-of-type)::before': {
    content: '""',
    position: 'absolute',
    insetBlock: `${theme.space[4]} 0`,
    insetInlineStart: `calc(${theme.space[3]} - 0.5px)`,
    borderInlineStart: `1px solid ${theme.color.border}`,
  },
}));

const Marker = styled.span<{ status: StepStatus }>(({ theme, status }) => ({
  justifySelf: 'center',
  marginBlockStart: '0.35rem',
  inlineSize: '0.625rem',
  blockSize: '0.625rem',
  boxSizing: 'border-box',
  borderRadius: '1px',
  border: '1.5px solid',
  ...{
    done: { backgroundColor: theme.color.textMuted, borderColor: theme.color.textMuted },
    attention: { backgroundColor: theme.color.warning, borderColor: theme.color.warning },
    not_observed: { backgroundColor: 'transparent', borderColor: theme.color.borderControl },
  }[status],
}));

const Body = styled.div(({ theme }) => ({
  display: 'grid',
  rowGap: theme.space[1],
  minInlineSize: 0,
  [TABLE_MEDIA]: { gridTemplateColumns: 'minmax(0, 1fr) auto', columnGap: theme.space[4] },
}));

const Title = styled.span<{ status: StepStatus }>(({ theme, status }) => ({
  fontSize: theme.textSize.sm,
  fontWeight: theme.fontWeight.medium,
  color: status === 'not_observed' ? theme.color.textMuted : theme.color.text,
}));

const Detail = styled.span(({ theme }) => ({
  display: 'block',
  fontSize: theme.textSize.xs,
  color: theme.color.textMuted,
  fontWeight: theme.fontWeight.regular,
}));

const When = styled.span(({ theme }) => ({
  fontSize: theme.textSize.xs,
  color: theme.color.textMuted,
  [TABLE_MEDIA]: { textAlign: 'end' },
}));

const Mono = styled.time(({ theme }) => ({ fontFamily: theme.font.mono, fontVariantNumeric: 'tabular-nums', color: theme.color.text }));

const Unrecorded = styled.span(({ theme }) => ({ fontStyle: 'italic', color: theme.color.textSubtle }));

function StepTime({ step }: { step: OperationStep }) {
  const now = useNow();
  const clock = step.at === null ? null : formatClockTime(step.at);
  if (step.at === null || clock === null) {
    return (
      <When>
        <Unrecorded>{step.missing}</Unrecorded>
      </When>
    );
  }
  return (
    <When>
      <Mono dateTime={step.at}>{clock}</Mono> UTC · {formatAge(step.at, now)}
    </When>
  );
}

/**
 * What the operation record proves, in order, with absolute UTC times and relative ages.
 * Untimed steps say so; nothing is interpolated. App-owned because a timeline that needs a time per
 * event would drop or fake the authorization and dispatch steps.
 */
export function OperationTimeline({ operation }: { operation: Operation }) {
  return (
    <List aria-label="Operation timeline">
      {operationSteps(operation).map((step) => (
        <Step key={step.id}>
          <Marker status={step.status} aria-hidden="true" />
          <Body>
            <Title status={step.status}>
              {step.label}
              {step.detail && <Detail>{step.detail}</Detail>}
            </Title>
            <StepTime step={step} />
          </Body>
        </Step>
      ))}
    </List>
  );
}
