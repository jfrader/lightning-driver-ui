import { CopyButton, Flex, styled } from '@jfrader/ui';
import { InlineCode } from './InlineCode';
import { useControlSize } from '../features/shell/use-shell-layout';

/** Long values wrap; the copy control keeps the library's full target size beside them. */
const keepTargetSize = { flexShrink: 0 };
const Value = styled(InlineCode)<{ prominent: boolean }>(({ theme, prominent }) => ({
  fontSize: prominent ? theme.textSize.lg : theme.textSize.sm,
}));

interface CopyValueProps {
  value: string;
  label: string;
  align?: 'start' | 'center';
  prominent?: boolean;
}

export function CopyAction({ value, label }: Pick<CopyValueProps, 'value' | 'label'>) {
  const size = useControlSize();
  return (
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
  );
}

/** A machine value (hash, address, invoice) shown in full with a copy action. */
export function CopyValue({ value, label, align = 'center', prominent = false }: CopyValueProps) {
  return (
    <Flex gap="sm" align={align}>
      <Value prominent={prominent}>{value}</Value>
      <CopyAction value={value} label={label} />
    </Flex>
  );
}
