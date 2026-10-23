import { Alert, Button, Flex } from '@jfrader/ui';
import type { PageMeta } from '../api/types';
import { Freshness } from './Freshness';
import { useControlSize } from '../features/shell/use-shell-layout';

interface ListPagerProps {
  page: PageMeta;
  onFirstPage: (() => void) | null;
  onNextPage: (cursor: string) => void;
}

/** Snapshot freshness, truncation and cursor navigation for one list page. */
export function ListPager({ page, onFirstPage, onNextPage }: ListPagerProps) {
  const size = useControlSize();
  const { next_cursor: nextCursor } = page;
  return (
    <Flex direction="column" gap="sm">
      {page.truncated && <Alert tone="warning" title="List is incomplete" />}
      <Flex wrap gap="sm" align="center" justify="between">
        <Freshness observedAt={page.observed_at} stale={page.stale} />
        <Flex wrap gap="sm">
          {onFirstPage && (
            <Button size={size} variant="outline" onClick={onFirstPage}>
              First page
            </Button>
          )}
          {nextCursor !== null && (
            <Button size={size} variant="outline" onClick={() => onNextPage(nextCursor)}>
              Next page
            </Button>
          )}
        </Flex>
      </Flex>
    </Flex>
  );
}
