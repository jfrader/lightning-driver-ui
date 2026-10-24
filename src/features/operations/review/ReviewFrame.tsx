import type { ReactNode } from 'react';
import { Flex, Pill, styled } from '@jfrader/ui';
import type { DecodedInvoice, Operation } from '../../../api/types';
import { WorkLayout } from '../../../components/WorkLayout';
import { READING_WIDTH, TABLE_MEDIA } from '../../../config';
import { formatClockTime, isPast } from '../../../lib/time';
import { useNow } from '../../../lib/use-now';
import { ReviewDetails } from '../ReviewDetails';
import { ListLink } from './kind-links';
import { LIST_OF_KIND } from './kind-lists';
import { useOperationSheet } from '../sheet-context';

const Head = styled.div(({ theme }) => ({ display: 'grid', gap: theme.space[1], justifyItems: 'start' }));

const TitleRow = styled.div(({ theme }) => ({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  columnGap: theme.space[3],
  rowGap: theme.space[1],
}));

const Title = styled.h2(({ theme }) => ({ margin: 0, fontSize: theme.textSize.xl, fontWeight: theme.fontWeight.semibold }));

const Expiry = styled.span(({ theme }) => ({ fontSize: theme.textSize.sm, color: theme.color.textMuted, whiteSpace: 'nowrap' }));

const Mono = styled.span(({ theme }) => ({ fontFamily: theme.font.mono }));

const Stack = styled.div(({ theme }) => ({
  display: 'grid',
  gap: theme.space[3],
  minInlineSize: 0,
  [TABLE_MEDIA]: { gap: theme.space[5] },
}));

interface ReviewFrameProps {
  operation: Operation;
  title: string;
  consent: ReactNode;
  /** The confirm control, or the reason it is blocked. */
  confirmation: ReactNode;
  aside?: ReactNode;
  asideLabel?: string;
  decoded?: DecodedInvoice | null;
}

/**
 * Every review screen: back to its list, the title with the `Not sent` tag and the review's expiry,
 * then what is being approved, the one confirm control and the collapsed technical details.
 */
export function ReviewFrame({ operation, title, consent, confirmation, aside, asideLabel = 'Context', decoded }: ReviewFrameProps) {
  const sheet = useOperationSheet();
  const now = useNow();
  const expired = isPast(operation.review.expires_at, now);
  const main = (
    <Stack>
      {consent}
      {confirmation}
      <ReviewDetails operation={operation} decoded={decoded} />
    </Stack>
  );
  return (
    <Flex direction="column" gap="md">
      <Head>
        <ListLink nodeId={operation.node_id} list={LIST_OF_KIND[operation.request.kind]} />
        <TitleRow>
          <Title>{title}</Title>
          <Pill tone="neutral">{expired ? 'Expired' : 'Not sent'}</Pill>
          <Expiry>
            expires <Mono>{formatClockTime(operation.review.expires_at)}</Mono> UTC
          </Expiry>
        </TitleRow>
      </Head>
      {aside ? (
        <WorkLayout stacked={sheet !== null} mainWidth={READING_WIDTH} asideLabel={asideLabel} main={main} aside={aside} />
      ) : (
        <div style={{ maxInlineSize: READING_WIDTH }}>{main}</div>
      )}
    </Flex>
  );
}
