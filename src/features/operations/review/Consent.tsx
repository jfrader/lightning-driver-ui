import type { ReactNode } from 'react';
import { Pill, styled } from '@jfrader/ui';
import type { NodeSummary, Operation } from '../../../api/types';
import { TABLE_MEDIA } from '../../../config';
import { MsatAmount } from '../../display/Amount';
import { NETWORK_LABEL } from '../../nodes/labels';

const Block = styled.div(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  minInlineSize: 0,
  gap: theme.space[3],
  padding: theme.space[3],
  backgroundColor: theme.color.surface,
  border: `1px solid ${theme.color.border}`,
  borderRadius: theme.radius.md,
  [TABLE_MEDIA]: { gap: theme.space[5], padding: theme.space[6] },
}));

const Kicker = styled.p(({ theme }) => ({ margin: 0, fontSize: theme.textSize.sm, color: theme.color.textMuted }));

const LeadText = styled.span(({ theme }) => ({
  display: 'block',
  marginBlockStart: theme.space[1],
  fontSize: theme.textSize.xl,
  fontWeight: theme.fontWeight.medium,
  overflowWrap: 'anywhere',
  [TABLE_MEDIA]: { fontSize: theme.textSize['3xl'] },
}));

/** The lead figure: the exact amount being authorized, as the largest text in the block. */
export const Hero = styled(MsatAmount)(({ theme }) => ({
  display: 'block',
  marginBlockStart: theme.space[1],
  fontSize: theme.textSize.xl,
  fontWeight: theme.fontWeight.medium,
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
  [TABLE_MEDIA]: { fontSize: theme.textSize['3xl'] },
}));

const Ledger = styled.dl(({ theme }) => ({ margin: 0, display: 'grid', borderBlock: `1px solid ${theme.color.border}` }));

const Row = styled.div<{ total: boolean }>(({ theme, total }) => ({
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

const Value = styled.dd({ margin: 0, minInlineSize: 0, overflowWrap: 'anywhere', display: 'grid', justifyItems: 'end', textAlign: 'end' });

/** "at most", "estimate" and similar qualifiers inside a value. */
export const Muted = styled.span(({ theme }) => ({ color: theme.color.textMuted, fontWeight: theme.fontWeight.regular }));

export const SmallLine = styled.span(({ theme }) => ({ fontSize: theme.textSize.xs }));

const Fields = styled.dl(({ theme }) => ({ margin: 0, display: 'grid', gap: theme.space[2], [TABLE_MEDIA]: { gap: theme.space[4] } }));

const FieldRow = styled.div(({ theme }) => ({ display: 'grid', gap: theme.space[1], minInlineSize: 0 }));

const FieldLabel = styled.dt(({ theme }) => ({ fontSize: theme.textSize.sm, color: theme.color.textMuted }));

const FieldValue = styled.dd({ margin: 0, minInlineSize: 0, overflowWrap: 'anywhere' });

const Warning = styled.p(({ theme }) => ({ margin: 0, color: theme.color.warning, fontSize: theme.textSize.sm }));

const NodeLine = styled.span(({ theme }) => ({ display: 'inline-flex', flexWrap: 'wrap', alignItems: 'center', gap: theme.space[2] }));

const Strong = styled.span(({ theme }) => ({ fontWeight: theme.fontWeight.semibold }));

const Mono = styled.span(({ theme }) => ({ fontFamily: theme.font.mono, fontSize: theme.textSize.sm, color: theme.color.textMuted }));

interface ConsentProps {
  /** What is being authorized, e.g. "Send on-chain". */
  kicker: string;
  /** The lead figure (an amount) or a lead line of text. */
  lead?: ReactNode;
  /** What the lead figure is, when the kicker alone does not say it. */
  leadCaption?: string;
  /** Fee and total lines; omitted when the kind has no fee. */
  ledger?: ReactNode;
  /** One literal line the operator must see before confirming. */
  warning?: string;
  children: ReactNode;
}

/** What the confirmation approves, from the immutable server review only. */
export function Consent({ kicker, lead, leadCaption, ledger, warning, children }: ConsentProps) {
  return (
    <Block>
      <div>
        <Kicker>{kicker}</Kicker>
        {typeof lead === 'string' ? <LeadText>{lead}</LeadText> : lead}
        {leadCaption && <Kicker>{leadCaption}</Kicker>}
      </div>
      {ledger && <Ledger>{ledger}</Ledger>}
      {warning && <Warning>{warning}</Warning>}
      <Fields>{children}</Fields>
    </Block>
  );
}

interface LedgerLineProps {
  label: string;
  qualifier?: string;
  total?: boolean;
  children: ReactNode;
}

/** One fee or total line: the label, its fee semantics qualifier, and the value. */
export function LedgerLine({ label, qualifier, total = false, children }: LedgerLineProps) {
  return (
    <Row total={total}>
      <Term>
        {label}
        {qualifier && <Qualifier>{qualifier}</Qualifier>}
      </Term>
      <Value>{children}</Value>
    </Row>
  );
}

/** A labelled consent fact (recipient, peer, description…), stacked so long values wrap fully. */
export function ConsentField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <FieldRow>
      <FieldLabel>{label}</FieldLabel>
      <FieldValue>{children}</FieldValue>
    </FieldRow>
  );
}

/** The node and network the review is bound to; the label is omitted for a node no longer configured. */
export function FromField({ operation, node }: { operation: Operation; node: NodeSummary | null }) {
  const { node: bound } = operation.review;
  return (
    <ConsentField label="From">
      <NodeLine>
        {node && <Strong>{node.label}</Strong>}
        <Pill tone="neutral">{NETWORK_LABEL[bound.network]}</Pill>
        <Mono>{bound.node_id}</Mono>
      </NodeLine>
    </ConsentField>
  );
}
