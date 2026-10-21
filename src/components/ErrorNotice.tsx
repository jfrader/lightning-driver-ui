import { Alert, Button, CopyButton, Flex } from '@jfrader/ui';
import { describeError } from '../api/describe-error';

interface ErrorNoticeProps {
  error: unknown;
  onRetry?: () => void;
  retryLabel?: string;
}

export function ErrorNotice({ error, onRetry, retryLabel = 'Try again' }: ErrorNoticeProps) {
  const { title, message, requestId } = describeError(error);
  return (
    <Alert tone="danger" title={title}>
      <Flex direction="column" gap="sm">
        <span>{message}</span>
        {(onRetry || requestId) && (
          <Flex wrap gap="sm" align="center">
            {onRetry && (
              <Button size="sm" variant="outline" onClick={onRetry}>
                {retryLabel}
              </Button>
            )}
            {requestId && (
              <CopyButton
                size="sm"
                text={requestId}
                label="Copy request ID"
                pendingLabel="Copying"
                copiedLabel="Request ID copied"
                errorLabel="Copy failed"
              />
            )}
          </Flex>
        )}
      </Flex>
    </Alert>
  );
}
