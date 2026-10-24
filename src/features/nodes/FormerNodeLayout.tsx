import { Alert, Flex, styled } from '@jfrader/ui';
import { Outlet } from '@tanstack/react-router';
import { InlineCode } from '../../components/InlineCode';
import { ButtonLink } from '../../components/ButtonLink';
import { useControlSize } from '../shell/use-shell-layout';

const Title = styled.h1(({ theme }) => ({
  margin: 0,
  fontSize: theme.textSize['2xl'],
  fontWeight: theme.fontWeight.semibold,
  overflowWrap: 'anywhere',
}));

/** A node ID the server no longer configures: its journal stays readable, nothing else. */
export function FormerNodeLayout({ nodeId }: { nodeId: string }) {
  const size = useControlSize();
  return (
    <Flex direction="column" gap="md">
      <Title>
        <InlineCode>{nodeId}</InlineCode>
      </Title>
      <Alert tone="info" title="This node is not configured">
        <Flex wrap gap="sm">
          <ButtonLink to="/nodes/$nodeId/operations" params={{ nodeId }} size={size} variant="outline">
            Operation history
          </ButtonLink>
          <ButtonLink to="/fleet" size={size} variant="outline">Fleet</ButtonLink>
        </Flex>
      </Alert>
      <Outlet />
    </Flex>
  );
}
