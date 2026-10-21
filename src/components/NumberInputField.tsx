import { TextField, type TextFieldProps } from '@jfrader/ui';
import { DISPLAY_LOCALE } from '../config';

const INPUT_LANGUAGE = new Intl.NumberFormat(DISPLAY_LOCALE).resolvedOptions().locale;

interface NumberInputFieldProps extends Omit<TextFieldProps, 'type' | 'lang' | 'inputMode' | 'step'> {
  /** Whole numbers use `1`; decimal amounts use `any`, so no precision is rounded away. */
  step: 1 | 'any';
}

/**
 * Number entry through the platform: the browser reads the operator's localized digits and
 * separators (for the display locale) and exposes a canonical decimal string as the value, or ""
 * when it cannot read the text. Callers parse that string exactly; it never becomes a float here.
 */
export function NumberInputField({ step, ...props }: NumberInputFieldProps) {
  return (
    <TextField
      {...props}
      type="number"
      lang={INPUT_LANGUAGE}
      inputMode={step === 1 ? 'numeric' : 'decimal'}
      step={step}
      min={step === 1 ? 1 : 0}
      autoComplete="off"
    />
  );
}
