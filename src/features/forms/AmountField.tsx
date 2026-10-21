import { useState } from 'react';
import { Flex, SegmentedControl } from '@jfrader/ui';
import { ExactNumberField } from '../../components/ExactNumberField';
import { isKeyOf, keysOf } from '../../lib/guards';
import { PLAIN_DECIMAL_HINT, UNIT_LABEL, formatMsatInput, parseAmountInput, type DisplayUnit } from '../../lib/money';

export interface AmountEntry {
  /** The text exactly as entered, e.g. "0.0015". */
  text: string;
  unit: DisplayUnit;
}

const UNIT_OPTIONS = keysOf(UNIT_LABEL).map((unit) => ({ value: unit, label: UNIT_LABEL[unit] }));
const UNIT_BLOCKED = 'Correct the amount before changing the unit.';

/**
 * Re-expresses the entered amount exactly in the new unit. Text that is not a valid amount keeps
 * its unit, so the same digits are never read as a different amount.
 */
function convertEntry(entry: AmountEntry, unit: DisplayUnit): AmountEntry | null {
  if (entry.text === '') return { unit, text: '' };
  const parsed = parseAmountInput(entry.text, entry.unit, { allowMsat: true });
  return parsed.ok ? { unit, text: formatMsatInput(parsed.msat, unit) } : null;
}

interface AmountFieldProps {
  label: string;
  value: AmountEntry;
  onChange: (value: AmountEntry) => void;
  error?: string;
  required?: boolean;
}

/**
 * Exact amount entry in the chosen unit, parsed later to bigint millisatoshis.
 * The unit belongs to the entry, so changing the session display unit never rescales entered digits.
 */
export function AmountField({ label, value, onChange, error, required }: AmountFieldProps) {
  const [unitBlocked, setUnitBlocked] = useState(false);
  return (
    <Flex gap="sm" align="end" wrap>
      <ExactNumberField
        kind="decimal"
        label={`${label} (${UNIT_LABEL[value.unit]})`}
        description={PLAIN_DECIMAL_HINT}
        value={value.text}
        onValueChange={(text) => {
          setUnitBlocked(false);
          onChange({ ...value, text });
        }}
        error={unitBlocked ? UNIT_BLOCKED : error}
        required={required}
        sx={{ flex: '1 1 12rem' }}
      />
      <SegmentedControl
        label={`${label} unit`}
        size="sm"
        options={UNIT_OPTIONS}
        value={value.unit}
        onValueChange={(unit) => {
          if (!isKeyOf(UNIT_LABEL, unit)) return;
          const converted = convertEntry(value, unit);
          setUnitBlocked(converted === null);
          if (converted) onChange(converted);
        }}
      />
    </Flex>
  );
}
