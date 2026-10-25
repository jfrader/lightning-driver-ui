import { styled } from '@jfrader/ui';
import type { NodeSummary } from '../../api/types';
import { ButtonLink } from '../../components/ButtonLink';
import { formatInteger, parseWireDecimal } from '../../lib/money';
import { useControlSize } from './use-shell-layout';
import { surfacesFor } from './nav-model';

const Marker = styled.span(({ theme }) => ({
  inlineSize: '0.5rem',
  blockSize: '0.5rem',
  borderRadius: '1px',
  backgroundColor: theme.color.warning,
  forcedColorAdjust: 'none',
}));

/** The count of operations whose outcome is not final, linked to them. Nothing to show, nothing rendered. */
export function UnresolvedButton({ node }: { node: NodeSummary }) {
  const size = useControlSize();
  if (!surfacesFor(node).includes('operations')) return null;
  const count = parseWireDecimal(node.unresolved_operation_count);
  if (count === 0n) return null;
  return (
    <ButtonLink
      to="/nodes/$nodeId/operations"
      params={{ nodeId: node.id }}
      search={{ state: 'nonterminal' }}
      size={size}
      variant="outline"
      startIcon={<Marker />}
    >
      {`${formatInteger(count)} unresolved`}
    </ButtonLink>
  );
}
