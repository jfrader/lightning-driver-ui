import type { ComponentPropsWithRef, ReactNode } from 'react';
import { Button, type ButtonProps } from '@jfrader/ui';
import { createLink } from '@tanstack/react-router';
import { wrappingControlText } from './control-styles';

interface ButtonAnchorProps extends ComponentPropsWithRef<'a'> {
  variant?: ButtonProps['variant'];
  tone?: ButtonProps['tone'];
  size?: ButtonProps['size'];
  startIcon?: ReactNode;
  /** Extra styling for the rendered button, merged after the wrapping text rules. */
  sx?: ButtonProps['sx'];
}

function ButtonAnchor({ variant, tone, size, startIcon, sx, children, onClick, ref, ...anchor }: ButtonAnchorProps) {
  return (
    <Button
      variant={variant}
      tone={tone}
      size={size}
      startIcon={startIcon}
      sx={[wrappingControlText(size), sx]}
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
