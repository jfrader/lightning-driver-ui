import { Alert, Button, CopyButton, Flex } from '@jfrader/ui';
import { describeError } from '../api/describe-error';
import { useControlSize } from '../features/shell/use-shell-layout';

interface ErrorNoticeProps {
  error: unknown;
  onRetry?: () => void;
  retryLabel?: string;
  stale?: boolean;
}

export function ErrorNotice({ error, onRetry, retryLabel = 'Try again', stale = false }: ErrorNoticeProps) {
  const size = useControlSize();
  const { title, message, requestId } = describeError(error);
  return (
    <Alert tone="danger" title={title}>
      <Flex direction="column" gap="sm">
        {stale && <span>Showing last successful read.</span>}
        <span>{message}</span>
        {(onRetry || requestId) && (
          <Flex wrap gap="sm" align="center">
            {onRetry && (
              <Button size={size} variant="outline" onClick={onRetry}>
                {retryLabel}
              </Button>
            )}
            {requestId && (
              <CopyButton
                size={size}
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
