import { Container, Flex, styled } from '@jfrader/ui';
import { Outlet } from '@tanstack/react-router';
import { TextLink } from '../../components/TextLink';
import { UnitToggle } from '../display/UnitToggle';
import { LogoutButton } from '../auth/LogoutButton';

const Bar = styled.header(({ theme }) => ({
  borderBlockEnd: `1px solid ${theme.color.border}`,
  backgroundColor: theme.color.surface,
  paddingBlock: theme.space[2],
}));

const AppName = styled.span(({ theme }) => ({ fontWeight: theme.fontWeight.semibold }));

const Main = styled.main(({ theme }) => ({ paddingBlock: theme.space[4] }));

export function AppShell() {
  return (
    <>
      <Bar>
        <Container size="xl">
          <Flex wrap gap="sm" align="center" justify="between">
            <AppName>Lightning Driver</AppName>
            <Flex wrap gap="sm" align="center">
              <TextLink to="/fleet">Fleet</TextLink>
              <UnitToggle />
              <LogoutButton />
            </Flex>
          </Flex>
        </Container>
      </Bar>
      <Main>
        <Container size="xl">
          <Outlet />
        </Container>
      </Main>
    </>
  );
}
