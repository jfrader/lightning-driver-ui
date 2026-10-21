import { Disclosure } from '../../components/Disclosure';
import { Section } from '../../components/Section';
import { WorkLayout } from '../../components/WorkLayout';
import { ASIDE_QUERY } from '../../config';
import { useMediaQuery } from '../../lib/use-media-query';
import { AttentionList } from '../overview/AttentionList';
import { BalanceGroups } from '../overview/BalanceGroups';
import { NodeContext } from '../overview/NodeContext';
import { QuickActions } from '../overview/QuickActions';
import { RecentPayments } from '../overview/RecentPayments';
import { useCurrentNode } from './use-current-node';

/** Attention first, balances second, actions third, recent payments fourth; node facts aside. */
export function NodeOverviewPage() {
  const node = useCurrentNode();
  const besideContent = useMediaQuery(ASIDE_QUERY);
  const context = <NodeContext node={node} />;
  return (
    <WorkLayout
      asideLabel="Node details"
      main={
        <>
          <AttentionList nodeId={node.id} />
          <Section title="Balances">
            <BalanceGroups nodeId={node.id} />
          </Section>
          <QuickActions node={node} />
          <RecentPayments nodeId={node.id} />
        </>
      }
      aside={
        besideContent ? (
          context
        ) : (
          <Disclosure value="node" label="Node details and policy">
            {context}
          </Disclosure>
        )
      }
    />
  );
}
