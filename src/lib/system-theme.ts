import { LIGHT_SCHEME_QUERY } from '../config';

/** Mirrors the system light/dark preference onto `<html data-theme>` and follows later changes. */
export function followSystemTheme(root: HTMLElement): () => void {
  const query = window.matchMedia(LIGHT_SCHEME_QUERY);
  const apply = () => {
    root.dataset.theme = query.matches ? 'light' : 'dark';
  };
  apply();
  query.addEventListener('change', apply);
  return () => query.removeEventListener('change', apply);
}
