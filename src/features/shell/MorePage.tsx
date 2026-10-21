import { Flex } from '@jfrader/ui';
import { useQuery } from '@tanstack/react-query';
import { DateTimeText } from '../../components/DateTimeText';
import { DetailList } from '../../components/DetailList';
import { PageHeader } from '../../components/PageHeader';
import { Panel } from '../../components/Panel';
import { ThemeChoice } from '../appearance/ThemeChoice';
import { LogoutButton } from '../auth/LogoutButton';
import { sessionQueryOptions } from '../auth/queries';
import { UnitToggle } from '../display/UnitToggle';

/** Phone only: theme, amount unit and session. Desktop carries these in the sidebar and strip. */
export function MorePage() {
  const session = useQuery(sessionQueryOptions);
  return (
    <Flex direction="column" gap="md">
      <PageHeader title="More" />
      <Panel title="Theme">
        <ThemeChoice />
      </Panel>
      <Panel title="Amount unit">
        <UnitToggle />
      </Panel>
      <Panel title="Session">
        {session.data && (
          <DetailList
            items={[
              { label: 'Signed in', value: <DateTimeText value={session.data.last_authenticated_at} /> },
              { label: 'Session ends', value: <DateTimeText value={session.data.expires_at} /> },
              { label: 'Ends if idle', value: <DateTimeText value={session.data.idle_expires_at} /> },
            ]}
          />
        )}
        <div>
          <LogoutButton variant="outline" />
        </div>
      </Panel>
    </Flex>
  );
}
