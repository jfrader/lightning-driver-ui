import type { ButtonProps } from '@jfrader/ui';
import { vars as theme } from '@jfrader/tokens/vars';

const controlHeight = { sm: theme.space[8], md: theme.space[10], lg: theme.space[12] };

export function wrappingControlText(size: ButtonProps['size'] = 'md') {
  return {
    whiteSpace: 'normal',
    overflowWrap: 'anywhere',
    maxInlineSize: '100%',
    blockSize: 'auto',
    minBlockSize: controlHeight[size],
    paddingBlock: theme.space[1],
  } as const;
}
