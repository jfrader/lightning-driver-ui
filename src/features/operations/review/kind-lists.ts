import type { OperationKind } from '../../../api/types';

export type ActionList = 'payments' | 'invoices' | 'onchain' | 'channels' | 'peers';

/** The list each kind of operation belongs to. */
export const LIST_OF_KIND: Record<OperationKind, ActionList> = {
  pay_invoice: 'payments',
  create_invoice: 'invoices',
  send_onchain: 'onchain',
  new_address: 'onchain',
  open_channel: 'channels',
  close_channel: 'channels',
  connect_peer: 'peers',
  disconnect_peer: 'peers',
};

/** The words of each list's back link. */
export const BACK_LABEL: Record<ActionList, string> = {
  payments: '‹ Payments',
  invoices: '‹ Invoices',
  onchain: '‹ On-chain',
  channels: '‹ Channels',
  peers: '‹ Peers',
};
