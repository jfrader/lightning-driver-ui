import { Pill, styled } from '@jfrader/ui';
import type { Operation } from '../../api/types';
import { CopyAction, CopyValue } from '../../components/CopyValue';
import { QrCode } from '../../components/QrCode';
import { Amount } from '../display/Amount';
import { formatAge, formatClockTime } from '../../lib/time';
import { useNow } from '../../lib/use-now';
import { OPERATION_STATE } from './labels';

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
const Address = styled.div(({ theme }) => ({
  inlineSize: '100%', minInlineSize: 0, fontFamily: theme.font.mono,
  fontSize: theme.textSize.lg,
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

export function OperationReceipt({ operation }: { operation: Operation }) {
  const { request, result } = operation;
  if (!result) return null;
  const invoice = request.kind === 'create_invoice' && result.kind === 'create_invoice' ? { params: request.params, result } : null;
  const address = request.kind === 'new_address' && result.kind === 'new_address' ? result.address : null;
  const payload = invoice ? invoice.result.bolt11.toUpperCase() : address;
  if (!payload) return null;
  const state = OPERATION_STATE[operation.state];
  const expiresAt = invoice ? new Date(Date.parse(operation.created_at) + invoice.params.expiry_seconds * 1000).toISOString() : null;
  return (
    <Card aria-label={invoice ? 'Invoice receipt' : 'Address receipt'}>
      <Header>
        <Title>Result</Title>
        {invoice && <CopyAction value={invoice.result.bolt11} label="Invoice" />}
      </Header>
      <QrCode value={payload} label={invoice ? 'Invoice QR code' : 'Address QR code'} />
      {invoice ? (
        <Hero>{invoice.params.amount_msat == null ? 'Any amount' : <Amount value={invoice.params.amount_msat} unit="msat" />}</Hero>
      ) : <Address><CopyValue value={payload} label="Address" align="start" prominent /></Address>}
      {invoice?.params.description && <Description>{invoice.params.description}</Description>}
      <Pill tone={state.tone}>{state.label}</Pill>
      <Dates>
        <ReceiptTime label="Created" at={operation.created_at} />
        {expiresAt && <ReceiptTime label="Expires" at={expiresAt} />}
      </Dates>
    </Card>
  );
}
