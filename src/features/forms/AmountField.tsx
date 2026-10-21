import { Flex, SegmentedControl } from '@jfrader/ui';
import { NumberInputField } from '../../components/NumberInputField';
import { isKeyOf, keysOf } from '../../lib/guards';
import { UNIT_LABEL, formatMsatInput, parseAmountInput, type DisplayUnit } from '../../lib/money';

export interface AmountEntry {
  /** Canonical value of the number input, e.g. "0.0015"; "" when empty or unreadable. */
  text: string;
  unit: DisplayUnit;
}

const UNIT_OPTIONS = keysOf(UNIT_LABEL).map((unit) => ({ value: unit, label: UNIT_LABEL[unit] }));

/** Re-expresses the entered amount in the new unit so its value never changes with the unit. */
function convertEntry(entry: AmountEntry, unit: DisplayUnit): AmountEntry {
  const parsed = parseAmountInput(entry.text, entry.unit, { allowMsat: true });
  return { unit, text: parsed.ok ? formatMsatInput(parsed.msat, unit) : '' };
}

interface AmountFieldProps {
  label: string;
  value: AmountEntry;
  onChange: (value: AmountEntry) => void;
  error?: string;
  description?: string;
  required?: boolean;
}

/**
 * Exact amount entry in the chosen unit, parsed later to bigint millisatoshis.
 * The unit belongs to the entry, so changing the session display unit never rescales entered digits.
 */
export function AmountField({ label, value, onChange, error, description, required }: AmountFieldProps) {
  return (
    <Flex gap="sm" align="end" wrap>
      <NumberInputField
        step="any"
        label={`${label} (${UNIT_LABEL[value.unit]})`}
        value={value.text}
        onValueChange={(text) => onChange({ ...value, text })}
        error={error}
        description={description}
        required={required}
        sx={{ flex: '1 1 12rem' }}
      />
      <SegmentedControl
        label={`${label} unit`}
        size="sm"
        options={UNIT_OPTIONS}
        value={value.unit}
        onValueChange={(unit) => {
          if (isKeyOf(UNIT_LABEL, unit)) onChange(convertEntry(value, unit));
        }}
      />
    </Flex>
  );
}
