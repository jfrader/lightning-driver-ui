import { styled } from '@jfrader/ui';
import type { AmountBounds } from '../../api/types';
import type { WireUnit } from '../../lib/money';
import { Amount } from './Amount';

const Range = styled.span({
  display: 'flex',
  flexWrap: 'wrap',
  columnGap: '0.4em',
  minInlineSize: 0,
});

/** A policy range "min to max" with exact bounds; wraps between its parts in narrow columns. */
export function AmountRange({ bounds, unit }: { bounds: AmountBounds; unit: WireUnit }) {
  return (
    <Range>
      <Amount value={bounds.min} unit={unit} />
      <span>to</span>
      <Amount value={bounds.max} unit={unit} />
    </Range>
  );
}
