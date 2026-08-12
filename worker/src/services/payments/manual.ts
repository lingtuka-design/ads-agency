import type { Env } from "../../env";
import type {
  CreatePaymentInput,
  PaymentProvider,
  PaymentProviderResult,
  VerifyPaymentInput,
} from "./types";
import { randomToken } from "../../utils";

/**
 * Manual / test payment provider.
 * In test mode the advertiser is redirected to a mock page and the payment
 * is confirmed by the worker (no external gateway). For production this
 * must be replaced by a real gateway — swap via env PAYMENT_PROVIDER.
 */
export const manualProvider: PaymentProvider = {
  name: "manual",

  async createPayment(env: Env, input: CreatePaymentInput): Promise<PaymentProviderResult> {
    const providerRef = `MAN_${randomToken(8).toUpperCase()}`;
    return {
      provider: "manual",
      providerRef,
      clientPayload: {
        ref: providerRef,
        mode: "manual",
        bookingId: input.bookingId,
        amount: input.amount,
        currency: input.currency,
      },
      status: "PENDING",
    };
  },

  async verifyPayment(env: Env, input: VerifyPaymentInput) {
    return { success: true, raw: { verified: true, manual: true } };
  },

  async getPaymentStatus() {
    return { success: true };
  },

  async refundPayment() {
    return { success: true };
  },

  async handleWebhook() {
    return { ok: false };
  },
};

export const mockProvider: PaymentProvider = {
  ...manualProvider,
  name: "mock",
};
