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
      options={OPTIONS}
      value={unit}
      onValueChange={(value) => {
        if (isKeyOf(UNIT_LABEL, value)) setUnit(value);
      }}
    />
  );
}
