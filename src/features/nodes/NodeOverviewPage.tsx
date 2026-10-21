import { styled } from '@jfrader/ui';
import { WIDE_LAYOUT_MEDIA } from '../../config';
import { BalancesPanel } from './BalancesPanel';
import { CapabilitiesPanel } from './CapabilitiesPanel';
import { NodeActions } from './NodeActions';
import { NodeInfoPanel } from './NodeInfoPanel';
import { useCurrentNode } from './use-current-node';

const Grid = styled.div(({ theme }) => ({
  display: 'grid',
  gap: theme.space[4],
  [WIDE_LAYOUT_MEDIA]: { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', alignItems: 'start' },
}));

export function NodeOverviewPage() {
  const node = useCurrentNode();
  return (
    <>
      <NodeActions node={node} />
      <Grid>
        <BalancesPanel nodeId={node.id} />
        <NodeInfoPanel node={node} />
        <CapabilitiesPanel node={node} />
      </Grid>
    </>
  );
}
