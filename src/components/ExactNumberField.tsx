import type { TextFieldProps } from '@jfrader/ui';
import { FormTextField } from './FormTextField';

interface ExactNumberFieldProps extends Omit<TextFieldProps, 'type' | 'inputMode' | 'onChange'> {
  /** `decimal` allows one decimal point; `whole` is digits only. Only sets the phone keyboard. */
  kind: 'decimal' | 'whole';
}

/**
 * Plain text entry for exact numbers. The value is kept exactly as typed or pasted: nothing is
 * filtered, stepped or rounded, so the caller's canonical parser accepts it or rejects it.
 */
export function ExactNumberField({ kind, ...props }: ExactNumberFieldProps) {
  return (
    <FormTextField
      {...props}
      type="text"
      inputMode={kind === 'decimal' ? 'decimal' : 'numeric'}
      autoComplete="off"
      autoCorrect="off"
      spellCheck={false}
    />
  );
}
