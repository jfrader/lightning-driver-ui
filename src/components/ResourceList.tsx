import type { ReactNode } from 'react';
import { SortableDataTable, styled } from '@jfrader/ui';
import { WIDE_LAYOUT_QUERY } from '../config';
import { useMediaQuery } from '../lib/use-media-query';

export interface ResourceColumn<T> {
  id: string;
  header: string;
  cell: (row: T) => ReactNode;
  numeric?: boolean;
}

interface ResourceListProps<T> {
  caption: string;
  rows: readonly T[];
  columns: readonly ResourceColumn<T>[];
  getRowId: (row: T) => string;
}

const Rows = styled.ul(({ theme }) => ({
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'grid',
  gap: theme.space[3],
}));

const Row = styled.li(({ theme }) => ({
  border: `1px solid ${theme.color.border}`,
  borderRadius: theme.radius.md,
  backgroundColor: theme.color.surface,
  padding: theme.space[3],
}));

const Fields = styled.dl(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: 'minmax(6rem, auto) 1fr',
  gap: `${theme.space[1]} ${theme.space[3]}`,
  margin: 0,
  fontSize: theme.textSize.sm,
}));

const Term = styled.dt(({ theme }) => ({ color: theme.color.textMuted }));
const Detail = styled.dd({ margin: 0, minInlineSize: 0, overflowWrap: 'anywhere' });

const Field = styled.div({ display: 'contents' });

/** A table on wide screens and labelled rows on narrow ones, from one column definition. */
export function ResourceList<T>({ caption, rows, columns, getRowId }: ResourceListProps<T>) {
  const wide = useMediaQuery(WIDE_LAYOUT_QUERY);
  if (wide) {
    return (
      <SortableDataTable
        caption={caption}
        captionHidden
        rows={rows}
        getRowId={getRowId}
        columns={columns.map((column) => ({ ...column, sortable: false }))}
      />
    );
  }
  return (
    <Rows aria-label={caption}>
      {rows.map((row) => (
        <Row key={getRowId(row)}>
          <Fields>
            {columns.map((column) => (
              <Field key={column.id}>
                <Term>{column.header}</Term>
                <Detail>{column.cell(row)}</Detail>
              </Field>
            ))}
          </Fields>
        </Row>
      ))}
    </Rows>
  );
}
