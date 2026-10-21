import { Flex } from '@jfrader/ui';
import { ButtonLink } from '../../components/ButtonLink';
import { ErrorNotice } from '../../components/ErrorNotice';
import type { SubmitResult } from './use-submit-operation';

interface SubmitFeedbackProps {
  error: unknown;
  result: SubmitResult | undefined;
}

/** Creation errors, or a definite confirm error with a link to the review that still exists. */
export function SubmitFeedback({ error, result }: SubmitFeedbackProps) {
  if (error) return <ErrorNotice error={error} />;
  if (!result?.confirmError) return null;
  const { operation } = result;
  return (
    <Flex direction="column" gap="sm" align="start">
      <ErrorNotice error={result.confirmError} />
      <ButtonLink
        to="/nodes/$nodeId/operations/$operationId"
        params={{ nodeId: operation.node_id, operationId: operation.id }}
        search={{}}
        variant="outline"
      >
        Open the review
      </ButtonLink>
    </Flex>
  );
}
