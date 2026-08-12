import type { Env } from "../../env";
import type { PaymentProvider } from "./types";
import { manualProvider, mockProvider } from "./manual";
import { razorpayProvider } from "./razorpay";

export function getProvider(env: Env): PaymentProvider {
  switch (env.PAYMENT_PROVIDER ?? "manual") {
    case "razorpay":
      return razorpayProvider;
    case "mock":
      return mockProvider;
    case "manual":
    default:
      return manualProvider;
  }
}
