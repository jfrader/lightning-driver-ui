import { CopyButton, Flex } from '@jfrader/ui';
import { InlineCode } from './InlineCode';
import { useControlSize } from '../features/shell/use-shell-layout';

/** Long values wrap; the copy control keeps the library's full target size beside them. */
const keepTargetSize = { flexShrink: 0 };

interface CopyValueProps {
  value: string;
  label: string;
  align?: 'start' | 'center';
}

/** A machine value (hash, address, invoice) shown in full with a copy action. */
export function CopyValue({ value, label, align = 'center' }: CopyValueProps) {
  const size = useControlSize();
  return (
    <Flex gap="sm" align={align}>
      <InlineCode>{value}</InlineCode>
      <CopyButton
        iconOnly
        size={size}
        text={value}
        label={`Copy ${label}`}
        pendingLabel="Copying"
        copiedLabel={`${label} copied`}
        errorLabel="Copy failed"
        sx={keepTargetSize}
      />
    </Flex>
  );
}
