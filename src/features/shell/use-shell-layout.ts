import { SHELL_QUERY } from '../../config';
import { useMediaQuery } from '../../lib/use-media-query';

/** `true` for the desktop workbench (sidebar + status strip), `false` for the phone shell. */
export function useDesktopShell(): boolean {
  return useMediaQuery(SHELL_QUERY);
}

/** Desktop controls stay compact; touch layouts get 44px+ targets. */
export function useControlSize(): 'sm' | 'lg' {
  return useDesktopShell() ? 'sm' : 'lg';
}
