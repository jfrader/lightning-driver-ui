import { CopyButton, Flex } from '@jfrader/ui';
import { InlineCode } from './InlineCode';

/** Long values wrap; the copy control keeps the library's full target size beside them. */
const keepTargetSize = { flexShrink: 0 };

interface CopyValueProps {
  value: string;
  label: string;
}

/** A machine value (hash, address, invoice) shown in full with a copy action. */
export function CopyValue({ value, label }: CopyValueProps) {
  return (
    <Flex gap="sm" align="center">
      <InlineCode>{value}</InlineCode>
      <CopyButton
        iconOnly
        size="sm"
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
