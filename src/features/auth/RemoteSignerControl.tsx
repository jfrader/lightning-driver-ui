import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Button, Flex } from '@jfrader/ui';
import { useMutation } from '@tanstack/react-query';
import { FormTextField } from '../../components/FormTextField';
import { QrCode } from '../../components/QrCode';
import { wrappingControlText } from '../../components/control-styles';
import { useControlSize } from '../shell/use-shell-layout';
import { chooseSigner, disconnectRemoteSigner, saveRemoteSigner, signerState } from './signer';
import { hasNostrExtension, signerSnapshot, subscribeSigner } from './signer-state';
import { SignerError } from './SignerError';

export default function RemoteSignerControl({ disabled }: { disabled: boolean }) {
  const size = useControlSize();
  useSyncExternalStore(subscribeSigner, signerSnapshot);
  const state = signerState();
  const [input, setInput] = useState('');
  const [uri, setURI] = useState<string | null>(null);
  const attempt = useRef<AbortController | null>(null);
  useEffect(() => () => attempt.current?.abort(), []);
  const connect = useMutation({
    mutationFn: async (qr: boolean) => {
      const controller = new AbortController();
      attempt.current = controller;
      const { connectRemoteSigner, closeRemoteSigner } = await import('./remote-signer');
      const connection = await connectRemoteSigner(input, { signal: controller.signal, onURI: qr ? setURI : undefined });
      if (controller.signal.aborted) await closeRemoteSigner(connection);
      else saveRemoteSigner(connection);
    },
    onSuccess: () => setInput(''),
    onSettled: () => setURI(null),
  });
  const busy = disabled || connect.isPending;
  const buttonStyle = wrappingControlText(size);
  return (
    <Flex direction="column" gap="sm" aria-label="Nostr signer">
      {state.choice === 'remote' && !state.remote && (
        <>
          <FormTextField
            label="Bunker URI" placeholder="bunker://" value={input} disabled={busy}
            onValueChange={(value) => { setInput(value); connect.reset(); }}
            autoComplete="off" autoCapitalize="off" autoCorrect="off" spellCheck={false}
          />
          <Button
            size={size} sx={buttonStyle} variant="outline" loading={connect.isPending && !connect.variables}
            disabled={busy || !input.trim()} onClick={() => connect.mutate(false)}
          >
            Connect remote signer
          </Button>
          <Button
            size={size} sx={buttonStyle} variant="ghost" loading={connect.isPending && connect.variables}
            disabled={busy || !input.trim()} onClick={() => connect.mutate(true)}
          >
            Connect with QR
          </Button>
        </>
      )}
      {uri && <QrCode value={uri} label="Remote signer connection" />}
      {connect.isPending && (
        <Button size={size} sx={buttonStyle} variant="ghost" onClick={() => attempt.current?.abort()}>
          Cancel connection
        </Button>
      )}
      {state.choice === 'extension' && (
        <Button size={size} sx={buttonStyle} variant="ghost" disabled={busy} onClick={() => { connect.reset(); chooseSigner('remote'); }}>
          Use remote signer
        </Button>
      )}
      {state.choice === 'remote' && hasNostrExtension() && (
        <Button size={size} sx={buttonStyle} variant="ghost" disabled={busy} onClick={() => { connect.reset(); chooseSigner('extension'); }}>
          Use browser extension
        </Button>
      )}
      {state.remote && (
        <Button size={size} sx={buttonStyle} variant="outline" disabled={busy} onClick={() => { connect.reset(); disconnectRemoteSigner(); }}>
          Disconnect remote signer
        </Button>
      )}
      {connect.isError && <SignerError error={connect.error} />}
    </Flex>
  );
}
