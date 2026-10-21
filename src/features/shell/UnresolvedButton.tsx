import { styled } from '@jfrader/ui';
import type { NodeSummary } from '../../api/types';
import { ButtonLink } from '../../components/ButtonLink';
import { formatInteger, parseWireDecimal } from '../../lib/money';
import { useControlSize } from './use-shell-layout';

const Marker = styled.span(({ theme }) => ({
  inlineSize: '0.5rem',
  blockSize: '0.5rem',
  borderRadius: '1px',
  backgroundColor: theme.color.warning,
  forcedColorAdjust: 'none',
}));

/** Always present for a node: the count of operations whose outcome is not final, linked to them. */
export function UnresolvedButton({ node }: { node: NodeSummary }) {
  const size = useControlSize();
  const count = parseWireDecimal(node.unresolved_operation_count);
  const none = count === 0n;
  return (
    <ButtonLink
      to="/nodes/$nodeId/operations"
      params={{ nodeId: node.id }}
      search={{ state: 'nonterminal' }}
      size={size}
      variant={none ? 'ghost' : 'outline'}
      startIcon={none ? undefined : <Marker />}
      style={{ whiteSpace: 'nowrap' }}
    >
      {`${formatInteger(count)} unresolved`}
    </ButtonLink>
  );
}
