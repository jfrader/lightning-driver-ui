import { useState, type FormEvent } from 'react';
import { Flex, SegmentedControl, TextField } from '@jfrader/ui';
import { useQuery } from '@tanstack/react-query';
import { peersQueryOptions } from '../../api/node-queries';
import type { NodePolicy } from '../../api/types';
import { msatToWireSat } from '../../lib/money';
import { useDisplayUnit } from '../display/unit-context';
import { AmountField, type AmountEntry } from '../forms/AmountField';
import { createFieldError } from '../forms/create-errors';
import { FeeRateField } from '../forms/FeeRateField';
import { ReviewSubmit } from '../forms/ReviewSubmit';
import { checkAmount, checkFeeRate, checkPubkey, rangeText, type Checked } from '../forms/validation';
import { useSubmitOperation } from '../operations/use-submit-operation';
import { useControlSize } from '../shell/use-shell-layout';

const FIELDS = ['peer', 'amount'] as const;
const VISIBILITY = [
  { value: 'public', label: 'Public' },
  { value: 'private', label: 'Private' },
];

interface OpenChannelFormProps {
  nodeId: string;
  policy: NodePolicy;
  /** A peer key carried from the Peers inspector. */
  initialPeer?: string;
}

interface FormState {
  peer: string;
  amount: AmountEntry;
  feeRate: string;
  visibility: 'public' | 'private';
  submitted: boolean;
}

/** The peer's connection as the loaded peers page shows it; a hint, never a block (G-8). */
function useConnectionHint(nodeId: string, pubkey: string | null): string | null {
  const peers = useQuery(peersQueryOptions(nodeId, {}));
  if (!pubkey || !peers.data) return null;
  const peer = peers.data.items.find((item) => item.pubkey === pubkey);
  if (!peer) return 'Not on the loaded peers page.';
  return peer.connected ? 'Connected' : 'Not connected to this peer.';
}

/** Peer, channel size, visibility and fee rate; submitting creates the channel-open review (§7.5). */
export function OpenChannelForm({ nodeId, policy, initialPeer = '' }: OpenChannelFormProps) {
  const { unit } = useDisplayUnit();
  const size = useControlSize();
  const [form, setForm] = useState<FormState>({
    peer: initialPeer,
    amount: { text: '', unit },
    feeRate: '',
    visibility: 'public',
    submitted: false,
  });
  const submit = useSubmitOperation(nodeId);

  const peer = checkPubkey(form.peer);
  const amount = checkAmount(form.amount, { allowMsat: false, bounds: policy.open_channel_sat, boundsUnit: 'sat' });
  const feeRate = checkFeeRate(form.feeRate, policy.fee_rate_sat_vbyte);
  const show = (check: Checked<unknown>) => (form.submitted && !check.ok ? check.error : undefined);
  const connection = useConnectionHint(nodeId, peer.ok ? peer.value : null);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setForm((current) => ({ ...current, submitted: true }));
    if (!peer.ok || !amount.ok || !feeRate.ok || submit.isPending) return;
    submit.mutate({
      kind: 'open_channel',
      params: {
        peer_pubkey: peer.value,
        amount_sat: msatToWireSat(amount.value),
        private: form.visibility === 'private',
        fee_rate_sat_vbyte: feeRate.value.toString(),
      },
    });
  };

  return (
    <form noValidate onSubmit={onSubmit}>
      <Flex direction="column" gap="md">
        <TextField
          label="Peer public key"
          description={connection ?? undefined}
          value={form.peer}
          onValueChange={(value) => setForm((current) => ({ ...current, peer: value }))}
          autoComplete="off"
          spellCheck={false}
          error={show(peer) ?? createFieldError(submit.error, 'peer', FIELDS)}
          required
        />
        <AmountField
          label="Channel size"
          value={form.amount}
          onChange={(value) => setForm((current) => ({ ...current, amount: value }))}
          description={`Allowed: ${rangeText(policy.open_channel_sat, 'sat', form.amount.unit)}`}
          error={show(amount) ?? createFieldError(submit.error, 'amount', FIELDS)}
          required
        />
        <SegmentedControl
          label="Visibility"
          size={size}
          options={VISIBILITY}
          value={form.visibility}
          onValueChange={(value) => setForm((current) => ({ ...current, visibility: value === 'private' ? 'private' : 'public' }))}
        />
        <FeeRateField
          nodeId={nodeId}
          value={form.feeRate}
          onChange={(value) => setForm((current) => ({ ...current, feeRate: value }))}
          bounds={policy.fee_rate_sat_vbyte}
          error={show(feeRate)}
        />
        <ReviewSubmit label="Review channel open" pending={submit.isPending} error={submit.error} nodeId={nodeId} fields={FIELDS} />
      </Flex>
    </form>
  );
}
