import { screen, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';

/** Queries scoped to the named section landmark (a `Section`, or a balance group). */
export async function withinSection(name: string) {
  return within(await screen.findByRole('region', { name }));
}

/** Expands the review's collapsed technical details. */
export async function openTechnicalDetails(user: UserEvent) {
  await user.click(await screen.findByRole('button', { name: 'Technical details' }));
}
