import { createTheme, type ThemeName, type ThemeTokens } from '@jfrader/ui';

/**
 * The amber workbench palette, the only one the app ships. Values are the accepted preview's;
 * warnings are coral so they never read as the accent. No other colour literal belongs in the app.
 */
const AMBER = {
  dark: {
    bg: '#0e0d0b',
    bgSoft: '#12110e',
    surface: '#151411',
    surfaceRaised: '#1a1915',
    surfaceHover: '#211f1a',
    surfaceInset: '#0a0908',
    border: '#2d2a25',
    borderSubtle: '#22201c',
    borderStrong: '#454037',
    borderControl: '#6b6457',
    text: '#efebe3',
    textMuted: '#aba497',
    textSubtle: '#958e81',
    accent: '#e8a33a',
    accentHover: '#f2bb63',
    accentContrast: '#1a1104',
    accentText: '#f0b45a',
    accentSoft: 'rgb(232 163 58 / .13)',
    accentSoftHover: 'rgb(232 163 58 / .2)',
    accentBorder: 'rgb(232 163 58 / .45)',
    warning: '#f5825a',
    warningSoft: 'rgb(245 130 90 / .12)',
    success: '#7cc489',
    successSoft: 'rgb(124 196 137 / .12)',
    info: '#9cb6ee',
    infoSoft: 'rgb(156 182 238 / .12)',
    danger: '#d94a57',
    dangerHover: '#c7404c',
    dangerText: '#ff7480',
    dangerContrast: '#ffffff',
    dangerSoft: 'rgb(255 116 128 / .1)',
    dangerSoftHover: 'rgb(255 116 128 / .16)',
    dangerBorder: 'rgb(255 116 128 / .45)',
    scrim: 'rgb(6 5 4 / .72)',
  },
  light: {
    bg: '#f7f5f1',
    bgSoft: '#f1eee8',
    surface: '#fffdf9',
    surfaceRaised: '#ffffff',
    surfaceHover: '#eeeae2',
    surfaceInset: '#eae5db',
    border: '#dbd4c7',
    borderSubtle: '#e7e1d6',
    borderStrong: '#b3a997',
    borderControl: '#837967',
    text: '#1b1712',
    textMuted: '#5b5345',
    textSubtle: '#675f51',
    accent: '#975700',
    accentHover: '#7c4700',
    accentContrast: '#ffffff',
    accentText: '#874e00',
    accentSoft: 'rgb(151 87 0 / .1)',
    accentSoftHover: 'rgb(151 87 0 / .16)',
    accentBorder: 'rgb(151 87 0 / .4)',
    warning: '#b13d17',
    warningSoft: 'rgb(177 61 23 / .09)',
    success: '#2d7a48',
    successSoft: 'rgb(45 122 72 / .1)',
    info: '#3a5fae',
    infoSoft: 'rgb(58 95 174 / .1)',
    danger: '#b3202f',
    dangerHover: '#9c1a28',
    dangerText: '#ab1e2c',
    dangerContrast: '#ffffff',
    dangerSoft: 'rgb(179 32 47 / .08)',
    dangerSoftHover: 'rgb(179 32 47 / .13)',
    dangerBorder: 'rgb(179 32 47 / .4)',
    scrim: 'rgb(27 23 18 / .45)',
  },
} as const satisfies Record<ThemeName, Record<string, string>>;

const SHAPE = {
  radius: { sm: '3px', md: '4px', lg: '6px', xl: '6px', full: '4px' },
  font: {
    sans: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Noto Sans', sans-serif",
    mono: "ui-monospace, 'SF Mono', 'Cascadia Mono', 'JetBrains Mono', Menlo, Consolas, 'Liberation Mono', monospace",
  },
};

function buildTokens(name: ThemeName): ThemeTokens {
  const color = AMBER[name];
  return createTheme({ base: name, accent: color.accent, tokens: { ...SHAPE, color: { ...color, focusRing: color.accentText } } });
}

/** `ThemeRoot` token maps, built once per theme. */
export const THEME_TOKENS: Record<ThemeName, ThemeTokens> = { dark: buildTokens('dark'), light: buildTokens('light') };
