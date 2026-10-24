import { Select } from '@jfrader/ui';
import { POPOVER_LAYER } from '../config';
import { useControlSize } from '../features/shell/use-shell-layout';
import { isKeyOf, keysOf } from '../lib/guards';

const ALL = 'all';

interface FilterSelectProps<T extends Record<string, string>> {
  label: string;
  labels: T;
  value: Extract<keyof T, string> | undefined;
  onChange: (value: Extract<keyof T, string> | undefined) => void;
}

/** A server-side list filter backed by an exhaustive label map, with an "All" choice. */
export function FilterSelect<T extends Record<string, string>>({ label, labels, value, onChange }: FilterSelectProps<T>) {
  const options = [{ value: ALL, label: 'All' }, ...keysOf(labels).map((key) => ({ value: key, label: labels[key] }))];
  return (
    <Select
      label={label}
      size={useControlSize()}
      options={options}
      value={value ?? ALL}
      onValueChange={(next) => onChange(isKeyOf(labels, next) ? next : undefined)}
      slotProps={{ content: { css: { zIndex: POPOVER_LAYER } } }}
    />
  );
}
