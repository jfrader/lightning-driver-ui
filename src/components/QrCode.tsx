import { QRCodeSVG } from 'qrcode.react';
import { Surface, ThemeRoot, styled } from '@jfrader/ui';
import { vars as theme } from '@jfrader/tokens/vars';

const QR_SIZE_PX = 224;

const Frame = styled(Surface)(({ theme: t }) => ({
  display: 'inline-flex',
  padding: t.space[3],
  maxInlineSize: '100%',
  '& svg': { maxInlineSize: '100%', blockSize: 'auto' },
}));

interface QrCodeProps {
  value: string;
  label: string;
}

/** Scannable code on a light surface in either theme. */
export function QrCode({ value, label }: QrCodeProps) {
  return (
    <ThemeRoot theme="light">
      <Frame>
        <QRCodeSVG
          value={value}
          size={QR_SIZE_PX}
          role="img"
          aria-label={label}
          fgColor={theme.color.text}
          bgColor={theme.color.surface}
          marginSize={2}
        />
      </Frame>
    </ThemeRoot>
  );
}
