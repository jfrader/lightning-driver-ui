import { Flex, styled } from '@jfrader/ui';
import { useQuery } from '@tanstack/react-query';
import type { Session } from '../../api/types';
import { DetailList } from '../../components/DetailList';
import { ErrorNotice } from '../../components/ErrorNotice';
import { PageHeader } from '../../components/PageHeader';
import { Section } from '../../components/Section';
import { UtcTime } from '../../components/UtcTime';
import { APP_VERSION } from '../../config';
import { formatDurationSeconds } from '../../lib/duration';
import { useNow } from '../../lib/use-now';
import { ThemeChoice } from '../appearance/ThemeChoice';
import { LogoutButton } from '../auth/LogoutButton';
import { sessionQueryOptions } from '../auth/queries';
import { NotReported } from '../display/NotReported';
import { UnitToggle } from '../display/UnitToggle';
import { REAUTH_LABEL } from '../nodes/labels';

const Version = styled.p(({ theme }) => ({
  margin: 0,
  fontSize: theme.textSize.sm,
  color: theme.color.textMuted,
}));

function confirmationText(reauth: Session['reauth']): string {
  const label = REAUTH_LABEL[reauth.mode];
  return reauth.mode === 'recent' && reauth.recent_auth_seconds !== null
    ? `${label} · ${formatDurationSeconds(reauth.recent_auth_seconds)}`
    : label;
}

function SessionFacts() {
  const session = useQuery(sessionQueryOptions);
  const now = useNow();
  const data = session.data;
  const pending = <NotReported>…</NotReported>;
  return (
    <Flex direction="column" gap="sm" aria-busy={session.isPending || undefined}>
      <DetailList
        items={[
          { label: 'Signed in', value: data ? <UtcTime value={data.last_authenticated_at} /> : pending },
          { label: 'Session ends', value: data ? <UtcTime value={data.expires_at} now={now} /> : pending },
          { label: 'Ends if idle', value: data ? <UtcTime value={data.idle_expires_at} /> : pending },
          { label: 'Confirmation', value: data ? confirmationText(data.reauth) : pending },
        ]}
      />
      {session.isError && <ErrorNotice error={session.error} />}
    </Flex>
  );
}

/** Screens spec §5, phone only: theme, unit, session, sign out, version; nothing else. */
export function MorePage() {
  return (
    <Flex direction="column" gap="lg">
      <PageHeader title="More" level={1} />
      <Section title="Theme">
        <ThemeChoice />
      </Section>
      <Section title="Amount unit">
        <UnitToggle />
      </Section>
      <Section title="Session">
        <SessionFacts />
      </Section>
      <div>
        <LogoutButton variant="outline" />
      </div>
      {APP_VERSION && <Version>App version {APP_VERSION}</Version>}
    </Flex>
  );
}
