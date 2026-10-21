import { Alert } from '@jfrader/ui';
import type { NodeSummary } from '../../api/types';
import { TextLink } from '../../components/TextLink';
import { formatInteger, parseWireDecimal } from '../../lib/money';

/** Operations whose outcome is not final yet. They must resolve before the action is repeated. */
export function UnresolvedNotice({ node }: { node: NodeSummary }) {
  const count = parseWireDecimal(node.unresolved_operation_count);
  if (count === 0n) return null;
  return (
    <Alert tone="warning" title={`Unresolved operations: ${formatInteger(count)}`}>
      <TextLink to="/nodes/$nodeId/operations" params={{ nodeId: node.id }} search={{ state: 'nonterminal' }}>
        Review unresolved operations
      </TextLink>
    </Alert>
  );
}
