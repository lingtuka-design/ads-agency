import type { Env } from "../../env";
import type {
  CreatePaymentInput,
  PaymentProvider,
  PaymentProviderResult,
  VerifyPaymentInput,
} from "./types";
import { ApiError } from "../../utils";

function razorpayHeaders(env: Env): Record<string, string> {
  const keyId = env.RAZORPAY_KEY_ID;
  const keySecret = env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw new ApiError(500, "PAYMENT_NOT_CONFIGURED", "Online payments are not configured yet.");
  }
  return {
    Authorization: "Basic " + btoa(`${keyId}:${keySecret}`),
    "Content-Type": "application/json",
  };
}

const RAZORPAY_API = "https://api.razorpay.com/v1";

/**
 * Razorpay provider (UPI / cards / netbanking / wallets).
 * All calls are server-side; secrets live in Cloudflare secrets only (spec §56).
 */
export const razorpayProvider: PaymentProvider = {
  name: "razorpay",

  async createPayment(env: Env, input: CreatePaymentInput): Promise<PaymentProviderResult> {
    const res = await fetch(`${RAZORPAY_API}/orders`, {
      method: "POST",
      headers: razorpayHeaders(env),
      body: JSON.stringify({
        amount: Math.round(input.amount * 100),
        currency: input.currency,
        receipt: `booking_${input.bookingId.slice(0, 12)}`,
        notes: { bookingId: input.bookingId },
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new ApiError(502, "PAYMENT_GATEWAY_ERROR", "Payment gateway could not create the order.");
    }
    const order = (await res.json()) as { id: string; amount: number; currency: string };
    return {
      provider: "razorpay",
      providerRef: order.id,
      clientPayload: {
        orderId: order.id,
        amount: order.amount / 100,
        currency: order.currency,
        keyId: env.RAZORPAY_KEY_ID,
        name: env.APP_NAME,
        prefill: { contact: "", email: "" },
      },
      status: "INITIATED",
    };
  },

  async verifyPayment(env: Env, input: VerifyPaymentInput) {
    // Server-side fetch: never trust the frontend callback alone (spec §18).
    const res = await fetch(`${RAZORPAY_API}/payments/${input.providerRef}`, {
      headers: razorpayHeaders(env),
    });
    if (!res.ok) return { success: false };
    const data = (await res.json()) as { status?: string; amount?: number; currency?: string };
    const ok =
      data.status === "captured" &&
      (data.amount ?? 0) === Math.round(input.amount * 100) &&
      (!input.currency || data.currency === input.currency);
    return { success: !!ok, raw: data };
  },

  async getPaymentStatus(env: Env, providerRef: string) {
    const res = await fetch(`${RAZORPAY_API}/payments/${providerRef}`, {
      headers: razorpayHeaders(env),
    });
    if (!res.ok) return { success: false };
    const data = (await res.json()) as { status?: string };
    return { success: data.status === "captured", raw: data };
  },

  async refundPayment(env: Env, providerRef: string, amount?: number) {
    const body: Record<string, unknown> = {};
    if (amount) body.amount = Math.round(amount * 100);
    const res = await fetch(`${RAZORPAY_API}/payments/${providerRef}/refund`, {
      method: "POST",
      headers: razorpayHeaders(env),
      body: JSON.stringify(body),
    });
    if (!res.ok) return { success: false };
    return { success: true, raw: await res.json() };
  },

  async handleWebhook(env: Env, body: string, headers: Headers) {
    const signature = headers.get("x-razorpay-signature") ?? "";
    const secret = env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) return { ok: false };
    // HMAC-SHA256 signature verification (spec §57).
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
    const expected = Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
    if (signature !== expected) return { ok: false };
    const data = JSON.parse(body) as { event?: string; payload?: Record<string, unknown> };
    return { ok: true, event: data.event, providerRef: undefined };
  },
};
