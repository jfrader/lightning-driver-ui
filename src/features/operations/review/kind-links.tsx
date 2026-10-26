import type { MouseEvent } from 'react';
import { Button } from '@jfrader/ui';
import { useOperationSheet } from '../sheet-context';
import type { Operation } from '../../../api/types';
import { ButtonLink } from '../../../components/ButtonLink';
import { useControlSize } from '../../shell/use-shell-layout';
import { MoneyActionButton } from '../../shell/MoneyActionButton';
import { BACK_LABEL, type ActionList } from './kind-lists';

interface KindLinkProps {
  operation: Operation;
  label: string;
  variant?: 'ghost' | 'outline';
  /** A link that stays visible but does nothing (e.g. once a confirmation is sent). */
  disabled?: boolean;
}

const inert = (disabled: boolean) => (event: MouseEvent) => {
  if (disabled) event.preventDefault();
};

/** Back to a node's list (Payments, Invoices, On-chain, Channels, Peers) from a form or a review. */
export function ListLink({ nodeId, list }: { nodeId: string; list: ActionList }) {
  const sheet = useOperationSheet();
  const props = { params: { nodeId }, search: {}, size: useControlSize(), variant: 'ghost' as const };
  if (sheet) return null;
  const label = BACK_LABEL[list];
  switch (list) {
    case 'payments':
      return <ButtonLink to="/nodes/$nodeId/payments" {...props}>{label}</ButtonLink>;
    case 'invoices':
      return <ButtonLink to="/nodes/$nodeId/invoices" {...props}>{label}</ButtonLink>;
    case 'onchain':
      return <ButtonLink to="/nodes/$nodeId/onchain" {...props}>{label}</ButtonLink>;
    case 'channels':
      return <ButtonLink to="/nodes/$nodeId/channels" {...props}>{label}</ButtonLink>;
    case 'peers':
      return <ButtonLink to="/nodes/$nodeId/peers" {...props}>{label}</ButtonLink>;
  }
}

/** The form that creates this kind of operation; disconnect has none and returns to Peers. */
export function FormLink({ operation, label, variant = 'outline', disabled = false }: KindLinkProps) {
  const sheet = useOperationSheet();
  const size = useControlSize();
  const { request } = operation;
  if (request.kind === 'pay_invoice' || request.kind === 'create_invoice' || request.kind === 'send_onchain' || request.kind === 'new_address') {
    return <MoneyActionButton action={request.kind} size={size} variant={variant} disabled={disabled}>{label}</MoneyActionButton>;
  }
  if (sheet) return <Button size={size} variant={variant} disabled={disabled} onClick={sheet.discard}>{label}</Button>;
  const nodeId = operation.node_id;
  const props = { size, variant, 'aria-disabled': disabled || undefined, onClick: inert(disabled) };
  switch (request.kind) {
    case 'open_channel':
      return (
        <ButtonLink to="/nodes/$nodeId/channels/new" params={{ nodeId }} search={{ peer: request.params.peer_pubkey }} {...props}>
          {label}
        </ButtonLink>
      );
    case 'close_channel':
      return (
        <ButtonLink to="/nodes/$nodeId/channels/$channelId/close" params={{ nodeId, channelId: request.params.channel_id }} {...props}>
          {label}
        </ButtonLink>
      );
    case 'connect_peer':
      return <ButtonLink to="/nodes/$nodeId/peers/new" params={{ nodeId }} {...props}>{label}</ButtonLink>;
    case 'disconnect_peer':
      return (
        <ButtonLink to="/nodes/$nodeId/peers" params={{ nodeId }} search={{ selected: request.params.pubkey }} {...props}>
          {label}
        </ButtonLink>
      );
  }
}
