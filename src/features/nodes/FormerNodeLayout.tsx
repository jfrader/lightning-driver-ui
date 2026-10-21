import { Alert, Flex, styled } from '@jfrader/ui';
import { Outlet } from '@tanstack/react-router';
import { InlineCode } from '../../components/InlineCode';
import { TextLink } from '../../components/TextLink';

const Title = styled.h1(({ theme }) => ({
  margin: 0,
  fontSize: theme.textSize['2xl'],
  fontWeight: theme.fontWeight.semibold,
  overflowWrap: 'anywhere',
}));

/** A node ID the server no longer configures: its journal stays readable, nothing else. */
export function FormerNodeLayout({ nodeId }: { nodeId: string }) {
  return (
    <Flex direction="column" gap="md">
      <Title>
        <InlineCode>{nodeId}</InlineCode>
      </Title>
      <Alert tone="info" title="This node is not configured">
        <Flex wrap gap="sm">
          <TextLink to="/nodes/$nodeId/operations" params={{ nodeId }}>
            Operation history
          </TextLink>
          <TextLink to="/fleet">Fleet</TextLink>
        </Flex>
      </Alert>
      <Outlet />
    </Flex>
  );
}
