import type { NodeSummary, Operation } from '../../../api/types';
import { formatInteger, parseWireDecimal, wireToMsat } from '../../../lib/money';
import { formatDurationSeconds } from '../../../lib/duration';
import { Amount } from '../../display/Amount';
import { Identifier } from '../../display/Identifier';
import { NotReported } from '../../display/NotReported';
import { Consent, ConsentField, FromField, Hero, LedgerLine } from './Consent';

type FeeControl = Operation['review']['fee']['control'];

/** Fee semantics words (copy deck §11.9); only a routing limit is a hard cap. */
const FEE_LINE: Record<Exclude<FeeControl, 'none' | 'absolute_routing_limit'>, { label: string; qualifier: string }> = {
  requested_onchain_rate: { label: 'Fee rate', qualifier: 'Requested; the final fee can differ' },
  cooperative_negotiation: { label: 'Closing fee', qualifier: 'Negotiated with the peer' },
};

/** Requested rate and the node's estimate for an on-chain fee; there is no total, no fee is fixed. */
function OnchainFee({ operation }: { operation: Operation }) {
  const { fee } = operation.review;
  if (fee.control !== 'requested_onchain_rate' && fee.control !== 'cooperative_negotiation') return null;
  const line = FEE_LINE[fee.control];
  return (
    <>
      <LedgerLine label={line.label} qualifier={line.qualifier}>
        {fee.fee_rate_sat_vbyte === null ? (
          <NotReported />
        ) : (
          <span>{`${formatInteger(parseWireDecimal(fee.fee_rate_sat_vbyte))} sat/vB`}</span>
        )}
      </LedgerLine>
      <LedgerLine label="Estimated fee" qualifier="Estimate">
        <Amount value={fee.fee_estimate_sat} unit="sat" />
      </LedgerLine>
    </>
  );
}

function SatHero({ value }: { value: string | null }) {
  return value === null ? <NotReported /> : <Hero msat={wireToMsat(value, 'sat')} />;
}

function PeerField({ pubkey }: { pubkey: string | null }) {
  return (
    <ConsentField label="Peer">
      {pubkey ? <Identifier value={pubkey} label="Peer" prominent /> : <NotReported />}
    </ConsentField>
  );
}

interface KindConsentProps {
  operation: Operation;
  node: NodeSummary | null;
}

/**
 * What one explicit confirmation approves for every kind but payments (which have their own block):
 * the action, exact amounts, fee semantics, counterparties and identifiers, and the bound node. Values
 * come from the immutable server review; only what the review does not carry comes from its request.
 */
export function KindConsent({ operation, node }: KindConsentProps) {
  const { review, request } = operation;
  const from = <FromField operation={operation} node={node} />;
  switch (request.kind) {
    case 'create_invoice':
      return (
        <Consent kicker="Create invoice" lead={review.amount_msat === null ? <NotReported /> : <Hero msat={wireToMsat(review.amount_msat, 'msat')} />}>
          <ConsentField label="Description">{request.params.description || <NotReported>No description</NotReported>}</ConsentField>
          <ConsentField label="Expires after">{formatDurationSeconds(request.params.expiry_seconds)}</ConsentField>
          {from}
        </Consent>
      );
    case 'send_onchain':
      return (
        <Consent kicker="Send on-chain" lead={<SatHero value={review.amount_sat} />} ledger={<OnchainFee operation={operation} />}>
          <ConsentField label="Recipient address">
            {review.destination ? <Identifier value={review.destination} label="Recipient address" prominent /> : <NotReported />}
          </ConsentField>
          {from}
        </Consent>
      );
    case 'open_channel':
      return (
        <Consent
          kicker="Open channel"
          lead={<SatHero value={review.amount_sat} />}
          leadCaption="Channel capacity from this node"
          ledger={<OnchainFee operation={operation} />}
        >
          <PeerField pubkey={review.peer_pubkey} />
          <ConsentField label="Visibility">{request.params.private ? 'Private' : 'Public'}</ConsentField>
          {from}
        </Consent>
      );
    case 'close_channel':
      return (
        <Consent
          kicker="Close channel"
          lead={review.channel_id ?? request.params.channel_id}
          ledger={<OnchainFee operation={operation} />}
          warning="Cooperative close only. The peer must be online."
        >
          <PeerField pubkey={review.peer_pubkey} />
          {from}
        </Consent>
      );
    case 'connect_peer':
      return (
        <Consent kicker="Connect peer">
          <PeerField pubkey={review.peer_pubkey} />
          <ConsentField label="Address">
            <Identifier value={`${request.params.host}:${request.params.port}`} label="Address" grouped={false} />
          </ConsentField>
          {from}
        </Consent>
      );
    case 'disconnect_peer':
      return (
        <Consent kicker="Disconnect peer" warning="Channels with this peer are inactive while it is disconnected.">
          <PeerField pubkey={review.peer_pubkey} />
          {from}
        </Consent>
      );
    case 'new_address':
      return (
        <Consent kicker="New address">
          <ConsentField label="Address type">Native SegWit (P2WPKH)</ConsentField>
          {from}
        </Consent>
      );
    case 'pay_invoice':
      return null;
  }
}
