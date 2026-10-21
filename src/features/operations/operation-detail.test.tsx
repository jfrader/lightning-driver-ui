import { screen, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { fixture } from '../../test/fixtures';
import { mockJournal, operation } from '../../test/operation-journal';
import { withinSection } from '../../test/queries';
import { renderApp } from '../../test/render-app';
import { api, safeError, server } from '../../test/server';

vi.mock('@simplewebauthn/browser', async (importOriginal) =>
  (await import('../../test/webauthn-mock')).webauthnModule(importOriginal, {
    startAuthentication: vi.fn(),
    startRegistration: vi.fn(),
  }),
);

const PAY_ID = operation('pay_invoice').id;
const RECIPIENT = operation('pay_invoice').review.destination ?? '';
const NO_ACTION = /pay|retry|again|confirm|passkey|resend/i;

function unknownPayment() {
  return {
    ...operation('pay_invoice', 'unknown', 'reconciling'),
    authorization: { status: 'consumed', mode: 'every_operation', expires_at: null },
    updated_at: '2026-10-21T12:00:10Z',
    last_reconciled_at: '2026-10-21T12:00:30Z',
  };
}

function expectNoActions() {
  for (const button of screen.queryAllByRole('button')) {
    expect(button).not.toHaveAccessibleName(NO_ACTION);
  }
}

describe('operation detail', () => {
  it('states what is known about an unknown payment, with no way to send it again', async () => {
    mockJournal({ created: unknownPayment() });
    renderApp(`/nodes/lnd-lab/operations/${PAY_ID}`);

    expect(await screen.findByRole('heading', { name: 'Payment operation' })).toBeInTheDocument();
    expect(
      screen.getByText('The node may have sent this payment. Do not pay this invoice again until the outcome resolves.'),
    ).toBeInTheDocument();
    expect(screen.getByText(/^Last checked with the node .*UTC/)).toHaveTextContent(
      'Last checked with the node 12:00:30 UTC · 30 seconds ago',
    );
    const status = await withinSection('Status');
    const value = (label: string) => status.getByText(label).nextElementSibling;
    expect(value('State')).toHaveTextContent('Outcome unknown');
    expect(value('Stage')).toHaveTextContent('Checking with node');
    expect(value('Authorization')).toHaveTextContent('Authorized and used');
    expect(value('Result')).toHaveTextContent('None reported');
    expect(screen.getAllByText('Outcome unknown').length).toBeLessThanOrEqual(3);
    expectNoActions();
  });

  it('builds the timeline from recorded times only', async () => {
    mockJournal({ created: unknownPayment() });
    renderApp(`/nodes/lnd-lab/operations/${PAY_ID}`);

    const timeline = await screen.findByRole('list', { name: 'Operation timeline' });
    const steps = within(timeline).getAllByRole('listitem').map((step) => step.textContent);
    expect(steps).toEqual([
      'Review created12:00:00 UTC · 1 minute ago',
      'AuthorizationAuthorized and usedTime not recorded',
      'Sent to nodeTime not recorded',
      'Last state changeChecking with node12:00:10 UTC · 50 seconds ago',
      'Last checked with the node12:00:30 UTC · 30 seconds ago',
      'Final outcomeOutcome not finalNot observed yet',
    ]);
  });

  it('shows the reviewed payment with its full recipient and the node record matched by hash', async () => {
    mockJournal({ created: unknownPayment() });
    renderApp(`/nodes/lnd-lab/operations/${PAY_ID}`);

    const reviewed = await withinSection('Reviewed payment');
    expect(reviewed.getByTitle(RECIPIENT)).toHaveTextContent(RECIPIENT);
    expect(reviewed.getByText('Total').nextElementSibling).toHaveTextContent('at most 2,501 sat');
    const record = await withinSection('Node payment record');
    expect(await record.findByText('Succeeded')).toBeInTheDocument();
    expect(record.getByText('Fee paid').nextElementSibling).toHaveTextContent('0.123 sat');
    expect(record.getByRole('link', { name: 'Open in Payments' })).toHaveAttribute(
      'href',
      `/nodes/lnd-lab/payments?selected=${fixture('payments_page').items[0].payment_hash}`,
    );
    expect(screen.getByRole('link', { name: 'Reviewed payment' })).toHaveAttribute(
      'href',
      `/nodes/lnd-lab/operations/${PAY_ID}#reviewed`,
    );
  });

  it('says when the node reports no payment with the reviewed hash', async () => {
    mockJournal({ created: unknownPayment() });
    server.use(http.get(api('/nodes/:nodeId/payments'), () => HttpResponse.json({ ...fixture('payments_page'), items: [] })));
    renderApp(`/nodes/lnd-lab/operations/${PAY_ID}`);
    expect(await screen.findByText('The node reports no payment with this hash on the newest payments page.')).toBeInTheDocument();
  });

  it('states a failure with its error sentence and code', async () => {
    mockJournal({
      created: {
        ...operation('pay_invoice', 'failed', 'submitted'),
        error: safeError('no_route', 'No route.', 'definite_failure', PAY_ID).error,
      },
    });
    renderApp(`/nodes/lnd-lab/operations/${PAY_ID}`);
    expect(await screen.findByText('Not paid. No route found.')).toBeInTheDocument();
    expect((await withinSection('Status')).getByText('Error code').nextElementSibling).toHaveTextContent('no_route');
    expectNoActions();
  });

  it('states an expired review as never sent', async () => {
    mockJournal({ created: operation('pay_invoice', 'expired', 'not_dispatched') });
    renderApp(`/nodes/lnd-lab/operations/${PAY_ID}`);
    expect(await screen.findByText('Review expired before confirmation. Nothing was sent.')).toBeInTheDocument();
    expect(screen.getByText('Sent to node').closest('li')).toHaveTextContent('Not observed yet');
    expectNoActions();
  });
});

describe('operations list', () => {
  function journal(items: unknown[]) {
    return { ...fixture('operations_page'), node_id: 'lnd-lab', network: 'regtest', items, next_cursor: null, truncated: false };
  }

  it('lists operations with their state, stage, amount and a link to each', async () => {
    server.use(http.get(api('/nodes/:nodeId/operations'), () => HttpResponse.json(journal([unknownPayment()]))));
    renderApp('/nodes/lnd-lab/operations');
    const list = await screen.findByRole('list', { name: 'Operations' });
    expect(within(list).getByRole('link', { name: 'Pay invoice' })).toHaveAttribute('href', `/nodes/lnd-lab/operations/${PAY_ID}`);
    expect(within(list).getByText('Outcome unknown')).toBeInTheDocument();
    expect(within(list).getByText('Checking with node')).toBeInTheDocument();
    expect(within(list).getByText('2,500 sat')).toBeInTheDocument();
    expect(within(list).queryByRole('button')).not.toBeInTheDocument();
  });

  it.each([
    ['', 'No operations on this node.'],
    ['?state=nonterminal', 'No unresolved operations.'],
    ['?state=failed&kind=send_onchain', 'No operations match these filters.'],
  ])('says when the list%s is empty', async (query, sentence) => {
    server.use(http.get(api('/nodes/:nodeId/operations'), () => HttpResponse.json(journal([]))));
    const { router } = renderApp(`/nodes/lnd-lab/operations${query}`);
    expect(await screen.findByText(sentence)).toBeInTheDocument();
    expect(router.state.location.href).toBe(`/nodes/lnd-lab/operations${query}`);
  });
});
