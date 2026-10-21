import { Pill, styled } from '@jfrader/ui';
import type { NodeSummary } from '../../api/types';
import { InlineCode } from '../../components/InlineCode';
import { TABLE_MEDIA } from '../../config';
import { BACKEND_LABEL, NETWORK_LABEL } from './labels';

const Head = styled.div(({ theme }) => ({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  columnGap: theme.space[3],
  rowGap: theme.space[1],
}));

const Title = styled.h1(({ theme }) => ({
  margin: 0,
  fontSize: theme.textSize.lg,
  fontWeight: theme.fontWeight.semibold,
  overflowWrap: 'anywhere',
  [TABLE_MEDIA]: { fontSize: theme.textSize.xl },
}));

const Meta = styled.span(({ theme }) => ({ color: theme.color.textMuted, fontSize: theme.textSize.sm }));

/** Node identity on one line at the top of its screens. Live state is in the shell. */
export function NodeHeader({ node }: { node: NodeSummary }) {
  return (
    <Head>
      <Title>{node.label}</Title>
      <Pill tone={node.network === 'unknown' ? 'warning' : 'neutral'}>{NETWORK_LABEL[node.network]}</Pill>
      <InlineCode>{node.id}</InlineCode>
      <Meta>{BACKEND_LABEL[node.backend]}</Meta>
    </Head>
  );
}
