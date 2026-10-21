import type { NodeSummary, Operation } from '../../api/types';
import { isPast } from '../../lib/time';
import { capabilityReasonText } from '../nodes/labels';

/**
 * Why this awaiting review cannot be confirmed now, or `null` when it can. Checked on every render
 * against the node's current registry entry; any change to identity, network, access or capability
 * after the review blocks it.
 */
export function confirmBlockReason(operation: Operation, node: NodeSummary | null, now: number): string | null {
  if (!node) return 'This node is not configured anymore.';
  const { review } = operation;
  const capability = node.capabilities[operation.request.kind];
  if (node.read_only) return capabilityReasonText('read_only', node);
  if (isPast(review.expires_at, now)) return 'This review expired.';
  if (node.identity_revision !== review.node.identity_revision || node.network !== review.node.network) {
    return 'The node identity or network changed after this review.';
  }
  if (!capability.enabled) return capabilityReasonText(capability.reason, node);
  return null;
}
