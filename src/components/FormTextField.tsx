import { TextField, type TextFieldProps } from '@jfrader/ui';
import { useControlSize } from '../features/shell/use-shell-layout';

/** Single-line form field at the shell's control size: compact on desktop, a 44px+ target on touch. */
export function FormTextField({ size, ...props }: TextFieldProps) {
  const controlSize = useControlSize();
  return <TextField {...props} size={size ?? controlSize} />;
}
