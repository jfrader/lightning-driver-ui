import { Flex, Pill, styled } from '@jfrader/ui';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { operationQueryOptions } from '../../api/node-queries';
import { ButtonLink } from '../../components/ButtonLink';
import { ErrorNotice } from '../../components/ErrorNotice';
import { Freshness } from '../../components/Freshness';
import { LoadingState } from '../../components/LoadingState';
import { PageHeader } from '../../components/PageHeader';
import { Panel } from '../../components/Panel';
import { publicPolicyQueryOptions } from '../auth/queries';
import { useCurrentNode } from '../nodes/use-current-node';
import { ConfirmPanel } from './ConfirmPanel';
import { OPERATION_KIND, OPERATION_STAGE, isInFlight, outcomeLabel } from './labels';
import { OperationResultDetails } from './OperationResultDetails';
import { OperationReviewDetails } from './OperationReviewDetails';
import { OperationStatusNotice } from './OperationStatusNotice';

const route = getRouteApi('/_authed/nodes/$nodeId/operations/$operationId');

const Stage = styled.span(({ theme }) => ({ color: theme.color.textMuted, fontSize: theme.textSize.sm }));

/** Review, confirmation and status of one journaled operation, bound to the node in the URL. */
export function OperationPage() {
  const { nodeId, operationId } = route.useParams();
  const unanswered = route.useSearch().confirmation === 'unanswered';
  const node = useCurrentNode();
  const pollMs = useSuspenseQuery(publicPolicyQueryOptions).data.operation_poll_seconds * 1000;
  const operation = useQuery({
    ...operationQueryOptions(nodeId, operationId),
    refetchInterval: (query) => {
      const state = query.state.data?.state;
      if (state === undefined) return false;
      return isInFlight(state) || (unanswered && state === 'awaiting_confirmation') ? pollMs : false;
    },
  });

  if (operation.isPending) return <LoadingState label="Loading operation" />;
  if (operation.isError) return <ErrorNotice error={operation.error} onRetry={() => void operation.refetch()} />;

  const current = operation.data;
  const outcome = outcomeLabel(current);
  return (
    <Flex direction="column" gap="md">
      <PageHeader
        title={OPERATION_KIND[current.request.kind]}
        actions={
          <ButtonLink to="/nodes/$nodeId/operations" params={{ nodeId }} search={{}} variant="ghost">
            All operations
          </ButtonLink>
        }
      />
      <Flex wrap gap="sm" align="center">
        <Pill tone={outcome.tone}>{outcome.label}</Pill>
        <Stage>{OPERATION_STAGE[current.stage]}</Stage>
      </Flex>
      <OperationStatusNotice operation={current} unanswered={unanswered} />
      <Panel title="Review">
        <OperationReviewDetails operation={current} />
      </Panel>
      {current.state === 'awaiting_confirmation' && !unanswered && (
        <ConfirmPanel key={current.id} operation={current} node={node} />
      )}
      {current.result && (
        <Panel title="Result">
          <OperationResultDetails result={current.result} />
        </Panel>
      )}
      <Freshness observedAt={current.last_reconciled_at ?? current.updated_at} stale={false} />
    </Flex>
  );
}
