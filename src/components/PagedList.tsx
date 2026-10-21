import type { ComponentProps } from 'react';
import { Alert, Button, EmptyState, Flex } from '@jfrader/ui';
import type { UseQueryResult } from '@tanstack/react-query';
import { errorCode } from '../api/errors';
import type { PageMeta } from '../api/types';
import { ErrorNotice } from './ErrorNotice';
import { ListPager } from './ListPager';
import { LoadingState } from './LoadingState';
import { ResourceList } from './ResourceList';

type ListProps<T> = Omit<ComponentProps<typeof ResourceList<T>>, 'rows'>;

interface PagedListProps<T> extends ListProps<T> {
  query: UseQueryResult<PageMeta & { items: T[] }>;
  emptyTitle: string;
  cursor: string | undefined;
  onCursor: (cursor: string | undefined) => void;
}

/** Loading, error, expired-cursor, empty and populated states of one node list snapshot. */
export function PagedList<T>({ query, emptyTitle, cursor, onCursor, ...list }: PagedListProps<T>) {
  if (query.isPending) return <LoadingState label={`Loading ${list.caption.toLowerCase()}`} />;
  if (query.isError) {
    if (errorCode(query.error) === 'cursor_expired') {
      return (
        <Alert tone="info" title="This list expired">
          <Button size="sm" variant="outline" onClick={() => onCursor(undefined)}>
            Load the first page
          </Button>
        </Alert>
      );
    }
    return <ErrorNotice error={query.error} onRetry={() => void query.refetch()} />;
  }
  const page = query.data;
  return (
    <Flex direction="column" gap="md">
      {page.items.length === 0 ? (
        <EmptyState variant="inline" title={emptyTitle} />
      ) : (
        <ResourceList<T> {...list} rows={page.items} />
      )}
      <ListPager page={page} onFirstPage={cursor ? () => onCursor(undefined) : null} onNextPage={onCursor} />
    </Flex>
  );
}
