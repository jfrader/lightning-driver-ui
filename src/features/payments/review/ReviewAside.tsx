import { styled } from '@jfrader/ui';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { balancesQueryOptions, nodePolicyQueryOptions, operationsQueryOptions } from '../../../api/node-queries';
import type { Operation } from '../../../api/types';
import { ButtonLink } from '../../../components/ButtonLink';
import { DetailList } from '../../../components/DetailList';
import { Section } from '../../../components/Section';
import { formatInteger } from '../../../lib/money';
import { publicPolicyQueryOptions } from '../../auth/queries';
import { Amount } from '../../display/Amount';
import { AmountRange } from '../../display/AmountRange';
import { NotReported } from '../../display/NotReported';
import { useAuthMethod } from '../../auth/use-auth-method';
import { REAUTH_LABEL } from '../../nodes/labels';
import { isInFlight } from '../../operations/labels';
import { useControlSize } from '../../shell/use-shell-layout';

const Note = styled.p(({ theme }) => ({ margin: 0, marginBlockEnd: theme.space[3], fontSize: theme.textSize.sm }));

/** Placeholder for a read that is still loading, or that failed (the aside never blocks the review). */
const placeholder = (pending: boolean) => (pending ? <NotReported>…</NotReported> : <NotReported />);

/** Context for the decision as observed by the server; none of it is a guarantee about this payment. */
export function ReviewAside({ operation }: { operation: Operation }) {
  const size = useControlSize();
  const nodeId = operation.node_id;
  const policy = useQuery(nodePolicyQueryOptions(nodeId));
  const balances = useQuery(balancesQueryOptions(nodeId));
  const reauth = useSuspenseQuery(publicPolicyQueryOptions).data.reauth;
  const method = useAuthMethod();
  const unresolved = useQuery(operationsQueryOptions(nodeId, { state: 'nonterminal', kind: 'pay_invoice' }));
  const others = (unresolved.data?.items ?? []).filter(
    (item) => item.id !== operation.id && item.request.kind === 'pay_invoice' && isInFlight(item.state),
  );
  const bounds = policy.data?.pay_invoice_msat;

  return (
    <>
      <Section title="Node policy">
        <DetailList
          items={[
            {
              label: 'Payment amount limit',
              stacked: true,
              value: bounds ? (
                <AmountRange bounds={bounds} unit="msat" />
              ) : (
                placeholder(policy.isPending)
              ),
            },
            {
              label: 'Highest allowed fee cap',
              numeric: true,
              value: policy.data ? <Amount value={policy.data.max_routing_fee_msat} unit="msat" /> : placeholder(policy.isPending),
            },
            { label: 'Confirmation', numeric: true, value: REAUTH_LABEL[method][reauth.mode] },
            {
              label: 'Channel spendable',
              numeric: true,
              value: balances.data ? (
                <Amount value={balances.data.channel_spendable_msat} unit="msat" />
              ) : (
                placeholder(balances.isPending)
              ),
            },
          ]}
        />
      </Section>
      {others.length > 0 && (
        <Section title="Unresolved">
          <Note>
            {others.length === 1
              ? 'Another payment on this node has no final outcome.'
              : `${formatInteger(BigInt(others.length))} other payments on this node have no final outcome.`}
          </Note>
          <ButtonLink
            to="/nodes/$nodeId/operations"
            params={{ nodeId }}
            search={{ state: 'nonterminal', kind: 'pay_invoice' }}
            size={size}
            variant="outline"
          >
            View operations
          </ButtonLink>
        </Section>
      )}
    </>
  );
}
