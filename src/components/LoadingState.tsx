import { Flex, Skeleton } from '@jfrader/ui';

const ROWS = 3;

export function LoadingState({ label }: { label: string }) {
  return (
    <Flex direction="column" gap="sm" role="status" aria-label={label}>
      {Array.from({ length: ROWS }, (_, index) => (
        <Skeleton key={index} height="2.5rem" />
      ))}
    </Flex>
  );
}
