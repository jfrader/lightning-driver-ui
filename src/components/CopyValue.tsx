import { CopyButton, Flex, styled, type SxProps } from '@jfrader/ui';
import { InlineCode } from './InlineCode';
import { useControlSize } from '../features/shell/use-shell-layout';

/** Long values wrap; the copy control keeps the library's full target size beside them. */
const keepTargetSize = { flexShrink: 0 };
const Value = styled(InlineCode)<{ prominent: boolean }>(({ theme, prominent }) => ({
  fontSize: prominent ? theme.textSize.lg : theme.textSize.sm,
}));

const Field = styled.div(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  alignItems: 'start',
  gap: theme.space[2],
  inlineSize: '100%',
  minInlineSize: 0,
  boxSizing: 'border-box',
  padding: theme.space[2],
  border: `1px solid ${theme.color.border}`,
  borderRadius: theme.radius.sm,
}));

const FieldValue = styled(InlineCode)({
  display: 'block',
  lineHeight: 1.4,
  maxBlockSize: '5lh',
  overflowY: 'auto',
  overflowX: 'hidden',
  overflowWrap: 'anywhere',
  whiteSpace: 'pre-wrap',
  userSelect: 'text',
});

interface CopyValueProps {
  value: string;
  label: string;
  align?: 'start' | 'center';
  prominent?: boolean;
}

interface CopyActionProps {
  value: string;
  /** The noun the accessible name is built from: `Copy ${label}`. */
  label: string;
  iconOnly?: boolean;
  variant?: 'outline' | 'ghost';
  /** Override the default "'{label} copied'" / "Copied" feedback when the copy names a different object. */
  copiedLabel?: string;
  /** The drawn label when it is deliberately shorter than the accessible name, e.g. a bare "Copy". */
  visibleLabel?: string;
  sx?: SxProps['sx'];
}

/** One copy control: the widget, its labels and its feedback live here instead of in every caller. */
export function CopyAction({ value, label, iconOnly = true, variant, copiedLabel, visibleLabel, sx }: CopyActionProps) {
  const size = useControlSize();
  return (
    <CopyButton
      iconOnly={iconOnly}
      size={size}
      text={value}
      label={iconOnly ? `Copy ${label}` : (visibleLabel ?? `Copy ${label}`)}
      aria-label={`Copy ${label}`}
      pendingLabel="Copying"
      copiedLabel={copiedLabel ?? (iconOnly ? `${label} copied` : 'Copied')}
      errorLabel="Copy failed"
      variant={variant}
      sx={sx ?? keepTargetSize}
    />
  );
}

export function CopyField({ value, label }: Pick<CopyValueProps, 'value' | 'label'>) {
  return (
    <Field>
      <FieldValue role="region" aria-label={`${label} value`} tabIndex={0}>{value}</FieldValue>
      <CopyAction value={value} label={label} iconOnly={false} visibleLabel="Copy" />
    </Field>
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
