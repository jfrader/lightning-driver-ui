/**
 * Keeps a label available to assistive technology without drawing it. One source for both the
 * `VisuallyHidden` component and the few `sx` consumers, so the clipping rules cannot drift.
 */
export const visuallyHidden = {
  position: 'absolute',
  inlineSize: '1px',
  blockSize: '1px',
  padding: 0,
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  clipPath: 'inset(50%)',
  whiteSpace: 'nowrap',
  border: 0,
} as const;
