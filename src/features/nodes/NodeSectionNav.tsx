import { useState } from 'react';
import { Drawer, type NavigationGroupRecord } from '@jfrader/ui';
import { useLocation, useRouter } from '@tanstack/react-router';
import { RouterNavigation } from '../../components/RouterNavigation';
import { WIDE_LAYOUT_QUERY } from '../../config';
import { useMediaQuery } from '../../lib/use-media-query';

const SECTIONS = [
  { label: 'Overview', to: '/nodes/$nodeId' },
  { label: 'Invoices', to: '/nodes/$nodeId/invoices' },
  { label: 'Payments', to: '/nodes/$nodeId/payments' },
  { label: 'Peers', to: '/nodes/$nodeId/peers' },
  { label: 'Channels', to: '/nodes/$nodeId/channels' },
  { label: 'On-chain', to: '/nodes/$nodeId/onchain' },
  { label: 'Operations', to: '/nodes/$nodeId/operations' },
] as const;

interface NodeSectionNavProps {
  nodeId: string;
  nodeLabel: string;
}

export function NodeSectionNav({ nodeId, nodeLabel }: NodeSectionNavProps) {
  const router = useRouter();
  const { pathname } = useLocation();
  const wide = useMediaQuery(WIDE_LAYOUT_QUERY);
  const [open, setOpen] = useState(false);

  const items = SECTIONS.map(({ label, to }) => {
    const href = router.buildLocation({ to, params: { nodeId } }).href;
    const active = to === '/nodes/$nodeId' ? pathname === href : pathname.startsWith(href);
    return { key: to, label, href, active };
  });
  const groups: NavigationGroupRecord[] = [{ items }];
  const nav = <RouterNavigation label="Node sections" groups={groups} onNavigate={() => setOpen(false)} />;

  if (wide) return nav;
  return (
    <Drawer
      open={open}
      onOpenChange={setOpen}
      triggerLabel="Sections"
      title={nodeLabel}
      closeLabel="Close"
      content={nav}
    />
  );
}
