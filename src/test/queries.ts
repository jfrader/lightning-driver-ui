import { screen, within } from '@testing-library/react';

/** Queries scoped to the Panel titled `title`. */
export async function withinPanel(title: string) {
  const heading = await screen.findByRole('heading', { name: title });
  const panel = heading.closest('[data-ui~="surface"]');
  if (!(panel instanceof HTMLElement)) throw new Error(`Panel "${title}" not found`);
  return within(panel);
}
