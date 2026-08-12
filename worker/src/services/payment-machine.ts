import type { PaymentStatus } from "@agency/shared";

export const PAYMENT_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  PENDING: ["INITIATED", "SUCCESSFUL", "FAILED"],
  INITIATED: ["SUCCESSFUL", "FAILED", "REFUNDED", "SETTLEMENT_PENDING", "PUBLISHER_PAID", "SETTLEMENT_FAILED"],
  SUCCESSFUL: ["REFUNDED", "PARTIALLY_REFUNDED", "SETTLEMENT_PENDING", "PUBLISHER_PAID", "SETTLEMENT_FAILED", "FAILED"],
  FAILED: ["INITIATED", "SUCCESSFUL"],
  REFUNDED: [],
  PARTIALLY_REFUNDED: ["REFUNDED"],
  SETTLEMENT_PENDING: ["PUBLISHER_PAID", "SETTLEMENT_FAILED", "FAILED"],
  PUBLISHER_PAID: ["SETTLEMENT_PENDING"],
  SETTLEMENT_FAILED: ["SETTLEMENT_PENDING"],
};

export function canTransitionPayment(from: PaymentStatus, to: PaymentStatus): boolean {
  return PAYMENT_TRANSITIONS[from]?.includes(to) ?? false;
}

export function transitionPayment(
  from: PaymentStatus,
  to: PaymentStatus,
): PaymentStatus {
  if (!canTransitionPayment(from, to)) {
    throw new Error(`Invalid payment state transition: ${from} -> ${to}`);
  }
  return to;
}
