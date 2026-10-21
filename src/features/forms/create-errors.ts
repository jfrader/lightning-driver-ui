import { ApiError } from '../../api/errors';
import type { ErrorCode } from '../../api/types';

/** Form fields a create error can belong to (screens spec §7.0.2). */
export type CreateField = 'amount' | 'invoice' | 'address' | 'peer';

const FIELD_OF: Partial<Record<ErrorCode, CreateField>> = {
  invalid_amount: 'amount',
  policy_violation: 'amount',
  invalid_invoice: 'invoice',
  invoice_expired: 'invoice',
  network_mismatch: 'invoice',
  invalid_address: 'address',
  invalid_peer: 'peer',
};

/** The field a create error belongs to, when the form shows that field; otherwise it is a form notice. */
export function createErrorField(error: unknown, fields: readonly CreateField[]): CreateField | null {
  if (!(error instanceof ApiError)) return null;
  const field = FIELD_OF[error.detail.code];
  return field && fields.includes(field) ? field : null;
}

/** The server's message for a create error placed on `field`, if any. */
export function createFieldError(error: unknown, field: CreateField, fields: readonly CreateField[]): string | undefined {
  return error instanceof ApiError && createErrorField(error, fields) === field ? error.detail.message : undefined;
}
