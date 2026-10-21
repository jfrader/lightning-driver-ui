import { Alert, Flex, Pill, styled } from '@jfrader/ui';
import { useQuery } from '@tanstack/react-query';
import { decodeQueryOptions } from '../../../api/node-queries';
import type { NodeSummary, Operation } from '../../../api/types';
import { ButtonLink } from '../../../components/ButtonLink';
import { LoadingState } from '../../../components/LoadingState';
import { WorkLayout } from '../../../components/WorkLayout';
import { READING_WIDTH, TABLE_MEDIA } from '../../../config';
import { formatClockTime, isPast } from '../../../lib/time';
import { useNow } from '../../../lib/use-now';
import { ConfirmPanel } from '../../operations/ConfirmPanel';
import { confirmBlockReason } from '../../operations/confirm-block';
import { useControlSize, useDesktopShell } from '../../shell/use-shell-layout';
import { ConsentBlock } from './ConsentBlock';
import { ReviewAside } from './ReviewAside';
import { ReviewDetails } from './ReviewDetails';

const Head = styled.div(({ theme }) => ({ display: 'grid', gap: theme.space[1] }));

const TitleRow = styled.div(({ theme }) => ({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  columnGap: theme.space[3],
  rowGap: theme.space[1],
}));

const Title = styled.h2(({ theme }) => ({ margin: 0, fontSize: theme.textSize.xl, fontWeight: theme.fontWeight.semibold }));

const Expiry = styled.span(({ theme }) => ({ fontSize: theme.textSize.sm, color: theme.color.textMuted, whiteSpace: 'nowrap' }));

const Mono = styled.span(({ theme }) => ({ fontFamily: theme.font.mono }));

const Stack = styled.div(({ theme }) => ({
  display: 'grid',
  gap: theme.space[3],
  minInlineSize: 0,
  [TABLE_MEDIA]: { gap: theme.space[5] },
}));

interface PaymentReviewProps {
  /** An awaiting `pay_invoice` operation; the review renders only from its server record. */
  operation: Operation;
  /** `request.params.bolt11` of that operation. */
  bolt11: string;
  node: NodeSummary | null;
}

/**
 * The payment review. The invoice is decoded again on every review mount; when the decode fails or
 * its payment hash differs from the server review, no confirm button renders.
 */
export function PaymentReview({ operation, bolt11, node }: PaymentReviewProps) {
  const now = useNow();
  const desktop = useDesktopShell();
  const size = useControlSize();
  const nodeId = operation.node_id;
  const blocked = confirmBlockReason(operation, node, now);
  const decode = useQuery({ ...decodeQueryOptions(nodeId, bolt11), enabled: blocked === null });
  const decoded = decode.data && decode.data.payment_hash === operation.review.payment_hash ? decode.data : null;
  const expired = isPast(operation.review.expires_at, now);

  const discard = (disabled: boolean) =>
    desktop ? (
      <ButtonLink
        to="/nodes/$nodeId/payments/new"
        params={{ nodeId }}
        size={size === 'lg' ? 'lg' : 'md'}
        variant="ghost"
        aria-disabled={disabled || undefined}
        onClick={(event) => {
          if (disabled) event.preventDefault();
        }}
      >
        Discard review
      </ButtonLink>
    ) : null;

  let confirmation;
  if (blocked !== null) {
    confirmation = <ConfirmPanel operation={operation} node={node} />;
  } else if (decode.isPending) {
    confirmation = <LoadingState label="Checking the invoice again" />;
  } else if (!decoded) {
    confirmation = (
      <Flex direction="column" gap="sm" align="start">
        <Alert tone="warning" title="The invoice could not be checked again.">
          Nothing was sent.
        </Alert>
        {discard(false)}
      </Flex>
    );
  } else {
    confirmation = <ConfirmPanel operation={operation} node={node} secondary={discard} />;
  }

  return (
    <Flex direction="column" gap="md">
      <Head>
        <ButtonLink
          to="/nodes/$nodeId/payments"
          params={{ nodeId }}
          search={{}}
          size={size}
          variant="ghost"
          style={{ justifySelf: 'start' }}
        >
          ‹ Payments
        </ButtonLink>
        <TitleRow>
          <Title>Review payment</Title>
          <Pill tone="neutral">{expired ? 'Expired' : 'Not sent'}</Pill>
          <Expiry>
            expires <Mono>{formatClockTime(operation.review.expires_at)}</Mono> UTC
          </Expiry>
        </TitleRow>
      </Head>
      <WorkLayout
        mainWidth={READING_WIDTH}
        asideLabel="Payment context"
        main={
          <Stack>
            <ConsentBlock operation={operation} node={node} decoded={decoded} />
            {confirmation}
            <ReviewDetails operation={operation} decoded={decoded} />
          </Stack>
        }
        aside={<ReviewAside operation={operation} />}
      />
    </Flex>
  );
}
