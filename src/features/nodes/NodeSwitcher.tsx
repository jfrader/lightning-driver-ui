import { Select } from '@jfrader/ui';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { fleetQueryOptions } from '../../api/node-queries';
import type { NodeSummary } from '../../api/types';
import { NETWORK_LABEL } from './labels';

/** Switching opens the other node's overview; nothing in progress follows the switch. */
export function NodeSwitcher({ node }: { node: NodeSummary }) {
  const navigate = useNavigate();
  const fleet = useQuery(fleetQueryOptions());
  const nodes = fleet.data?.items ?? [node];
  const options = nodes.map((item) => ({
    value: item.id,
    label: `${item.label} · ${NETWORK_LABEL[item.network]}`,
    textValue: item.label,
  }));
  if (!options.some((option) => option.value === node.id)) {
    options.unshift({ value: node.id, label: `${node.label} · ${NETWORK_LABEL[node.network]}`, textValue: node.label });
  }
  return (
    <Select
      label="Node"
      size="sm"
      options={options}
      value={node.id}
      onValueChange={(nodeId) => {
        if (nodeId !== node.id) void navigate({ to: '/nodes/$nodeId', params: { nodeId } });
      }}
    />
  );
}
