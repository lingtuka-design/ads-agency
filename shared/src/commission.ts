import type { CommissionSnapshot } from "./constants";

export interface CommissionRule {
  percent: number;
  fixedFee?: number;
}

export interface CommissionConfig {
  global: CommissionRule;
  publisher?: Record<string, CommissionRule>;
  package?: Record<string, CommissionRule>;
  campaign?: Record<string, CommissionRule>;
  promotional?: CommissionRule;
}

function resolveRule(
  config: CommissionConfig,
  publisherId?: string,
  packageId?: string,
  campaignId?: string,
): CommissionRule {
  if (campaignId && config.campaign?.[campaignId]) return config.campaign[campaignId];
  if (packageId && config.package?.[packageId]) return config.package[packageId];
  if (publisherId && config.publisher?.[publisherId]) return config.publisher[publisherId];
  if (config.promotional) return config.promotional;
  return config.global;
}

/**
 * Compute a permanent financial snapshot for a booking.
 * Must be called at booking/payment time and stored — never recomputed
 * with future commission settings (spec §55).
 */
export function computeCommission(
  price: number,
  opts: {
    config: CommissionConfig;
    publisherId?: string;
    packageId?: string;
    campaignId?: string;
    discount?: number;
    taxPercent?: number;
    currency?: string;
  },
): CommissionSnapshot {
  const rule = resolveRule(
    opts.config,
    opts.publisherId,
    opts.packageId,
    opts.campaignId,
  );
  const discount = opts.discount ?? 0;
  const taxPercent = opts.taxPercent ?? 0;

  const grossAmount = Math.max(0, price - discount);
  const tax = Math.round(grossAmount * (taxPercent / 100) * 100) / 100;
  const taxable = grossAmount;
  const commissionAmount =
    Math.round(taxable * (rule.percent / 100) * 100) / 100 +
    (rule.fixedFee ?? 0);
  const publisherAmount = Math.max(0, Math.round((grossAmount - commissionAmount) * 100) / 100);
  const netAgencyAmount = Math.round((grossAmount - publisherAmount) * 100) / 100;

  return {
    originalPrice: price,
    discount,
    tax,
    grossAmount,
    commissionPercent: rule.percent,
    commissionAmount,
    publisherAmount,
    netAgencyAmount,
    currency: opts.currency ?? "INR",
  };
}

export function commissionBreakdown(price: number, percent: number): {
  commissionAmount: number;
  publisherAmount: number;
} {
  const commissionAmount = Math.round(price * (percent / 100) * 100) / 100;
  return {
    commissionAmount,
    publisherAmount: Math.round((price - commissionAmount) * 100) / 100,
  };
}
