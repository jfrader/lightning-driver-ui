import { Alert, Flex } from '@jfrader/ui';
import { ApiError } from '../../api/errors';
import { ButtonLink } from '../../components/ButtonLink';
import { ErrorNotice } from '../../components/ErrorNotice';
import { createErrorField, type CreateField } from '../forms/create-errors';

interface SubmitFeedbackProps {
  error: unknown;
  nodeId: string;
  /** Fields the form shows; errors that belong to one of them are shown on the field instead. */
  fields?: readonly CreateField[];
}

/** A create error as a form notice. Creating never dispatches, so nothing here says what was sent. */
export function SubmitFeedback({ error, nodeId, fields = [] }: SubmitFeedbackProps) {
  if (!error || createErrorField(error, fields)) return null;
  if (error instanceof ApiError && error.detail.code === 'resource_busy') {
    const operationId = error.detail.operation_id;
    return (
      <Flex direction="column" gap="sm" align="start">
        <Alert tone="warning" title="Another operation on this node is unresolved." />
        {operationId && (
          <ButtonLink to="/nodes/$nodeId/operations/$operationId" params={{ nodeId, operationId }} variant="outline">
            View operation
          </ButtonLink>
        )}
      </Flex>
    );
  }
  if (error instanceof ApiError && error.detail.code === 'idempotency_conflict') {
    return <Alert tone="warning" title="The inputs changed after the review was created. Create the review again." />;
  }
  return <ErrorNotice error={error} />;
}
