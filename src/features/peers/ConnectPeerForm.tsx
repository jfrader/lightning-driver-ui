import { useState, type FormEvent } from 'react';
import { Flex, TextField } from '@jfrader/ui';
import { ExactNumberField } from '../../components/ExactNumberField';
import { createFieldError } from '../forms/create-errors';
import { ReviewSubmit } from '../forms/ReviewSubmit';
import { checkHost, checkPort, checkPubkey, type Checked } from '../forms/validation';
import { useSubmitOperation } from '../operations/use-submit-operation';
import { splitPeerUri } from './peer-address';

const FIELDS = ['peer'] as const;

interface FormState {
  pubkey: string;
  host: string;
  port: string;
  submitted: boolean;
}

/**
 * Public key, host and port; pasting `pubkey@host:port` fills all three visibly and submits nothing.
 * There is no default port (§7.3). Submitting creates the connection review.
 */
export function ConnectPeerForm({ nodeId }: { nodeId: string }) {
  const [form, setForm] = useState<FormState>({ pubkey: '', host: '', port: '', submitted: false });
  const submit = useSubmitOperation(nodeId);

  const pubkey = checkPubkey(form.pubkey);
  const host = checkHost(form.host);
  const port = checkPort(form.port);
  const show = (check: Checked<unknown>) => (form.submitted && !check.ok ? check.error : undefined);

  const onPubkeyChange = (value: string) => {
    const uri = splitPeerUri(value);
    setForm((current) => (uri ? { ...current, ...uri } : { ...current, pubkey: value }));
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setForm((current) => ({ ...current, submitted: true }));
    if (!pubkey.ok || !host.ok || !port.ok || submit.isPending) return;
    submit.mutate({ kind: 'connect_peer', params: { pubkey: pubkey.value, host: host.value, port: port.value } });
  };

  return (
    <form noValidate onSubmit={onSubmit}>
      <Flex direction="column" gap="md">
        <TextField
          label="Node public key"
          description="Paste pubkey@host:port to fill all fields."
          value={form.pubkey}
          onValueChange={onPubkeyChange}
          autoComplete="off"
          spellCheck={false}
          error={show(pubkey) ?? createFieldError(submit.error, 'peer', FIELDS)}
          required
        />
        <TextField
          label="Host"
          value={form.host}
          onValueChange={(value) => setForm((current) => ({ ...current, host: value }))}
          autoComplete="off"
          spellCheck={false}
          error={show(host)}
          required
        />
        <ExactNumberField
          kind="whole"
          label="Port"
          value={form.port}
          onValueChange={(value) => setForm((current) => ({ ...current, port: value }))}
          error={show(port)}
          required
        />
        <ReviewSubmit label="Review connection" pending={submit.isPending} error={submit.error} nodeId={nodeId} fields={FIELDS} />
      </Flex>
    </form>
  );
}
