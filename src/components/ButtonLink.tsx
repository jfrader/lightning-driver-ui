import type { ComponentPropsWithRef, ReactNode } from 'react';
import { Button, type ButtonProps } from '@jfrader/ui';
import { createLink } from '@tanstack/react-router';

interface ButtonAnchorProps extends ComponentPropsWithRef<'a'> {
  variant?: ButtonProps['variant'];
  tone?: ButtonProps['tone'];
  size?: ButtonProps['size'];
  startIcon?: ReactNode;
}

function ButtonAnchor({ variant, tone, size, startIcon, children, onClick, ref, ...anchor }: ButtonAnchorProps) {
  return (
    <Button
      variant={variant}
      tone={tone}
      size={size}
      startIcon={startIcon}
      render={({ onClick: buttonClick, ...buttonProps }) => (
        <a
          {...anchor}
          {...buttonProps}
          ref={ref}
          onClick={(event) => {
            buttonClick?.(event);
            if (!event.defaultPrevented) onClick?.(event);
          }}
        />
      )}
    >
      {children}
    </Button>
  );
}

/** Router link that looks like a jfrader-ui Button. */
export const ButtonLink = createLink(ButtonAnchor);
