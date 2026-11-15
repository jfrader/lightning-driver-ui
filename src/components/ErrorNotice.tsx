import { Alert, Button, Flex } from '@jfrader/ui';
import { CopyAction } from './CopyValue';
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
              <CopyAction value={requestId} label="request ID" iconOnly={false} copiedLabel="Request ID copied" />
            )}
          </Flex>
        )}
      </Flex>
    </Alert>
  );
}
