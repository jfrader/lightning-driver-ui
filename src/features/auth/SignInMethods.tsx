import { useId, useState } from 'react';
import { Alert, Button, Flex, styled } from '@jfrader/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { errorCode } from '../../api/errors';
import type { ErrorCode, NostrIdentity } from '../../api/types';
import { DetailList } from '../../components/DetailList';
import { ErrorNotice } from '../../components/ErrorNotice';
import { formatInteger } from '../../lib/money';
import { Identifier } from '../display/Identifier';
import { NotReported } from '../display/NotReported';
import { useControlSize, useDesktopShell } from '../shell/use-shell-layout';
import { linkNostr, unlinkNostr } from './ceremonies';
import { NOSTR_FAILURE_MESSAGE, hasNostrExtension } from './nostr';
import { nostrIdentitiesQueryOptions, sessionQueryOptions } from './queries';
import { SignerError } from './SignerError';
import { useSessionStart } from './use-session-start';
import { useSignedOut } from './use-signed-out';

const Line = styled.p({ margin: 0 });

const List = styled.ul(({ theme }) => ({
  margin: 0,
  padding: 0,
  listStyle: 'none',
  display: 'grid',
  gap: theme.space[2],
  minInlineSize: 0,
}));

const KEEP_ONE = 'Keep at least one sign-in method.';
const EXPIRED = 'The signature request expired. Try again.';

const LINK_TEXT: Partial<Record<ErrorCode, string>> = {
  challenge_expired: EXPIRED,
  challenge_invalid: EXPIRED,
};

const UNLINK_TEXT: Partial<Record<ErrorCode, string>> = {
  ...LINK_TEXT,
  last_credential: KEEP_ONE,
  authentication_failed: 'Sign with the key you are removing.',
};

/** A refusal with its literal sentence, else the signer's or the server's own wording. */
function MethodError({ error, texts }: { error: unknown; texts: Partial<Record<ErrorCode, string>> }) {
  const code = errorCode(error);
  const text = code === null ? undefined : texts[code];
  return text ? <Alert tone="warning">{text}</Alert> : <SignerError error={error} />;
}

function NostrKey({ identity, removable }: { identity: NostrIdentity; removable: boolean }) {
  const size = useControlSize();
  const desktop = useDesktopShell();
  const signedOut = useSignedOut();
  const [confirming, setConfirming] = useState(false);
  // Success revokes this session on the server: nothing read with it stays.
  const unlink = useMutation({ mutationFn: () => unlinkNostr(identity.pubkey), onSuccess: signedOut });

  return (
    <li>
      <Flex direction="column" gap="sm">
        <Identifier value={identity.npub} label="npub" grouped={false} truncated={!desktop} />
        {confirming ? (
          <Flex wrap gap="sm" align="center">
            <Button size={size} variant="solid" tone="danger" loading={unlink.isPending} onClick={() => unlink.mutate()}>
              Remove key
            </Button>
            <Button size={size} variant="ghost" disabled={unlink.isPending} onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </Flex>
        ) : (
          <div>
            <Button size={size} variant="outline" tone="danger" disabled={!removable} onClick={() => setConfirming(true)}>
              Remove…
            </Button>
          </div>
        )}
        {unlink.isError && <MethodError error={unlink.error} texts={UNLINK_TEXT} />}
      </Flex>
    </li>
  );
}

function NostrKeys({ identities, removable }: { identities: readonly NostrIdentity[]; removable: boolean }) {
  if (identities.length === 0) return formatInteger(0n);
  return (
    <List>
      {identities.map((identity) => (
        <NostrKey key={identity.pubkey} identity={identity} removable={removable} />
      ))}
    </List>
  );
}

/** Passkeys on this server and the linked Nostr keys, with link and remove for Nostr. */
export function SignInMethods() {
  const size = useControlSize();
  const queryClient = useQueryClient();
  const methods = useQuery(nostrIdentitiesQueryOptions);
  const session = useQuery(sessionQueryOptions);
  const extension = hasNostrExtension();
  const startSession = useSessionStart();
  const reasonId = useId();
  const link = useMutation({
    // A stale session signs in again first; that replaces the session, its CSRF and its reads.
    mutationFn: async () => {
      const { identity, replaced } = await linkNostr(session.data!.auth_method);
      if (replaced) startSession(replaced);
      return identity;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: nostrIdentitiesQueryOptions.queryKey });
      void queryClient.invalidateQueries({ queryKey: sessionQueryOptions.queryKey });
    },
  });
  const data = methods.data;
  const pending = <NotReported>…</NotReported>;
  const removable = data !== undefined && data.passkey_count + data.identities.length > 1;

  return (
    <Flex direction="column" gap="sm" aria-busy={methods.isPending || undefined}>
      <DetailList
        items={[
          { label: 'Passkeys', value: data ? formatInteger(BigInt(data.passkey_count)) : pending },
          {
            label: 'Nostr keys',
            stacked: (data?.identities.length ?? 0) > 0,
            value: data ? <NostrKeys identities={data.identities} removable={removable} /> : pending,
          },
        ]}
      />
      {data && !removable && data.identities.length > 0 && <Line>{KEEP_ONE}</Line>}
      {methods.isError && <ErrorNotice error={methods.error} />}
      <div>
        <Button
          size={size}
          variant="outline"
          loading={link.isPending}
          disabled={!extension || !session.data}
          aria-describedby={extension ? undefined : reasonId}
          onClick={() => link.mutate()}
        >
          Link Nostr
        </Button>
      </div>
      {!extension && <Line id={reasonId}>{NOSTR_FAILURE_MESSAGE.missing}</Line>}
      {link.isError && <MethodError error={link.error} texts={LINK_TEXT} />}
    </Flex>
  );
}
