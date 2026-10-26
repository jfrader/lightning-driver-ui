import { Suspense, lazy } from 'react';
import { styled } from '@jfrader/ui';
import { Outlet, useSearch } from '@tanstack/react-router';
import { useCachedQueryData } from '../../api/use-cached-query-data';
import { Wordmark } from '../../components/Wordmark';
import { OverlayInvokerContext } from '../../components/overlay-invoker-context';
import { APP_VERSION, SIDEBAR_WIDTH, STRIP_HEIGHT, TAB_BAR_HEIGHT, TAB_BAR_CLEARANCE, TOUCH_TARGET } from '../../config';
import { ThemeChoice } from '../appearance/ThemeChoice';
import { LogoutButton } from '../auth/LogoutButton';
import { useSessionExpiry } from '../auth/use-session-expiry';
import { sessionQueryOptions } from '../auth/queries';
import { ContentRegion } from './ContentRegion';
import { GroupLinks } from './GroupLinks';
import { NodeChooser } from './NodeChooser';
import { PhoneTabs } from './PhoneTabs';
import { SideNav } from './SideNav';
import { usePalette } from './use-palette';
import { MoneySheetContext } from './money-sheet-context';
import { useOverlayEntry } from './use-overlay-entry';
import { useDesktopShell } from './use-shell-layout';
import { useShellNode } from './use-shell-node';

const CONTENT_ID = 'content';
const NavPalette = lazy(() => import('./NavPalette').then((module) => ({ default: module.NavPalette })));
const GlobalMoneySheet = lazy(() => import('./GlobalMoneySheet').then((module) => ({ default: module.GlobalMoneySheet })));
const GlobalMoneyActions = lazy(() => import('./GlobalMoneyActions').then((module) => ({ default: module.GlobalMoneyActions })));
const StatusStrip = lazy(() => import('./StatusStrip').then((module) => ({ default: module.StatusStrip })));

const SkipLink = styled.a(({ theme }) => ({
  position: 'absolute',
  insetInlineStart: theme.space[2],
  insetBlockStart: theme.space[2],
  zIndex: 3,
  display: 'inline-flex',
  alignItems: 'center',
  minBlockSize: TOUCH_TARGET,
  boxSizing: 'border-box',
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
  flexWrap: 'wrap',
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
  gridTemplateColumns: 'minmax(0, 1fr)',
  gap: theme.space[2],
  paddingBlock: theme.space[3],
  paddingInline: theme.space[4],
  backgroundColor: theme.color.bgSoft,
  borderBlockEnd: `1px solid ${theme.color.border}`,
}));

const PhoneHeaderRow = styled.div(({ theme }) => ({
  display: 'flex',
  minInlineSize: 0,
  flexWrap: 'nowrap',
  alignItems: 'center',
  gap: theme.space[2],
  '& > :first-child': { flex: '1 1 0', minInlineSize: 0, inlineSize: 'auto' },
  '& > button': { flexShrink: 0 },
}));

const PhoneMain = styled.main(({ theme }) => ({
  boxSizing: 'border-box',
  inlineSize: '100%',
  paddingBlockStart: theme.space[4],
  paddingInline: theme.space[4],
  paddingBlockEnd: `calc(${TAB_BAR_HEIGHT} + ${TAB_BAR_CLEARANCE} + env(safe-area-inset-bottom))`,
  '&:focus': { outline: 'none' },
  '& :is(a, button, input, select, textarea, [tabindex])': {
    scrollMarginBlockEnd: `calc(${TAB_BAR_HEIGHT} + ${TAB_BAR_CLEARANCE} + env(safe-area-inset-bottom))`,
  },
}));

/** The authenticated workbench: desktop sidebar + status strip, or phone header + bottom tabs. */
export function AppShell() {
  const desktop = useDesktopShell();
  const palette = usePalette();
  const { node, pathname } = useShellNode();
  const search = useSearch({ strict: false });
  const moneySheet = useOverlayEntry('moneySheet', !!(search.send || search.receive || search.operation));
  const session = useCachedQueryData(sessionQueryOptions.queryKey);
  useSessionExpiry();
  if (!session) return null;
  const content = (
    <ContentRegion screenKey={pathname}>
      <Outlet />
    </ContentRegion>
  );

  return (
    <OverlayInvokerContext value={palette.invoker}>
      <MoneySheetContext value={moneySheet}>
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
              <Suspense fallback={null}><StatusStrip onOpenPalette={() => palette.setOpen(true)} /></Suspense>
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
                <Suspense fallback={null}><GlobalMoneyActions node={node} /></Suspense>
              </PhoneHeaderRow>
            </PhoneHeader>
            <PhoneMain
              id={CONTENT_ID}
              tabIndex={-1}
              onFocus={(event) => {
                if (event.target !== event.currentTarget && event.target.matches(':focus-visible')) {
                  event.target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
                }
              }}
            >
              <GroupLinks />
              {content}
            </PhoneMain>
            <PhoneTabs />
          </>
        )}
        <Suspense fallback={null}>
          {palette.open && <NavPalette open onOpenChange={palette.setOpen} />}
          {node && search.operation && <GlobalMoneySheet key={node.id} node={node} />}
        </Suspense>
      </MoneySheetContext>
    </OverlayInvokerContext>
  );
}
