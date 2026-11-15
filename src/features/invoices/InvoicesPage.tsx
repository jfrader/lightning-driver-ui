import type { ReactNode } from 'react';
import { Flex } from '@jfrader/ui';
import { Muted } from '../../components/text';
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
import { RowBody, RowLine } from '../../components/RowLayout';
import { ROW_PRIMARY_LINK } from '../../components/row-link';
import { TextLink } from '../../components/TextLink';
import { VisuallyHidden } from '../../components/VisuallyHidden';
import { Amount } from '../display/Amount';
import { ShortIdentifier } from '../display/Identifier';
import { StateWord } from '../display/StateWord';
import { CapabilityAction } from '../nodes/CapabilityAction';
import { useCurrentNode } from '../nodes/use-current-node';
import { useControlSize } from '../shell/use-shell-layout';
import { MoneyActionButton } from '../shell/MoneyActionButton';
import { ListTime } from '../../components/ListTime';
import { InvoiceDescription, InvoiceExpiryText } from './InvoiceCells';
import { InvoiceInspector } from './InvoiceInspector';
import { INVOICE_STATE, INVOICE_STATE_LABEL } from './labels';

const route = getRouteApi('/_authed/nodes/$nodeId/_configured/invoices');

type Open = (invoice: Invoice, label: ReactNode) => ReactNode;

function columns(open: Open): ResourceColumn<Invoice>[] {
  return [
    { id: 'created', header: 'Created (UTC)', width: '9rem', cell: (invoice) => open(invoice, <ListTime at={invoice.created_at} />) },
    { id: 'state', header: 'State', width: '10rem', cell: (invoice) => <StateWord state={INVOICE_STATE[invoice.state]} /> },
    { id: 'amount', header: 'Amount', numeric: true, cell: (invoice) => <Amount value={invoice.amount_msat} unit="msat" /> },
    { id: 'received', header: 'Received', numeric: true, cell: (invoice) => <Amount value={invoice.received_msat} unit="msat" /> },
    { id: 'expires', header: 'Expires', cell: (invoice) => <InvoiceExpiryText invoice={invoice} /> },
    { id: 'description', header: 'Description', width: '12rem', cell: (invoice) => <InvoiceDescription invoice={invoice} /> },
    { id: 'hash', header: 'Payment hash', cell: (invoice) => <ShortIdentifier value={invoice.payment_hash} /> },
  ];
}

/** Phone row: amount and state, description (two lines), created time and expiry. */
function InvoiceRow({ invoice, open }: { invoice: Invoice; open: Open }) {
  return (
    <RowBody>
      <RowLine>
        <Amount value={invoice.amount_msat} unit="msat" />
        <StateWord state={INVOICE_STATE[invoice.state]} />
      </RowLine>
      <InvoiceDescription invoice={invoice} lines={2} />
      <RowLine>
        <Muted size="xs">{open(invoice, <ListTime at={invoice.created_at} />)}</Muted>
        <Muted size="xs">
          <InvoiceExpiryText invoice={invoice} />
        </Muted>
      </RowLine>
    </RowBody>
  );
}

const open: Open = (invoice, label) => (
  <TextLink
    from="/nodes/$nodeId/invoices"
    search={(previous) => ({ ...previous, selected: invoice.payment_hash })}
    {...ROW_PRIMARY_LINK}
  >
    {label}
    <VisuallyHidden>{` (Open invoice ${invoice.payment_hash.slice(0, 8)})`}</VisuallyHidden>
  </TextLink>
);
const listColumns = columns(open);
const getRowId = (invoice: Invoice) => invoice.payment_hash;
const renderRow = (invoice: Invoice) => <InvoiceRow invoice={invoice} open={open} />;

/** Invoices of the node in the server's order; the state filter and the selected record live in the URL. */
export function InvoicesPage() {
  const node = useCurrentNode();
  const size = useControlSize();
  const search = route.useSearch();
  const navigate = route.useNavigate();
  const invoices = useQuery(invoicesQueryOptions(node.id, { status: search.status, cursor: search.cursor }));
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
        columns={listColumns}
        getRowId={getRowId}
        renderRow={renderRow}
        emptyTitle={search.status ? `No invoices in state ${INVOICE_STATE[search.status].label}.` : 'No invoices on this node.'}
        cursor={search.cursor}
        onCursor={(cursor) => void navigate({ search: (previous) => ({ ...previous, cursor, selected: undefined }) })}
      />
    </Flex>
  );

  return (
    <Flex direction="column" gap="md">
      <InspectorLayout
        header={
          <PageHeader
            title="Invoices"
            actions={
              <CapabilityAction node={node} capability="create_invoice">
                <MoneyActionButton action="create_invoice" size={size} tone="accent" variant="solid">
                  Create invoice
                </MoneyActionButton>
              </CapabilityAction>
            }
          />
        }
        list={list}
        inspectorLabel="Selected invoice"
        inspector={
          selected === undefined || invoices.isPending ? null : (
            <InvoiceInspector
              invoice={selected}
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
