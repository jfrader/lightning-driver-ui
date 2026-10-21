import type { DecodedInvoice, NodeSummary, Operation } from '../../../api/types';
import { wireToMsat } from '../../../lib/money';
import { MsatAmount } from '../../display/Amount';
import { FeeRatio } from '../../display/FeeRatio';
import { Identifier } from '../../display/Identifier';
import { NotReported } from '../../display/NotReported';
import { Consent, ConsentField, FromField, Hero, LedgerLine, Muted, SmallLine } from '../../operations/review/Consent';

interface ConsentBlockProps {
  operation: Operation;
  /** The node's registry entry for its label; `null` for a node no longer configured. */
  node: NodeSummary | null;
  /** The re-decoded invoice, once checked; supplies the description when the request had none. */
  decoded: DecodedInvoice | null;
}

function description(operation: Operation, decoded: DecodedInvoice | null) {
  const requested = operation.request.kind === 'pay_invoice' ? operation.request.params.description : null;
  if (requested) return requested;
  if (decoded?.description) return decoded.description;
  if (decoded?.description_hash) return <NotReported>Description hash only</NotReported>;
  return <NotReported>No description</NotReported>;
}

/**
 * What the passkey approves for a payment, from the immutable server review only: the exact amount,
 * the routing fee cap and its ratio, the derived "at most" total, the full recipient and the node.
 */
export function ConsentBlock({ operation, node, decoded }: ConsentBlockProps) {
  const { review } = operation;
  const amount = review.amount_msat === null ? null : wireToMsat(review.amount_msat, 'msat');
  const maxFee = review.fee.max_fee_msat === null ? null : wireToMsat(review.fee.max_fee_msat, 'msat');
  return (
    <Consent
      kicker="Pay Lightning invoice"
      lead={amount === null ? <NotReported /> : <Hero msat={amount} />}
      ledger={
        <>
          <LedgerLine label="Routing fee" qualifier="Hard cap">
            {maxFee === null ? (
              <NotReported />
            ) : (
              <span>
                <Muted>at most </Muted>
                <MsatAmount msat={maxFee} />
              </span>
            )}
            <SmallLine>
              <FeeRatio feeMsat={review.fee.max_fee_msat} amountMsat={review.amount_msat} cap />
            </SmallLine>
          </LedgerLine>
          <LedgerLine label="Total" total>
            {amount === null || maxFee === null ? (
              <NotReported />
            ) : (
              <span>
                <Muted>at most </Muted>
                <MsatAmount msat={amount + maxFee} />
              </span>
            )}
          </LedgerLine>
        </>
      }
    >
      <ConsentField label="Recipient node">
        {review.destination ? <Identifier value={review.destination} label="Recipient node" prominent /> : <NotReported />}
      </ConsentField>
      <ConsentField label="Description">{description(operation, decoded)}</ConsentField>
      <FromField operation={operation} node={node} />
    </Consent>
  );
}
