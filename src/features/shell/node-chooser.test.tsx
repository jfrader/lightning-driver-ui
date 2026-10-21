import { screen, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { nodeKeys } from '../../api/node-queries';
import { setWideLayout } from '../../test/environment';
import { fixture } from '../../test/fixtures';
import { renderApp } from '../../test/render-app';
import { api, server } from '../../test/server';

/** The registry page as it was before the node was first observed. */
function fleetBeforeObservation() {
  const node = fixture('node_lnd');
  const unobserved = { ...node, network: 'unknown', status: { ...node.status, status: 'unsupported' } };
  server.use(http.get(api('/nodes'), () => HttpResponse.json({ ...fixture('nodes_page'), items: [unobserved], next_cursor: null, truncated: false })));
}

describe('node chooser', () => {
  it.each([false, true])('shows the open node as its summary reads it, not the older fleet page (wide %s)', async (wide) => {
    setWideLayout(wide);
    fleetBeforeObservation();
    const view = renderApp('/nodes/lnd-lab');

    const chooser = await screen.findByRole('combobox', { name: 'Node' });
    await waitFor(() => expect(chooser).toHaveTextContent('LND lab · Regtest'));
    expect(chooser).not.toHaveTextContent(/Unknown network|unsupported/);
    expect(view.queryClient.getQueryData(nodeKeys.summary('lnd-lab'))).toMatchObject({ network: 'regtest' });
  });

  it('follows the summary when a later observation changes it', async () => {
    const view = renderApp('/nodes/lnd-lab');
    const chooser = await screen.findByRole('combobox', { name: 'Node' });
    await waitFor(() => expect(chooser).toHaveTextContent('LND lab · Regtest'));

    const node = fixture('node_lnd');
    server.use(http.get(api('/nodes/:nodeId'), () => HttpResponse.json({ ...node, status: { ...node.status, status: 'offline' } })));
    await view.queryClient.refetchQueries({ queryKey: nodeKeys.summary('lnd-lab') });

    await waitFor(() => expect(chooser).toHaveTextContent('LND lab · Regtest · offline'));
  });
});
