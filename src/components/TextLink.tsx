import { styled } from '@jfrader/ui';
import { createLink } from '@tanstack/react-router';

const Anchor = styled.a(({ theme }) => ({
  color: theme.color.accentText,
  textDecoration: 'underline',
  textUnderlineOffset: theme.space[1],
  borderRadius: theme.radius.sm,
  '&:focus-visible': { outline: `2px solid ${theme.color.focusRing}`, outlineOffset: theme.space[1] },
}));

/** Inline router link in body text. */
export const TextLink = createLink(Anchor);
