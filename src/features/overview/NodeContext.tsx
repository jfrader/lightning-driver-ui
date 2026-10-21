import { styled } from '@jfrader/ui';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { nodeInfoQueryOptions, nodePolicyQueryOptions } from '../../api/node-queries';
import type { NodeSummary } from '../../api/types';
import { DetailList } from '../../components/DetailList';
import { ErrorNotice } from '../../components/ErrorNotice';
import { Freshness } from '../../components/Freshness';
import { Section } from '../../components/Section';
import { formatInteger, parseWireDecimal } from '../../lib/money';
import { publicPolicyQueryOptions } from '../auth/queries';
import { Amount } from '../display/Amount';
import { AmountRange } from '../display/AmountRange';
import { Identifier } from '../display/Identifier';
import { NotReported } from '../display/NotReported';
import { useAuthMethod } from '../auth/use-auth-method';
import { BACKEND_LABEL, REAUTH_LABEL, syncLabel } from '../nodes/labels';

const Mono = styled.span(({ theme }) => ({ fontFamily: theme.font.mono }));

function NodeFacts({ node }: { node: NodeSummary }) {
  const info = useQuery(nodeInfoQueryOptions(node.id));
  const { status } = node;
  const pending = info.isPending ? <NotReported>…</NotReported> : <NotReported />;
  return (
    <Section title="Node">
      <DetailList
        items={[
          { label: 'Alias', value: info.data?.alias ?? pending },
          { label: 'Node ID', value: <Mono>{node.id}</Mono> },
          { label: 'Backend', value: BACKEND_LABEL[node.backend] },
          { label: 'Chain', value: syncLabel(status.synced_to_chain) },
          { label: 'Graph', value: syncLabel(status.synced_to_graph) },
          {
            label: 'Block height',
            value:
              status.block_height === null ? <NotReported /> : <Mono>{formatInteger(parseWireDecimal(status.block_height))}</Mono>,
          },
          { label: 'Version', value: info.data?.version ?? pending },
          {
            label: 'Public key',
            stacked: true,
            value: node.identity_pubkey ? (
              <Identifier value={node.identity_pubkey} label="Public key" />
            ) : (
              <NotReported>Identity not verified</NotReported>
            ),
          },
        ]}
      />
      {info.isError && <ErrorNotice error={info.error} onRetry={() => void info.refetch()} />}
      {info.data && <Freshness observedAt={info.data.observed_at} stale={info.data.stale} />}
    </Section>
  );
}

function PolicyFacts({ node }: { node: NodeSummary }) {
  const policy = useQuery(nodePolicyQueryOptions(node.id));
  const reauth = useSuspenseQuery(publicPolicyQueryOptions).data.reauth;
  const method = useAuthMethod();
  const payBounds = policy.data?.pay_invoice_msat;
  return (
    <Section title="Policy">
      {policy.isError ? (
        <ErrorNotice error={policy.error} onRetry={() => void policy.refetch()} />
      ) : (
        <DetailList
          items={[
            { label: 'Access', numeric: true, value: node.read_only ? 'Read-only' : 'Writable' },
            {
              label: 'Payment amount',
              stacked: true,
              value: payBounds ? (
                <AmountRange bounds={payBounds} unit="msat" />
              ) : (
                <NotReported>…</NotReported>
              ),
            },
            {
              label: 'Routing fee cap',
              numeric: true,
              value: policy.data ? <Amount value={policy.data.max_routing_fee_msat} unit="msat" /> : <NotReported>…</NotReported>,
            },
            { label: 'Confirmation', numeric: true, value: REAUTH_LABEL[method][reauth.mode] },
          ]}
        />
      )}
    </Section>
  );
}

/** Node facts and server policy as observed; the browser cannot change either. */
export function NodeContext({ node }: { node: NodeSummary }) {
  return (
    <>
      <NodeFacts node={node} />
      <PolicyFacts node={node} />
    </>
  );
}
