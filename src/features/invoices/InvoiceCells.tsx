import { styled } from '@jfrader/ui';
import type { Invoice } from '../../api/types';
import { ListTime } from '../../components/ListTime';
import { formatAge } from '../../lib/time';
import { NotReported } from '../display/NotReported';
import { invoiceExpiry } from './labels';

const Passed = styled.span(({ theme }) => ({ color: theme.color.warning }));

const Muted = styled.span(({ theme }) => ({ color: theme.color.textMuted }));

const Description = styled.span<{ lines: number }>(({ lines }) => ({
  display: '-webkit-box',
  WebkitBoxOrient: 'vertical',
  WebkitLineClamp: lines,
  overflow: 'hidden',
  overflowWrap: 'anywhere',
}));

/** Expiry per §1.4: remaining time for an open invoice, "Expiry passed" for an unpaid one past it. */
export function InvoiceExpiryText({ invoice, now }: { invoice: Invoice; now: number }) {
  const expiry = invoiceExpiry(invoice, now);
  switch (expiry.kind) {
    case 'none':
      return <NotReported />;
    case 'remaining':
      return (
        <span>
          <ListTime at={expiry.at} now={now} /> <Muted>· {formatAge(expiry.at, now)}</Muted>
        </span>
      );
    case 'passed':
      return (
        <Passed>
          Expiry passed · <ListTime at={expiry.at} now={now} />
        </Passed>
      );
    case 'recorded':
      return <ListTime at={expiry.at} now={now} />;
  }
}

/** Description clipped to `lines` in lists; the full text is in the inspector. */
export function InvoiceDescription({ invoice, lines = 1 }: { invoice: Invoice; lines?: number }) {
  if (invoice.description === null) return <NotReported>No description</NotReported>;
  return (
    <Description lines={lines} title={invoice.description}>
      {invoice.description}
    </Description>
  );
}
