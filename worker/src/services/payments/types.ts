import type { Env } from "../../env";
import type { PaymentMethod } from "@agency/shared";

export interface CreatePaymentInput {
  bookingId: string;
  amount: number;
  currency: string;
  method?: PaymentMethod | null;
  metadata?: Record<string, unknown>;
}

export interface PaymentProviderResult {
  provider: string;
  providerRef: string;
  /** payload handed to the frontend (e.g. order id, payment link) */
  clientPayload: Record<string, unknown>;
  status: "PENDING" | "INITIATED" | "SUCCESSFUL" | "FAILED";
}

export interface VerifyPaymentInput {
  providerRef: string;
  amount: number;
  currency: string;
}

export interface PaymentProvider {
  name: string;
  createPayment(env: Env, input: CreatePaymentInput): Promise<PaymentProviderResult>;
  verifyPayment(env: Env, input: VerifyPaymentInput): Promise<{ success: boolean; raw?: unknown }>;
  getPaymentStatus(env: Env, providerRef: string): Promise<{ success: boolean; raw?: unknown }>;
  refundPayment(env: Env, providerRef: string, amount?: number): Promise<{ success: boolean; raw?: unknown }>;
  handleWebhook(env: Env, body: string, headers: Headers): Promise<{ ok: boolean; event?: string; providerRef?: string }>;
}

export function supportsMethod(name: string): boolean {
  return ["manual", "razorpay", "mock"].includes(name);
}
