import type { ReactNode } from 'react';
import { Card, Container, styled } from '@jfrader/ui';

const Page = styled.main(({ theme }) => ({
  minBlockSize: '100dvh',
  display: 'grid',
  alignItems: 'center',
  paddingBlock: theme.space[6],
}));

interface AuthLayoutProps {
  title: string;
  children: ReactNode;
}

export function AuthLayout({ title, children }: AuthLayoutProps) {
  return (
    <Page>
      <Container size="sm">
        <Card>
          <Card.Header>
            <Card.Title level={1}>{title}</Card.Title>
          </Card.Header>
          <Card.Content>{children}</Card.Content>
        </Card>
      </Container>
    </Page>
  );
}
