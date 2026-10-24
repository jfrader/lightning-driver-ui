import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { fixture } from '../../test/fixtures';
import { mockJournal, operation } from '../../test/operation-journal';
import { renderApp } from '../../test/render-app';
import { OPERATION_KIND } from './labels';

const cases = [
  { kind: 'create_invoice', list: 'invoices', heading: 'Invoices', entry: 'new', submit: 'Review invoice', fields: [[/^Amount \(sat\)/, '2500']] },
  { kind: 'connect_peer', list: 'peers', heading: 'Peers', entry: 'new', submit: 'Review connection', fields: [[/^Node public key/, fixture('peers_page').items[0].pubkey], [/^Host/, 'peer.example.invalid'], [/^Port/, '9735']] },
  { kind: 'open_channel', list: 'channels', heading: 'Channels', entry: 'new', submit: 'Review channel open', fields: [[/^Peer public key/, fixture('peers_page').items[0].pubkey], [/^Channel size \(sat\)/, '1000000'], [/^Fee rate/, '2']] },
  { kind: 'close_channel', list: 'channels', heading: 'Channels', entry: `${fixture('channels_page').items[0].id}/close`, submit: 'Review close', fields: [[/^Fee rate/, '2']] },
  { kind: 'send_onchain', list: 'onchain', heading: 'On-chain', entry: 'send', submit: 'Review send', fields: [[/^Address/, 'SYNTHETIC_REGTEST_ADDRESS_NOT_SENDABLE'], [/^Amount \(sat\)/, '10000'], [/^Fee rate/, '2']] },
  { kind: 'new_address', list: 'onchain', heading: 'On-chain', entry: 'receive', submit: 'Review new address', fields: [] },
] as const;

describe.each(cases)('$kind route sheet', ({ kind, list, heading, entry, submit, fields }) => {
  const listPath = `/nodes/lnd-lab/${list}`;
  const path = `${listPath}/${entry}`;

  it('opens from the real list action without dropping its selection or cursor', async () => {
    const selected = list === 'channels' ? fixture('channels_page').items[0].id : list === 'peers' ? fixture('peers_page').items[0].pubkey : list === 'invoices' ? fixture('invoices_page').items[0].payment_hash : fixture('transactions_page').items[0].txid;
    const view = renderApp(`${listPath}?selected=${selected}&cursor=synthetic`);
    const trigger = await screen.findByRole('link', { name: new RegExp(`^${OPERATION_KIND[kind]}`) });
    const search = view.router.state.location.search;
    await view.user.click(trigger);
    const dialog = await screen.findByRole('dialog', { name: OPERATION_KIND[kind] });
    expect(view.router.state.location.pathname).toBe(path);
    expect(view.router.state.location.search).toEqual(search);
    await view.user.click(within(dialog).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(view.router.state.location.pathname).toBe(listPath));
    expect(view.router.state.location.search).toEqual(search);
  });

  it('cold-loads the form over its list, closes without losing search, and reopens with Back', async () => {
    const selected = list === 'channels' ? fixture('channels_page').items[0].id : list === 'peers' ? fixture('peers_page').items[0].pubkey : 'a'.repeat(64);
    const view = renderApp(`${path}?selected=${selected}&cursor=synthetic`);
    const dialog = await screen.findByRole('dialog', { name: OPERATION_KIND[kind] });
    const background = screen.getByRole('heading', { name: heading });
    const search = view.router.state.location.search;
    await view.user.click(within(dialog).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(view.router.state.location.pathname).toBe(listPath));
    expect(view.router.state.location.search).toEqual(search);
    expect(screen.getByRole('heading', { name: heading })).toBe(background);
    view.history.back();
    expect(await screen.findByRole('dialog', { name: OPERATION_KIND[kind] })).toBeInTheDocument();
  });

  it('replaces the form with a review URL, refuses Escape and discards to the same form', async () => {
    const created = operation(kind);
    const calls = mockJournal({ created });
    const view = renderApp(`${path}?cursor=synthetic`);
    const dialog = await screen.findByRole('dialog', { name: OPERATION_KIND[kind] });
    for (const [label, value] of fields) await view.user.type(await within(dialog).findByLabelText(label), value);
    await view.user.click(await within(dialog).findByRole('button', { name: submit }));
    await waitFor(() => expect(view.router.state.location.pathname).toBe(`${listPath}/review/${created.id}`));
    const review = await screen.findByRole('dialog', { name: OPERATION_KIND[kind] });
    await within(review).findByRole('button', { name: 'Discard review' });
    expect(view.history.length).toBe(1);
    expect(calls.confirms).toEqual([]);
    expect(fireEvent(review, new Event('cancel', { cancelable: true }))).toBe(false);
    await view.user.click(within(review).getByRole('button', { name: 'Discard review' }));
    await waitFor(() => expect(view.router.state.location.pathname).toBe(path));
    expect(view.router.state.location.search).toMatchObject({ cursor: 'synthetic' });
  });

  it('cold-loads review and result over the list and closes the result to the list', async () => {
    const current = operation(kind, 'succeeded', 'completed', true);
    mockJournal({ created: current });
    const view = renderApp(`${listPath}/review/${current.id}?cursor=synthetic`);
    const dialog = await screen.findByRole('dialog', { name: OPERATION_KIND[kind] });
    expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
    await within(dialog).findByRole('heading', { name: 'Result' });
    await view.user.click(within(dialog).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(view.router.state.location.pathname).toBe(listPath));
    expect(view.router.state.location.search).toMatchObject({ cursor: 'synthetic' });
  });

  it('cold-loads an awaiting review without creating or confirming an operation', async () => {
    const current = operation(kind);
    const calls = mockJournal({ created: current });
    renderApp(`${listPath}/review/${current.id}`);
    const dialog = await screen.findByRole('dialog', { name: OPERATION_KIND[kind] });
    expect(await within(dialog).findByRole('button', { name: 'Discard review' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
    expect(calls.creates).toEqual([]);
    expect(calls.confirms).toEqual([]);
  });
});
