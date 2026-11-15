import { styled } from '@jfrader/ui';
import { mono } from './text-rule';

/** The sizes the text primitives take; anything else stays inherited from the surrounding block. */
type TextSize = 'xs' | 'sm';

interface MonoProps {
  /** A value long enough to widen its row wraps inside its own box instead. */
  wrap?: boolean;
  /** The value is secondary to what the row is about. */
  muted?: boolean;
  size?: TextSize;
}

/**
 * A machine value: an id, a hash, an outpoint, an amount in wire units.
 *
 * Four axes, no more: the mono rule always, `wrap` for long values, `muted` when it is secondary,
 * `size` when it must match the surrounding scale. Anything else composes at the call site with
 * `styled(Mono)(…)`, so a one-off stays a visible one-off.
 */
export const Mono = styled.span<MonoProps>(({ theme, wrap, muted, size }) => ({
  ...mono({ theme }),
  ...(muted ? { color: theme.color.textMuted } : {}),
  ...(size ? { fontSize: theme.textSize[size] } : {}),
  ...(wrap ? { overflowWrap: 'anywhere' as const } : {}),
}));

/** Secondary text: the muted tone, at one of the two sizes used under a value. */
export const Muted = styled.span<{ size?: TextSize }>(({ theme, size }) => ({
  color: theme.color.textMuted,
  ...(size ? { fontSize: theme.textSize[size] } : {}),
}));
