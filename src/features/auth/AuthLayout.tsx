import type { ReactNode } from 'react';
import { Surface, styled } from '@jfrader/ui';
import { AUTH_COLUMN_WIDTH } from '../../config';
import { Wordmark } from '../../components/Wordmark';

const Page = styled.main(({ theme }) => ({
  boxSizing: 'border-box',
  minBlockSize: '100dvh',
  display: 'grid',
  placeItems: 'center',
  paddingBlock: theme.space[6],
  paddingInline: theme.space[4],
  backgroundColor: theme.color.bg,
}));

const Column = styled.div(({ theme }) => ({
  inlineSize: '100%',
  maxInlineSize: AUTH_COLUMN_WIDTH,
  display: 'grid',
  gap: theme.space[3],
}));

const Pane = styled(Surface)(({ theme }) => ({
  display: 'grid',
  gap: theme.space[4],
  padding: theme.space[5],
  borderBlockStart: `2px solid ${theme.color.accent}`,
  minInlineSize: 0,
}));

const Title = styled.h1(({ theme }) => ({
  margin: 0,
  fontSize: theme.textSize.xl,
  fontWeight: theme.fontWeight.semibold,
}));

interface AuthLayoutProps {
  title: string;
  /** L0: the column is busy until the bootstrap answers. */
  busy?: boolean;
  children?: ReactNode;
}

/** Screens spec §6: centred column, wordmark, pane title; no hero, no illustration. */
export function AuthLayout({ title, busy = false, children }: AuthLayoutProps) {
  return (
    <Page>
      <Column>
        <Wordmark />
        <Pane aria-busy={busy || undefined}>
          <Title>{title}</Title>
          {children}
        </Pane>
      </Column>
    </Page>
  );
}
