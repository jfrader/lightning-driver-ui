import { styled } from '@jfrader/ui';
import { Outlet } from '@tanstack/react-router';
import { Wordmark } from '../../components/Wordmark';
import { APP_VERSION, SIDEBAR_WIDTH, STRIP_HEIGHT, TAB_BAR_HEIGHT } from '../../config';
import { ThemeChoice } from '../appearance/ThemeChoice';
import { LogoutButton } from '../auth/LogoutButton';
import { useSessionExpiry } from '../auth/use-session-expiry';
import { ContentRegion } from './ContentRegion';
import { GroupLinks } from './GroupLinks';
import { NavPalette } from './NavPalette';
import { NodeChooser } from './NodeChooser';
import { PhoneTabs } from './PhoneTabs';
import { SideNav } from './SideNav';
import { StatusFacts } from './StatusFacts';
import { StatusStrip } from './StatusStrip';
import { UnresolvedButton } from './UnresolvedButton';
import { usePalette } from './use-palette';
import { useDesktopShell } from './use-shell-layout';
import { useShellNode } from './use-shell-node';

const CONTENT_ID = 'content';

const SkipLink = styled.a(({ theme }) => ({
  position: 'absolute',
  insetInlineStart: theme.space[2],
  insetBlockStart: theme.space[2],
  zIndex: 3,
  paddingBlock: theme.space[2],
  paddingInline: theme.space[3],
  borderRadius: theme.radius.md,
  backgroundColor: theme.color.surfaceRaised,
  color: theme.color.text,
  transform: 'translateY(-200%)',
  '&:focus-visible': { transform: 'none', outline: `2px solid ${theme.color.focusRing}` },
}));

const Desktop = styled.div({
  display: 'grid',
  gridTemplateColumns: `${SIDEBAR_WIDTH} minmax(0, 1fr)`,
  alignItems: 'start',
});

const Rail = styled.aside(({ theme }) => ({
  position: 'sticky',
  insetBlockStart: 0,
  blockSize: '100dvh',
  display: 'flex',
  flexDirection: 'column',
  backgroundColor: theme.color.bgSoft,
  borderInlineEnd: `1px solid ${theme.color.border}`,
}));

const RailHead = styled.div(({ theme }) => ({
  boxSizing: 'border-box',
  minBlockSize: STRIP_HEIGHT,
  display: 'flex',
  alignItems: 'center',
  paddingInline: theme.space[3],
  borderBlockEnd: `1px solid ${theme.color.border}`,
}));

const RailBody = styled.div(({ theme }) => ({
  flex: 1,
  overflowY: 'auto',
  paddingBlock: theme.space[3],
  paddingInline: theme.space[2],
}));

const RailFoot = styled.div(({ theme }) => ({
  display: 'grid',
  gap: theme.space[2],
  paddingBlock: theme.space[3],
  paddingInline: theme.space[3],
  borderBlockStart: `1px solid ${theme.color.border}`,
}));

const FootRow = styled.div(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: theme.space[2],
}));

const Mark = styled.div({ display: 'grid', minInlineSize: 0 });

const Version = styled.span(({ theme }) => ({
  fontSize: theme.textSize.xs,
  color: theme.color.textSubtle,
}));

const Workspace = styled.div({ minInlineSize: 0 });

const DesktopMain = styled.main(({ theme }) => ({
  paddingBlock: theme.space[6],
  paddingInline: theme.space[8],
  '&:focus': { outline: 'none' },
}));

const PhoneHeader = styled.header(({ theme }) => ({
  display: 'grid',
  gap: theme.space[2],
  paddingBlock: theme.space[3],
  paddingInline: theme.space[4],
  backgroundColor: theme.color.bgSoft,
  borderBlockEnd: `1px solid ${theme.color.border}`,
}));

const PhoneHeaderRow = styled.div(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  alignItems: 'center',
  gap: theme.space[2],
}));

const PhoneMain = styled.main(({ theme }) => ({
  boxSizing: 'border-box',
  inlineSize: '100%',
  paddingBlockStart: theme.space[4],
  paddingInline: theme.space[4],
  paddingBlockEnd: `calc(${TAB_BAR_HEIGHT} + ${theme.space[8]} + env(safe-area-inset-bottom))`,
  '&:focus': { outline: 'none' },
}));

/** The authenticated workbench: desktop sidebar + status strip, or phone header + bottom tabs. */
export function AppShell() {
  const desktop = useDesktopShell();
  const palette = usePalette();
  const { node, pathname } = useShellNode();
  useSessionExpiry();
  const content = (
    <ContentRegion screenKey={pathname}>
      <Outlet />
    </ContentRegion>
  );

  return (
    <>
      <SkipLink href={`#${CONTENT_ID}`}>Skip to content</SkipLink>
      {desktop ? (
        <Desktop>
          <Rail aria-label="Node and sections">
            <RailHead>
              <NodeChooser />
            </RailHead>
            <RailBody>
              <SideNav />
            </RailBody>
            <RailFoot>
              <ThemeChoice />
              <FootRow>
                <Mark>
                  <Wordmark />
                  {APP_VERSION && <Version>App version {APP_VERSION}</Version>}
                </Mark>
                <LogoutButton />
              </FootRow>
            </RailFoot>
          </Rail>
          <Workspace>
            <StatusStrip onOpenPalette={() => palette.setOpen(true)} />
            <DesktopMain id={CONTENT_ID} tabIndex={-1}>
              {content}
            </DesktopMain>
          </Workspace>
        </Desktop>
      ) : (
        <>
          <PhoneHeader>
            <PhoneHeaderRow>
              <NodeChooser />
              {node && <UnresolvedButton node={node} />}
            </PhoneHeaderRow>
            {node && <StatusFacts node={node} compact />}
          </PhoneHeader>
          <PhoneMain id={CONTENT_ID} tabIndex={-1}>
            <GroupLinks />
            {content}
          </PhoneMain>
          <PhoneTabs />
        </>
      )}
      <NavPalette open={palette.open} onOpenChange={palette.setOpen} />
    </>
  );
}
