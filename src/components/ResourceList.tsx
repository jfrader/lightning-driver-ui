import { memo, type ReactNode } from 'react';
import { DataTable, Flex, Select, styled, type SortState } from '@jfrader/ui';
import { SORT_DIRECTIONS } from '../app/search';
import { TABLE_QUERY, TOUCH_TARGET } from '../config';
import { useControlSize } from '../features/shell/use-shell-layout';
import { keysOf } from '../lib/guards';
import { useMediaQuery } from '../lib/use-media-query';

export interface ResourceColumn<T> {
  id: string;
  header: string;
  cell: (row: T) => ReactNode;
  numeric?: boolean;
  width?: string;
  /** Orders the loaded snapshot; columns without it are not sortable. */
  compare?: (a: T, b: T) => number;
  isMissing?: (row: T) => boolean;
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

/** Phone row: the link marked with ROW_PRIMARY_LINK covers the whole row as one touch target. */
const Row = styled.li(({ theme }) => ({
  position: 'relative',
  paddingBlock: theme.space[3],
  borderBlockEnd: `1px solid ${theme.color.borderSubtle}`,
  minInlineSize: 0,
  '&:last-of-type': { borderBlockEnd: 'none' },
  '& [data-row-primary]': { whiteSpace: 'nowrap' },
  '& [data-row-primary]::after': { content: '""', position: 'absolute', inset: 0 },
  // The focus ring follows the target: the whole row.
  '&:has([data-row-primary]:focus-visible)': { outline: `2px solid ${theme.color.focusRing}`, outlineOffset: theme.space[1] },
  // Any other link in the row stays reachable above the row target, at touch size. Inline-block keeps
  // the spaces inside the link text, which a flex box would drop.
  '& a:not([data-row-primary])': {
    position: 'relative',
    zIndex: 1,
    display: 'inline-block',
    minBlockSize: TOUCH_TARGET,
    lineHeight: TOUCH_TARGET,
  },
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

/**
 * Headers and cells never break inside a word: each column is at least as wide as its header and
 * its longest word, and a table wider than its column (an open inspector, many columns at 48rem)
 * scrolls inside the table's own scroller, never the page. Long values truncate or clamp themselves.
 */
const HEADER_NO_WRAP = {
  headerCell: { sx: { whiteSpace: 'nowrap' as const } },
  cell: {
    sx: {
      overflowWrap: 'normal' as const,
      wordBreak: 'normal' as const,
      // A row's open link is a short, often shortened identifier (`channel-…pening`): one token.
      '& [data-row-primary]': { whiteSpace: 'nowrap' as const },
    },
  },
};

function sortedRows<T>(rows: readonly T[], columns: readonly ResourceColumn<T>[], sort: SortState | null): readonly T[] {
  const column = sort && columns.find((column) => column.id === sort.columnId);
  if (!sort || !column?.compare) return rows;
  const { compare, isMissing } = column;
  const sign = sort.direction === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const aMissing = isMissing?.(a) ?? false;
    const bMissing = isMissing?.(b) ?? false;
    if (aMissing || bMissing) return aMissing === bMissing ? 0 : aMissing ? 1 : -1;
    return sign * compare(a, b);
  });
}

/** A table from 48rem and rows below it, from one column definition and one sort. */
function ResourceListBody<T>({ caption, rows, columns, getRowId, sort = null, onSort, renderRow }: ResourceListProps<T>) {
  const table = useMediaQuery(TABLE_QUERY);
  const size = useControlSize();
  const ordered = sortedRows(rows, columns, sort);
  if (table) {
    return (
      <DataTable
        caption={caption}
        captionHidden
        size="sm"
        rows={ordered}
        getRowId={getRowId}
        sortMode="manual"
        value={sort}
        onValueChange={onSort}
        columns={columns.map((column) => ({ ...column, sortable: Boolean(column.compare && onSort) }))}
        slotProps={HEADER_NO_WRAP}
      />
    );
  }
  const sortOptions = columns.filter((column) => column.compare).flatMap((column) =>
    keysOf(SORT_DIRECTIONS).map((direction) => ({
      value: `${column.id}:${direction}`,
      label: `${column.header}: ${SORT_DIRECTIONS[direction]}`,
      sort: { columnId: column.id, direction },
    })),
  );
  const list = (
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
  if (!onSort || sortOptions.length === 0) return list;
  return (
    <Flex direction="column" gap="md">
      <Select
        label="Sort by"
        size={size}
        slotProps={{ item: { sx: { minBlockSize: TOUCH_TARGET } } }}
        options={[{ value: '', label: 'Unsorted' }, ...sortOptions]}
        value={sort ? `${sort.columnId}:${sort.direction}` : ''}
        onValueChange={(value) => onSort(sortOptions.find((option) => option.value === value)?.sort ?? null)}
      />
      {list}
    </Flex>
  );
}

export const ResourceList = memo(ResourceListBody) as typeof ResourceListBody;
