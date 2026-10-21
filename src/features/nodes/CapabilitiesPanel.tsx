import type { NodeSummary } from '../../api/types';
import { DetailList } from '../../components/DetailList';
import { Panel } from '../../components/Panel';
import { keysOf } from '../../lib/guards';
import { CAPABILITY_LABEL, CAPABILITY_REASON } from './labels';

export function CapabilitiesPanel({ node }: { node: NodeSummary }) {
  return (
    <Panel title={node.read_only ? 'Capabilities (read-only node)' : 'Capabilities'}>
      <DetailList
        items={keysOf(CAPABILITY_LABEL).map((key) => {
          const state = node.capabilities[key];
          return { label: CAPABILITY_LABEL[key], value: state.enabled ? 'Available' : CAPABILITY_REASON[state.reason] };
        })}
      />
    </Panel>
  );
}
