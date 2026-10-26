import { useCallback, useLayoutEffect, useMemo, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { Global } from '@emotion/react';
import { ThemeRoot } from '@jfrader/ui';
import { vars as theme } from '@jfrader/tokens/vars';
import { LIGHT_SCHEME_QUERY, REDUCED_MOTION_MEDIA, REDUCED_MOTION_QUERY } from '../../config';
import { useMediaQuery } from '../../lib/use-media-query';
import { AppearanceContext } from './appearance-context';
import { THEME_TOKENS } from './palette';
import { readThemePreference, resolveTheme, writeThemePreference, type ThemePreference } from './theme-preference';

/** One crossfade of two page snapshots on a theme change; values switch once, never tweened. */
const motionStyles = {
  '::view-transition-old(root), ::view-transition-new(root)': {
    animationDuration: theme.motion.duration.base,
    animationTimingFunction: theme.motion.easeStandard,
  },
  [REDUCED_MOTION_MEDIA]: {
    '::view-transition-group(*), ::view-transition-old(*), ::view-transition-new(*)': { animation: 'none' },
  },
};

const canvasStyle = {
  minBlockSize: '100dvh',
  backgroundColor: theme.color.bg,
  color: theme.color.text,
  fontFamily: theme.font.sans,
};

function withCrossfade(apply: () => void): void {
  if (!('startViewTransition' in document) || window.matchMedia(REDUCED_MOTION_QUERY).matches) {
    apply();
    return;
  }
  document.startViewTransition(apply);
}

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState(readThemePreference);
  const systemPrefersLight = useMediaQuery(LIGHT_SCHEME_QUERY);
  const resolved = resolveTheme(preference, systemPrefersLight);

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = resolved;
  }, [resolved]);

  const setPreference = useCallback((next: ThemePreference) => {
    writeThemePreference(next);
    withCrossfade(() => flushSync(() => setPreferenceState(next)));
  }, []);
  const value = useMemo(() => ({ preference, setPreference, theme: resolved }), [preference, setPreference, resolved]);

  return (
    <AppearanceContext value={value}>
      <Global styles={motionStyles} />
      <ThemeRoot theme={resolved} tokens={THEME_TOKENS[resolved]} sx={canvasStyle}>
        {children}
      </ThemeRoot>
    </AppearanceContext>
  );
}
