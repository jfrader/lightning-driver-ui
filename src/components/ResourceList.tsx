import type { ReactNode } from 'react';
import { SortableDataTable, styled, type SortState } from '@jfrader/ui';
import { TABLE_QUERY } from '../config';
import { useMediaQuery } from '../lib/use-media-query';

export interface ResourceColumn<T> {
  id: string;
  header: string;
  cell: (row: T) => ReactNode;
  numeric?: boolean;
  width?: string;
  /** Orders the loaded snapshot; columns without it are not sortable. */
  compare?: (a: T, b: T) => number;
}

interface ResourceListProps<T> {
  caption: string;
  rows: readonly T[];
  columns: readonly ResourceColumn<T>[];
  getRowId: (row: T) => string;
  /** Client-side order of the loaded snapshot (from the URL); it never implies a server order. */
  sort?: SortState | null;
  onSort?: (sort: SortState | null) => void;
  /** Phone row: a 2–3 line hierarchy. Defaults to labelled fields. */
  renderRow?: (row: T) => ReactNode;
}

const Rows = styled.ul({ listStyle: 'none', margin: 0, padding: 0 });

const Row = styled.li(({ theme }) => ({
  paddingBlock: theme.space[3],
  borderBlockEnd: `1px solid ${theme.color.borderSubtle}`,
  minInlineSize: 0,
  '&:last-of-type': { borderBlockEnd: 'none' },
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

function sortedRows<T>(rows: readonly T[], columns: readonly ResourceColumn<T>[], sort: SortState | null): readonly T[] {
  const compare = sort && columns.find((column) => column.id === sort.columnId)?.compare;
  if (!sort || !compare) return rows;
  const sign = sort.direction === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => sign * compare(a, b));
}

/** A table from 48rem and rows below it, from one column definition and one sort. */
export function ResourceList<T>({ caption, rows, columns, getRowId, sort = null, onSort, renderRow }: ResourceListProps<T>) {
  const table = useMediaQuery(TABLE_QUERY);
  const ordered = sortedRows(rows, columns, sort);
  if (table) {
    return (
      <SortableDataTable
        caption={caption}
        captionHidden
        size="sm"
        rows={ordered}
        getRowId={getRowId}
        sortMode="manual"
        value={sort}
        onValueChange={onSort}
        columns={columns.map((column) => ({ ...column, sortable: Boolean(column.compare && onSort) }))}
      />
    );
  }
  return (
    <Rows aria-label={caption}>
      {ordered.map((row) => (
        <Row key={getRowId(row)}>
          {renderRow ? (
            renderRow(row)
          ) : (
            <Fields>
              {columns.map((column) => (
                <Field key={column.id}>
                  <Term>{column.header}</Term>
                  <Detail>{column.cell(row)}</Detail>
                </Field>
              ))}
            </Fields>
          )}
        </Row>
      ))}
    </Rows>
  );
}
