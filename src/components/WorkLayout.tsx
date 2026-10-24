import type { ReactNode, Ref } from 'react';
import { styled } from '@jfrader/ui';
import { ASIDE_MEDIA, ASIDE_WIDTH } from '../config';

const Grid = styled.div<{ measure: string; stacked: boolean }>(({ theme, measure, stacked }) => ({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  minInlineSize: 0,
  gap: theme.space[8],
  alignItems: 'start',
  [ASIDE_MEDIA]: stacked ? {} : { gridTemplateColumns: `minmax(0, ${measure}) ${ASIDE_WIDTH}`, gap: theme.space[10] },
}));

const Column = styled.div<{ measure: string }>(({ theme, measure }) => ({
  display: 'grid',
  gridTemplateColumns: `minmax(0, ${measure})`,
  gap: theme.space[8],
  minInlineSize: 0,
}));

const Aside = styled.aside<{ stacked: boolean }>(({ theme, stacked }) => ({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  gap: theme.space[8],
  minInlineSize: 0,
  [ASIDE_MEDIA]: stacked ? {} : { paddingInlineStart: theme.space[8], borderInlineStart: `1px solid ${theme.color.border}` },
}));

interface WorkLayoutProps {
  main: ReactNode;
  aside: ReactNode;
  asideLabel: string;
  /** Reading width for forms and reviews; lists use the full width. */
  mainWidth?: string;
  stacked?: boolean;
  asideRef?: Ref<HTMLElement>;
  asideTabIndex?: number;
}

/** Task column plus supporting context: beside it from 80rem, after it below that. */
export function WorkLayout({ main, aside, asideLabel, mainWidth = '1fr', stacked = false, asideRef, asideTabIndex }: WorkLayoutProps) {
  return (
    <Grid measure={mainWidth} stacked={stacked || aside == null}>
      <Column measure={mainWidth}>{main}</Column>
      {aside != null && <Aside ref={asideRef} tabIndex={asideTabIndex} stacked={stacked} aria-label={asideLabel}>{aside}</Aside>}
    </Grid>
  );
}
