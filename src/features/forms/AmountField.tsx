import { useState } from 'react';
import { SegmentedControl, styled } from '@jfrader/ui';
import { ExactNumberField } from '../../components/ExactNumberField';
import { isKeyOf, keysOf } from '../../lib/guards';
import { PLAIN_DECIMAL_HINT, UNIT_LABEL, formatInteger, formatMsatInput, parseAmountInput, type DisplayUnit } from '../../lib/money';
import { useControlSize } from '../shell/use-shell-layout';

export interface AmountEntry {
  /** The text exactly as entered, e.g. "0.0015". */
  text: string;
  unit: DisplayUnit;
}

const UNIT_OPTIONS = keysOf(UNIT_LABEL).map((unit) => ({ value: unit, label: UNIT_LABEL[unit] }));
const UNIT_BLOCKED = 'Correct the amount before changing the unit.';
const AmountRow = styled.div(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) max-content',
  columnGap: theme.space[2],
  rowGap: theme.space[1],
}));

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
  /** The node's allowed range or a fee helper, shown with the entry hint. */
  description?: string;
  error?: string;
  required?: boolean;
}

/** `= 2,500,000 msat` for a parseable entry: the exact value that will be requested. */
function readback(entry: AmountEntry): string | null {
  const parsed = parseAmountInput(entry.text, entry.unit, { allowMsat: true, allowZero: true });
  return parsed.ok ? `= ${formatInteger(parsed.msat)} msat` : null;
}

/**
 * Exact amount entry in the chosen unit, parsed later to bigint millisatoshis, with the exact msat
 * it reads as. The unit belongs to the entry, so changing the session display unit never rescales
 * entered digits.
 */
export function AmountField({ label, value, onChange, description, error, required }: AmountFieldProps) {
  const [unitBlocked, setUnitBlocked] = useState(false);
  const size = useControlSize();
  const hint = [readback(value) ?? PLAIN_DECIMAL_HINT, description].filter(Boolean).join(' · ');
  const fieldError = unitBlocked ? UNIT_BLOCKED : error;
  return (
    <AmountRow>
      <ExactNumberField
        kind="decimal"
        label={`${label} (${UNIT_LABEL[value.unit]})`}
        description={hint}
        value={value.text}
        onValueChange={(text) => {
          setUnitBlocked(false);
          onChange({ ...value, text });
        }}
        error={fieldError}
        required={required}
        sx={{ gridColumn: 1, gridRow: `1 / span ${fieldError ? 4 : 3}`, gridTemplateRows: 'subgrid' }}
      />
      <SegmentedControl
        label={`${label} unit`}
        size={size}
        sx={{ gridColumn: 2, gridRow: 2, alignSelf: 'start' }}
        options={UNIT_OPTIONS}
        value={value.unit}
        onValueChange={(unit) => {
          if (!isKeyOf(UNIT_LABEL, unit)) return;
          const converted = convertEntry(value, unit);
          setUnitBlocked(converted === null);
          if (converted) onChange(converted);
        }}
      />
    </AmountRow>
  );
}
