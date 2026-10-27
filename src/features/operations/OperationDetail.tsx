import { Flex, Pill, styled } from '@jfrader/ui';
import type { NodeSummary, Operation } from '../../api/types';
import { ButtonLink } from '../../components/ButtonLink';
import { DetailList } from '../../components/DetailList';
import { Section } from '../../components/Section';
import { WorkLayout } from '../../components/WorkLayout';
import { READING_WIDTH } from '../../config';
import { NotReported } from '../display/NotReported';
import { NodePaymentRecord } from '../payments/NodePaymentRecord';
import { ConsentBlock } from '../payments/review/ConsentBlock';
import { useControlSize } from '../shell/use-shell-layout';
import { AUTHORIZATION_STATUS, NODE_OBSERVED_KINDS, OPERATION_NOUN, OPERATION_STAGE, OPERATION_STATE, outcomeLabel } from './labels';
import { OperationResultDetails } from './OperationResultDetails';
import { OperationReceipt } from './OperationReceipt';
import { KindConsent } from './review/KindConsent';
import { OperationStatusNotice } from './OperationStatusNotice';
import { OperationTimeline } from './OperationTimeline';
import { ReviewDetails } from './ReviewDetails';
import { useOperationSheet } from './sheet-context';

const REVIEW_ANCHOR = 'reviewed';

const Head = styled.div(({ theme }) => ({ display: 'grid', gap: theme.space[1] }));

const Links = styled.div(({ theme }) => ({ display: 'flex', flexWrap: 'wrap', gap: theme.space[1] }));

const TitleRow = styled.div(({ theme }) => ({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  columnGap: theme.space[3],
  rowGap: theme.space[1],
}));

const Title = styled.h2(({ theme }) => ({ margin: 0, fontSize: theme.textSize.xl, fontWeight: theme.fontWeight.semibold }));

const Mono = styled.span(({ theme }) => ({ fontFamily: theme.font.mono, fontSize: theme.textSize.sm }));

const Anchor = styled.div({ scrollMarginBlockStart: '4rem' });

interface OperationDetailProps {
  operation: Operation;
  /** The node's registry entry; `null` for a node the server no longer configures. */
  node: NodeSummary | null;
  unanswered: boolean;
}

/**
 * What happened to one operation after review: what is known, the recorded timeline, the result and
 * the immutable review it came from. Status reads only; nothing here confirms, retries or repeats.
 */
export function OperationDetail({ operation, node, unanswered }: OperationDetailProps) {
  const sheet = useOperationSheet();
  const size = useControlSize();
  const nodeId = operation.node_id;
  const outcome = outcomeLabel(operation);
  const isPayment = operation.request.kind === 'pay_invoice';
  const localResult = operation.result && !NODE_OBSERVED_KINDS[operation.result.kind];
  const hasReceipt = (operation.request.kind === 'create_invoice' && operation.result?.kind === 'create_invoice') ||
    (operation.request.kind === 'new_address' && operation.result?.kind === 'new_address');

  const status = (
    <DetailList
      items={[
        { label: 'State', value: OPERATION_STATE[operation.state].label },
        { label: 'Stage', value: OPERATION_STAGE[operation.stage] },
        { label: 'Authorization', value: AUTHORIZATION_STATUS[operation.authorization.status] },
        { label: 'Result', value: operation.result ? 'Reported' : <NotReported>None reported</NotReported> },
        { label: 'Error code', value: operation.error ? <Mono>{operation.error.code}</Mono> : <NotReported>None</NotReported> },
      ]}
    />
  );

  const main = (
    <>
      <OperationStatusNotice operation={operation} unanswered={unanswered} />
      <Section title="Status">{status}</Section>
      <Section title="Timeline">
        <OperationTimeline operation={operation} />
      </Section>
      {hasReceipt && operation.result?.kind === 'create_invoice' && (
        <Section title="Invoice details"><OperationResultDetails result={operation.result} /></Section>
      )}
      {operation.result && !localResult && (
        <Section title="Result">
          <OperationResultDetails result={operation.result} />
        </Section>
      )}
      <Anchor id={REVIEW_ANCHOR}>
        <Section title={isPayment ? 'Reviewed payment' : 'Review'}>
          {isPayment ? (
            <ConsentBlock operation={operation} node={node} decoded={null} />
          ) : (
            <KindConsent operation={operation} node={node} />
          )}
        </Section>
      </Anchor>
      <ReviewDetails operation={operation} />
    </>
  );

  const paymentHash = operation.review.payment_hash;
  return (
    <Flex direction="column" gap="md">
      {hasReceipt && <OperationReceipt operation={operation} />}
      {localResult && !hasReceipt && operation.result && (
        <Section title="Result">
          <OperationResultDetails result={operation.result} />
        </Section>
      )}
      <Head>
        {!sheet && <Links>
          <ButtonLink to="/nodes/$nodeId/operations" params={{ nodeId }} search={{}} size={size} variant="ghost">
            ‹ Operations
          </ButtonLink>
          {isPayment && (
            <ButtonLink
              to="/nodes/$nodeId/operations/$operationId"
              params={{ nodeId, operationId: operation.id }}
              search={(previous) => previous}
              hash={REVIEW_ANCHOR}
              size={size}
              variant="ghost"
            >
              Reviewed payment
            </ButtonLink>
          )}
        </Links>}
        <TitleRow>
          <Title>{`${OPERATION_NOUN[operation.request.kind]} operation`}</Title>
          <Pill tone={outcome.tone}>{outcome.label}</Pill>
        </TitleRow>
      </Head>
      {isPayment && node && paymentHash ? (
        <WorkLayout
          stacked={sheet !== null}
          main={main}
          mainWidth={READING_WIDTH}
          asideLabel="Node record"
          aside={<NodePaymentRecord nodeId={nodeId} paymentHash={paymentHash} />}
        />
      ) : (
        <Flex direction="column" gap="lg" style={{ maxInlineSize: READING_WIDTH }}>
          {main}
        </Flex>
      )}
    </Flex>
  );
}
