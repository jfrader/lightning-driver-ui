import { Pill, styled } from '@jfrader/ui';
import type { DecodedInvoice, NodeSummary, Operation } from '../../../api/types';
import { TABLE_MEDIA } from '../../../config';
import { wireToMsat } from '../../../lib/money';
import { MsatAmount } from '../../display/Amount';
import { FeeRatio } from '../../display/FeeRatio';
import { Identifier } from '../../display/Identifier';
import { NotReported } from '../../display/NotReported';
import { NETWORK_LABEL } from '../../nodes/labels';

const Block = styled.div(({ theme }) => ({
  display: 'grid',
  gap: theme.space[3],
  padding: theme.space[3],
  backgroundColor: theme.color.surface,
  border: `1px solid ${theme.color.border}`,
  borderRadius: theme.radius.md,
  [TABLE_MEDIA]: { gap: theme.space[5], padding: theme.space[6] },
}));

const Kicker = styled.p(({ theme }) => ({ margin: 0, fontSize: theme.textSize.sm, color: theme.color.textMuted }));

const Hero = styled(MsatAmount)(({ theme }) => ({
  display: 'block',
  marginBlockStart: theme.space[1],
  fontSize: theme.textSize.xl,
  fontWeight: theme.fontWeight.medium,
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
  [TABLE_MEDIA]: { fontSize: theme.textSize['3xl'] },
}));

const Ledger = styled.dl(({ theme }) => ({ margin: 0, display: 'grid', borderBlock: `1px solid ${theme.color.border}` }));

const LedgerRow = styled.div<{ total?: boolean }>(({ theme, total = false }) => ({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  columnGap: theme.space[4],
  rowGap: theme.space[1],
  paddingBlock: theme.space[2],
  fontWeight: total ? theme.fontWeight.semibold : theme.fontWeight.regular,
  borderBlockStart: total ? `1px dashed ${theme.color.borderStrong}` : 'none',
}));

const Term = styled.dt({ display: 'flex', alignItems: 'baseline', gap: '0.6em', flexWrap: 'wrap' });

const Qualifier = styled.span(({ theme }) => ({
  fontSize: theme.textSize.xs,
  fontWeight: theme.fontWeight.medium,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  color: theme.color.accentText,
}));

const StackedValue = styled.dd({ margin: 0, display: 'grid', justifyItems: 'end', textAlign: 'end' });

const RatioLine = styled.span(({ theme }) => ({ fontSize: theme.textSize.xs }));

const Value = styled.dd({ margin: 0 });

const Muted = styled.span(({ theme }) => ({ color: theme.color.textMuted, fontWeight: theme.fontWeight.regular }));

const Fields = styled.dl(({ theme }) => ({ margin: 0, display: 'grid', gap: theme.space[2], [TABLE_MEDIA]: { gap: theme.space[4] } }));

const Field = styled.div(({ theme }) => ({ display: 'grid', gap: theme.space[1], minInlineSize: 0 }));

const FieldLabel = styled.dt(({ theme }) => ({ fontSize: theme.textSize.sm, color: theme.color.textMuted }));

const FieldValue = styled.dd({ margin: 0, minInlineSize: 0, overflowWrap: 'anywhere' });

const NodeLine = styled.span(({ theme }) => ({ display: 'inline-flex', flexWrap: 'wrap', alignItems: 'center', gap: theme.space[2] }));

const Strong = styled.span(({ theme }) => ({ fontWeight: theme.fontWeight.semibold }));

const Mono = styled.span(({ theme }) => ({ fontFamily: theme.font.mono, fontSize: theme.textSize.sm, color: theme.color.textMuted }));

interface ConsentBlockProps {
  operation: Operation;
  /** The node's registry entry for its label; `null` for a node no longer configured. */
  node: NodeSummary | null;
  /** The re-decoded invoice, once checked; supplies the description when the request had none. */
  decoded: DecodedInvoice | null;
}

function description(operation: Operation, decoded: DecodedInvoice | null) {
  const requested = operation.request.kind === 'pay_invoice' ? operation.request.params.description : null;
  if (requested) return requested;
  if (decoded?.description) return decoded.description;
  if (decoded?.description_hash) return <NotReported>Description hash only</NotReported>;
  return <NotReported>No description</NotReported>;
}

/**
 * What the passkey approves, from the immutable server review only: action, exact amount, the fee
 * cap and its ratio, the derived "at most" total, the full recipient and the bound node.
 */
export function ConsentBlock({ operation, node, decoded }: ConsentBlockProps) {
  const { review } = operation;
  const amount = review.amount_msat === null ? null : wireToMsat(review.amount_msat, 'msat');
  const maxFee = review.fee.max_fee_msat === null ? null : wireToMsat(review.fee.max_fee_msat, 'msat');
  return (
    <Block>
      <div>
        <Kicker>Pay Lightning invoice</Kicker>
        {amount === null ? <NotReported /> : <Hero msat={amount} />}
      </div>
      <Ledger>
        <LedgerRow>
          <Term>
            Routing fee
            <Qualifier>Hard cap</Qualifier>
          </Term>
          <StackedValue>
            {maxFee === null ? (
              <NotReported />
            ) : (
              <span>
                <Muted>at most </Muted>
                <MsatAmount msat={maxFee} />
              </span>
            )}
            <RatioLine>
              <FeeRatio feeMsat={review.fee.max_fee_msat} amountMsat={review.amount_msat} cap />
            </RatioLine>
          </StackedValue>
        </LedgerRow>
        <LedgerRow total>
          <Term>Total</Term>
          <Value>
            {amount === null || maxFee === null ? (
              <NotReported />
            ) : (
              <>
                <Muted>at most </Muted>
                <MsatAmount msat={amount + maxFee} />
              </>
            )}
          </Value>
        </LedgerRow>
      </Ledger>
      <Fields>
        <Field>
          <FieldLabel>Recipient node</FieldLabel>
          <FieldValue>
            {review.destination ? <Identifier value={review.destination} label="Recipient node" prominent /> : <NotReported />}
          </FieldValue>
        </Field>
        <Field>
          <FieldLabel>Description</FieldLabel>
          <FieldValue>{description(operation, decoded)}</FieldValue>
        </Field>
        <Field>
          <FieldLabel>From</FieldLabel>
          <FieldValue>
            <NodeLine>
              {node && <Strong>{node.label}</Strong>}
              <Pill tone="neutral">{NETWORK_LABEL[review.node.network]}</Pill>
              <Mono>{review.node.node_id}</Mono>
            </NodeLine>
          </FieldValue>
        </Field>
      </Fields>
    </Block>
  );
}
