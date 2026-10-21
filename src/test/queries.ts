import { screen, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';

/** Queries scoped to the Panel titled `title`. */
export async function withinPanel(title: string) {
  const heading = await screen.findByRole('heading', { name: title });
  const panel = heading.closest('[data-ui~="surface"]');
  if (!(panel instanceof HTMLElement)) throw new Error(`Panel "${title}" not found`);
  return within(panel);
}

/** Queries scoped to the named section landmark (a `Section`, or a balance group). */
export async function withinSection(name: string) {
  return within(await screen.findByRole('region', { name }));
}

/** Expands the review's collapsed technical details. */
export async function openTechnicalDetails(user: UserEvent) {
  await user.click(await screen.findByRole('button', { name: 'Technical details' }));
}
