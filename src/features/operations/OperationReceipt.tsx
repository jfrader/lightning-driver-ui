import { Pill, styled } from '@jfrader/ui';
import { useQuery } from '@tanstack/react-query';
import { invoicesQueryOptions } from '../../api/node-queries';
import type { Operation } from '../../api/types';
import { INVOICE_RECEIPT_REFRESH_MS } from '../../config';
import { CopyField } from '../../components/CopyValue';
import { QrCode } from '../../components/QrCode';
import { Amount } from '../display/Amount';
import { formatAge, formatClockTime } from '../../lib/time';
import { useNow } from '../../lib/use-now';
import { INVOICE_STATE } from '../invoices/labels';
import { StateWord } from '../display/StateWord';
import { useOperationSheet } from './sheet-context';

const Card = styled.section(({ theme }) => ({
  display: 'grid',
  justifyItems: 'center',
  gap: theme.space[2],
  padding: theme.space[3],
  minInlineSize: 0,
  border: `1px solid ${theme.color.border}`,
  borderRadius: theme.radius.md,
  backgroundColor: theme.color.surface,
}));

const Header = styled.div(({ theme }) => ({
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  gap: theme.space[2], inlineSize: '100%',
}));
const Title = styled.h2(({ theme }) => ({ margin: 0, fontSize: theme.textSize.sm, color: theme.color.textMuted }));
const Hero = styled.div(({ theme }) => ({
  inlineSize: '100%', minInlineSize: 0, textAlign: 'center',
  fontSize: theme.textSize['3xl'], fontWeight: theme.fontWeight.semibold,
  overflowWrap: 'anywhere',
}));
const Description = styled.p(({ theme }) => ({
  margin: 0, fontSize: theme.textSize.sm, overflowWrap: 'anywhere', textAlign: 'center',
}));
const Dates = styled.div(({ theme }) => ({
  fontSize: theme.textSize.xs, color: theme.color.textMuted, textAlign: 'center',
}));

function ReceiptTime({ label, at }: { label: string; at: string }) {
  const now = useNow();
  return <div>{label} <time dateTime={at}>{formatAge(at, now)} · {formatClockTime(at)} UTC</time></div>;
}

function InvoiceReceiptState({ nodeId, paymentHash }: { nodeId: string; paymentHash: string }) {
  const sheet = useOperationSheet();
  const invoices = useQuery({
    ...invoicesQueryOptions(nodeId, {}),
    refetchInterval: (query) => {
      const state = query.state.data?.items.find(invoice => invoice.payment_hash === paymentHash)?.state ?? 'unpaid';
      return sheet !== null && state === 'unpaid' ? INVOICE_RECEIPT_REFRESH_MS : false;
    },
  });
  const state = invoices.data?.items.find(invoice => invoice.payment_hash === paymentHash)?.state ?? 'unpaid';
  return <StateWord state={INVOICE_STATE[state]} />;
}

export function OperationReceipt({ operation }: { operation: Operation }) {
  const { request, result } = operation;
  if (!result) return null;
  const invoice = request.kind === 'create_invoice' && result.kind === 'create_invoice' ? { params: request.params, result } : null;
  const address = request.kind === 'new_address' && result.kind === 'new_address' ? result.address : null;
  const payload = invoice ? invoice.result.bolt11.toUpperCase() : address;
  if (!payload) return null;
  const expiresAt = invoice ? new Date(Date.parse(operation.created_at) + invoice.params.expiry_seconds * 1000).toISOString() : null;
  return (
    <Card aria-label={invoice ? 'Invoice receipt' : 'Address receipt'}>
      <Header>
        <Title>Result</Title>
      </Header>
      <QrCode value={payload} label={invoice ? 'Invoice QR code' : 'Address QR code'} size="compact" />
      <CopyField value={invoice ? invoice.result.bolt11 : payload} label={invoice ? 'Invoice' : 'Address'} />
      {invoice && (
        <Hero>{invoice.params.amount_msat == null ? 'Any amount' : <Amount value={invoice.params.amount_msat} unit="msat" />}</Hero>
      )}
      {invoice?.params.description && <Description>{invoice.params.description}</Description>}
      {invoice ? <InvoiceReceiptState nodeId={operation.node_id} paymentHash={invoice.result.payment_hash} /> : <Pill tone="neutral">Created</Pill>}
      <Dates>
        <ReceiptTime label="Created" at={operation.created_at} />
        {expiresAt && <ReceiptTime label="Expires" at={expiresAt} />}
      </Dates>
    </Card>
  );
}
