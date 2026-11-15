import type { JfraderTheme } from '@jfrader/ui';

/**
 * The machine-value rule: the mono stack with tabular digits. One definition, because a value that
 * is a wire id, a hash or an amount should look the same wherever it appears.
 */
export const mono = ({ theme }: { theme: JfraderTheme }) => ({
  fontFamily: theme.font.mono,
  fontVariantNumeric: 'tabular-nums' as const,
});
