import { SegmentedControl } from '@jfrader/ui';
import { isKeyOf, keysOf } from '../../lib/guards';
import { UNIT_LABEL } from '../../lib/money';
import { useControlSize } from '../shell/use-shell-layout';
import { useDisplayUnit } from './unit-context';

const OPTIONS = keysOf(UNIT_LABEL).map((unit) => ({ value: unit, label: UNIT_LABEL[unit] }));

export function UnitToggle() {
  const { unit, setUnit } = useDisplayUnit();
  const size = useControlSize();
  return (
    <SegmentedControl
      label="Display unit"
      size={size}
      // On the desktop strip every control is 2.5rem; touch layouts keep their own target size.
      slotProps={size === 'sm' ? { root: { sx: { minBlockSize: '2.5rem', boxSizing: 'border-box' } } } : undefined}
      options={OPTIONS}
      value={unit}
      onValueChange={(value) => {
        if (isKeyOf(UNIT_LABEL, value)) setUnit(value);
      }}
    />
  );
}
