import { useState, type FormEvent } from 'react';
import { Alert, Flex, styled } from '@jfrader/ui';
import type { Channel, NodePolicy } from '../../api/types';
import { DetailList } from '../../components/DetailList';
import { Amount } from '../display/Amount';
import { Identifier } from '../display/Identifier';
import { StateWord } from '../display/StateWord';
import { FeeRateField } from '../forms/FeeRateField';
import { ReviewSubmit } from '../forms/ReviewSubmit';
import { checkFeeRate } from '../forms/validation';
import { useSubmitOperation } from '../operations/use-submit-operation';
import { CHANNEL_STATE, channelName } from './labels';

const Mono = styled.span(({ theme }) => ({ fontFamily: theme.font.mono, fontSize: theme.textSize.sm, overflowWrap: 'anywhere' }));

interface CloseChannelFormProps {
  nodeId: string;
  channel: Channel;
  policy: NodePolicy;
}

/** Cooperative close of one channel; the only input is the requested fee rate. No force close (§7.6). */
export function CloseChannelForm({ nodeId, channel, policy }: CloseChannelFormProps) {
  const [form, setForm] = useState({ feeRate: '', submitted: false });
  const submit = useSubmitOperation(nodeId);
  const feeRate = checkFeeRate(form.feeRate, policy.fee_rate_sat_vbyte);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setForm((current) => ({ ...current, submitted: true }));
    if (!feeRate.ok || submit.isPending) return;
    submit.mutate({ kind: 'close_channel', params: { channel_id: channel.id, fee_rate_sat_vbyte: feeRate.value.toString() } });
  };

  return (
    <form noValidate onSubmit={onSubmit}>
      <Flex direction="column" gap="md">
        <DetailList
          items={[
            { label: 'Channel', value: <Mono>{channelName(channel)}</Mono> },
            { label: 'State', value: <StateWord state={CHANNEL_STATE[channel.state]} /> },
            { label: 'Capacity', numeric: true, value: <Amount value={channel.capacity_sat} unit="sat" /> },
            { label: 'Local balance', numeric: true, value: <Amount value={channel.local_msat} unit="msat" /> },
            { label: 'Peer', stacked: true, value: <Identifier value={channel.peer_pubkey} label="Peer" /> },
          ]}
        />
        <Alert tone="warning" title="Cooperative close only. The peer must be online." />
        <FeeRateField
          nodeId={nodeId}
          value={form.feeRate}
          onChange={(value) => setForm((current) => ({ ...current, feeRate: value }))}
          bounds={policy.fee_rate_sat_vbyte}
          error={form.submitted && !feeRate.ok ? feeRate.error : undefined}
        />
        <ReviewSubmit label="Review close" tone="danger" pending={submit.isPending} error={submit.error} nodeId={nodeId} />
      </Flex>
    </form>
  );
}
