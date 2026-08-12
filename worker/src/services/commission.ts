import type { Env } from "../env";
import type { CommissionConfig, CommissionSnapshot } from "@agency/shared";
import { computeCommission } from "@agency/shared";

export async function loadCommissionConfig(env: Env): Promise<CommissionConfig> {
  const rows = await env.DB.prepare(`SELECT key, value FROM system_settings WHERE key LIKE 'commission.%'`).all<{
    key: string;
    value: string;
  }>();
  const map = new Map(rows.results.map((r) => [r.key, r.value]));
  const num = (k: string, fallback: number) => {
    const v = map.get(k);
    return v === undefined ? fallback : parseFloat(v) || 0;
  };

  const config: CommissionConfig = {
    global: { percent: num("commission.global.percent", 10), fixedFee: num("commission.global.fixedFee", 0) },
  };
  for (const [key, value] of map) {
    const m = /^commission\.(publisher|package|campaign)\.([a-zA-Z0-9_]+)\.(percent|fixedFee)$/.exec(key);
    if (!m) continue;
    const [, scope, id, field] = m;
    const bucket =
      scope === "publisher"
        ? (config.publisher ??= {})
        : scope === "package"
          ? (config.package ??= {})
          : (config.campaign ??= {});
    bucket[id] ??= { percent: 10, fixedFee: 0 };
    bucket[id][field === "percent" ? "percent" : "fixedFee"] = parseFloat(value) || 0;
  }
  return config;
}

export function calcForBooking(
  config: CommissionConfig,
  opts: {
    price: number;
    publisherId?: string;
    packageId?: string;
    campaignId?: string;
    discount?: number;
    taxPercent?: number;
    currency?: string;
  },
): CommissionSnapshot {
  return computeCommission(opts.price, {
    config,
    publisherId: opts.publisherId,
    packageId: opts.packageId,
    campaignId: opts.campaignId,
    discount: opts.discount,
    taxPercent: opts.taxPercent,
    currency: opts.currency,
  });
}
