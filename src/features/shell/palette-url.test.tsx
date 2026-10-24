import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { booleanCodec } from '../../app/search';
import { renderApp } from '../../test/render-app';

describe('palette URL', () => {
  it.each([1, '1', undefined, null, true, false, 0, 'true', '0', ['1']])('round trips the boolean codec for %j', (value) => {
    const enabled = value === 1 || value === '1';
    expect(booleanCodec.parse(value)).toBe(enabled);
    expect(booleanCodec.serialize(booleanCodec.parse(value))).toBe(enabled ? 1 : undefined);
  });

  it('pushes on shortcut, pops on Escape and reopens with Forward without changing filters', async () => {
    const view = renderApp('/nodes/lnd-lab/payments?sort=amount');
    await screen.findByRole('heading', { name: 'Payments' });
    await view.user.keyboard('{Control>}k{/Control}');
    await screen.findByRole('combobox', { name: 'Go to' });
    expect(view.router.state.location.search).toMatchObject({ sort: 'amount', palette: 1 });
    expect(view.history.length).toBe(2);
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
    await waitFor(() => expect(view.router.state.location.search.palette).toBeUndefined());
    view.history.forward();
    expect(await screen.findByRole('combobox', { name: 'Go to' })).toBeInTheDocument();
    expect(view.history.length).toBe(2);
  });

  it('cold-loads on the current location and dismisses without navigating away', async () => {
    const view = renderApp('/more?palette=1');
    await screen.findByRole('combobox', { name: 'Go to' });
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
    await waitFor(() => expect(view.router.state.location.search.palette).toBeUndefined());
    expect(view.router.state.location.pathname).toBe('/more');
    expect(view.history.length).toBe(1);
  });
});
