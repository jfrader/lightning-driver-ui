import { useState, type FormEvent } from 'react';
import { Button, Flex, TextField } from '@jfrader/ui';
import { NumberInputField } from '../../components/NumberInputField';
import { SubmitFeedback } from '../operations/SubmitFeedback';
import { useSubmitOperation } from '../operations/use-submit-operation';
import { DEFAULT_LIGHTNING_PORT, isPubkey, parsePort, splitPeerUri } from './peer-address';

const HOST_MAX_LENGTH = 253;

interface FormState {
  pubkey: string;
  host: string;
  port: string;
  submitted: boolean;
}

export function ConnectPeerForm({ nodeId }: { nodeId: string }) {
  const [form, setForm] = useState<FormState>({ pubkey: '', host: '', port: String(DEFAULT_LIGHTNING_PORT), submitted: false });
  const submit = useSubmitOperation(nodeId);

  const pubkey = form.pubkey.trim().toLowerCase();
  const host = form.host.trim();
  const port = parsePort(form.port);
  const errors = {
    pubkey: isPubkey(pubkey) ? undefined : 'Enter a 66-character hex public key starting with 02 or 03.',
    host: host && host.length <= HOST_MAX_LENGTH && !/[\s/@]/.test(host) ? undefined : 'Enter a host name or IP address.',
    port: port === null ? 'Enter a port from 1 to 65535.' : undefined,
  };

  const onPubkeyChange = (value: string) => {
    const uri = splitPeerUri(value);
    setForm((current) => (uri ? { ...current, ...uri } : { ...current, pubkey: value }));
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setForm((current) => ({ ...current, submitted: true }));
    if (errors.pubkey || errors.host || port === null || submit.isPending) return;
    submit.mutate({ kind: 'connect_peer', params: { pubkey, host, port } });
  };

  return (
    <form noValidate onSubmit={onSubmit}>
      <Flex direction="column" gap="md">
        <TextField
          label="Public key"
          description="Paste pubkey@host:port to fill all fields."
          value={form.pubkey}
          onValueChange={onPubkeyChange}
          autoComplete="off"
          spellCheck={false}
          error={form.submitted ? errors.pubkey : undefined}
          required
        />
        <TextField
          label="Host"
          value={form.host}
          onValueChange={(value) => setForm((current) => ({ ...current, host: value }))}
          autoComplete="off"
          spellCheck={false}
          error={form.submitted ? errors.host : undefined}
          required
        />
        <NumberInputField
          step={1}
          label="Port"
          value={form.port}
          onValueChange={(value) => setForm((current) => ({ ...current, port: value }))}
          error={form.submitted ? errors.port : undefined}
          required
        />
        <Flex>
          <Button type="submit" tone="accent" loading={submit.isPending}>
            Connect
          </Button>
        </Flex>
        <SubmitFeedback error={submit.error} result={submit.data} />
      </Flex>
    </form>
  );
}
