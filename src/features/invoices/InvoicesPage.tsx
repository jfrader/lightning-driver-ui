import type { ReactNode } from 'react';
import { Flex, styled } from '@jfrader/ui';
import { useQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { invoicesQueryOptions } from '../../api/node-queries';
import type { Invoice } from '../../api/types';
import { ButtonLink } from '../../components/ButtonLink';
import { FilterSelect } from '../../components/FilterSelect';
import { InspectorLayout } from '../../components/InspectorLayout';
import { PageHeader } from '../../components/PageHeader';
import { PagedList } from '../../components/PagedList';
import type { ResourceColumn } from '../../components/ResourceList';
import { ROW_PRIMARY_LINK } from '../../components/row-link';
import { TextLink } from '../../components/TextLink';
import { VisuallyHidden } from '../../components/VisuallyHidden';
import { useNow } from '../../lib/use-now';
import { Amount } from '../display/Amount';
import { ShortIdentifier } from '../display/Identifier';
import { StateWord } from '../display/StateWord';
import { CapabilityAction } from '../nodes/CapabilityAction';
import { useCurrentNode } from '../nodes/use-current-node';
import { useControlSize } from '../shell/use-shell-layout';
import { ListTime } from '../../components/ListTime';
import { InvoiceDescription, InvoiceExpiryText } from './InvoiceCells';
import { InvoiceInspector } from './InvoiceInspector';
import { INVOICE_STATE, INVOICE_STATE_LABEL } from './labels';

const route = getRouteApi('/_authed/nodes/$nodeId/_configured/invoices');

const RowBody = styled.div(({ theme }) => ({ display: 'grid', gap: theme.space[1], minInlineSize: 0 }));

const Line = styled.div(({ theme }) => ({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  columnGap: theme.space[3],
  rowGap: theme.space[1],
  minInlineSize: 0,
}));

const Small = styled.span(({ theme }) => ({ fontSize: theme.textSize.xs, color: theme.color.textMuted }));

type Open = (invoice: Invoice, label: ReactNode) => ReactNode;

function columns(now: number, open: Open): ResourceColumn<Invoice>[] {
  return [
    { id: 'created', header: 'Created (UTC)', width: '9rem', cell: (invoice) => open(invoice, <ListTime at={invoice.created_at} now={now} />) },
    { id: 'state', header: 'State', width: '10rem', cell: (invoice) => <StateWord state={INVOICE_STATE[invoice.state]} /> },
    { id: 'amount', header: 'Amount', numeric: true, cell: (invoice) => <Amount value={invoice.amount_msat} unit="msat" /> },
    { id: 'received', header: 'Received', numeric: true, cell: (invoice) => <Amount value={invoice.received_msat} unit="msat" /> },
    { id: 'expires', header: 'Expires', cell: (invoice) => <InvoiceExpiryText invoice={invoice} now={now} /> },
    { id: 'description', header: 'Description', width: '12rem', cell: (invoice) => <InvoiceDescription invoice={invoice} /> },
    { id: 'hash', header: 'Payment hash', cell: (invoice) => <ShortIdentifier value={invoice.payment_hash} /> },
  ];
}

/** Phone row: amount and state, description (two lines), created time and expiry. */
function InvoiceRow({ invoice, now, open }: { invoice: Invoice; now: number; open: Open }) {
  return (
    <RowBody>
      <Line>
        <Amount value={invoice.amount_msat} unit="msat" />
        <StateWord state={INVOICE_STATE[invoice.state]} />
      </Line>
      <InvoiceDescription invoice={invoice} lines={2} />
      <Line>
        <Small>{open(invoice, <ListTime at={invoice.created_at} now={now} />)}</Small>
        <Small>
          <InvoiceExpiryText invoice={invoice} now={now} />
        </Small>
      </Line>
    </RowBody>
  );
}

/** Invoices of the node in the server's order; the state filter and the selected record live in the URL. */
export function InvoicesPage() {
  const node = useCurrentNode();
  const now = useNow();
  const size = useControlSize();
  const search = route.useSearch();
  const navigate = route.useNavigate();
  const invoices = useQuery(invoicesQueryOptions(node.id, { status: search.status, cursor: search.cursor }));

  const open: Open = (invoice, label) => (
    <TextLink
      from="/nodes/$nodeId/invoices"
      search={(previous) => ({ ...previous, selected: invoice.payment_hash })}
      {...ROW_PRIMARY_LINK}
      resetScroll={false}
    >
      {label}
      <VisuallyHidden>{` (Open invoice ${invoice.payment_hash.slice(0, 8)})`}</VisuallyHidden>
    </TextLink>
  );
  const selected = search.selected
    ? (invoices.data?.items.find((invoice) => invoice.payment_hash === search.selected) ?? null)
    : undefined;

  const list = (
    <Flex direction="column" gap="md">
      <FilterSelect
        label="State"
        labels={INVOICE_STATE_LABEL}
        value={search.status}
        onChange={(status) => void navigate({ search: { status } })}
      />
      <PagedList
        caption="Invoices"
        query={invoices}
        columns={columns(now, open)}
        getRowId={(invoice) => invoice.payment_hash}
        renderRow={(invoice) => <InvoiceRow invoice={invoice} now={now} open={open} />}
        emptyTitle={search.status ? `No invoices in state ${INVOICE_STATE[search.status].label}.` : 'No invoices on this node.'}
        cursor={search.cursor}
        onCursor={(cursor) => void navigate({ search: (previous) => ({ ...previous, cursor, selected: undefined }) })}
      />
    </Flex>
  );

  return (
    <Flex direction="column" gap="md">
      <PageHeader
        title="Invoices"
        actions={
          <CapabilityAction node={node} capability="create_invoice">
            <ButtonLink to="/nodes/$nodeId/invoices/new" params={{ nodeId: node.id }} size={size} tone="accent" variant="solid">
              Create invoice
            </ButtonLink>
          </CapabilityAction>
        }
      />
      <InspectorLayout
        list={list}
        inspectorLabel="Selected invoice"
        inspector={
          selected === undefined || invoices.isPending ? null : (
            <InvoiceInspector
              invoice={selected}
              now={now}
              close={
                <ButtonLink
                  variant="ghost"
                  size={size}
                  from="/nodes/$nodeId/invoices"
                  search={(previous) => ({ ...previous, selected: undefined })}
                  resetScroll={false}
                >
                  Hide
                </ButtonLink>
              }
            />
          )
        }
      />
    </Flex>
  );
}
