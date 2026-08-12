import { describe, expect, it } from "vitest";
import {
  computeCommission,
  commissionBreakdown,
  type CommissionConfig,
} from "@agency/shared";

const defaultConfig: CommissionConfig = { global: { percent: 10 } };

describe("commission engine (spec §19, §55)", () => {
  it("applies the global 10% commission", () => {
    const snap = computeCommission(10_000, { config: defaultConfig });
    expect(snap.grossAmount).toBe(10_000);
    expect(snap.commissionAmount).toBe(1_000);
    expect(snap.publisherAmount).toBe(9_000);
    expect(snap.netAgencyAmount).toBe(1_000);
    expect(snap.commissionPercent).toBe(10);
  });

  it("honours publisher-specific overrides", () => {
    const config: CommissionConfig = {
      global: { percent: 10 },
      publisher: { pub_x: { percent: 5 } },
    };
    const snap = computeCommission(10_000, { config, publisherId: "pub_x" });
    expect(snap.commissionAmount).toBe(500);
    expect(snap.publisherAmount).toBe(9_500);
  });

  it("precedence: campaign > package > publisher > global", () => {
    const config: CommissionConfig = {
      global: { percent: 10 },
      publisher: { pub_x: { percent: 5 } },
      package: { pkg_y: { percent: 3 } },
      campaign: { camp_z: { percent: 1 } },
    };
    expect(computeCommission(10_000, { config, publisherId: "pub_x", packageId: "pkg_y", campaignId: "camp_z" }).commissionAmount).toBe(100);
    expect(computeCommission(10_000, { config, publisherId: "pub_x", packageId: "pkg_y" }).commissionAmount).toBe(300);
    expect(computeCommission(10_000, { config, publisherId: "pub_x" }).commissionAmount).toBe(500);
  });

  it("handles discounts and fixed fees", () => {
    const snap = computeCommission(10_000, {
      config: { global: { percent: 10, fixedFee: 100 } },
      discount: 2_000,
    });
    expect(snap.grossAmount).toBe(8_000);
    expect(snap.commissionAmount).toBe(900); // 10% of 8000 + 100
    expect(snap.publisherAmount).toBe(7_100);
  });

  it("applies tax on the gross amount", () => {
    const snap = computeCommission(10_000, { config: defaultConfig, taxPercent: 18 });
    expect(snap.tax).toBe(1_800);
    expect(snap.grossAmount).toBe(10_000);
  });

  it("never produces negative publisher amounts", () => {
    const snap = computeCommission(100, { config: { global: { percent: 200 } } });
    expect(snap.publisherAmount).toBe(0);
  });

  it("snapshot is immutable against later config changes (spec §55)", () => {
    const config: CommissionConfig = { global: { percent: 10 } };
    const snap = computeCommission(10_000, { config, publisherId: "pub_x" });
    // simulate the admin later lowering commission to 5%
    config.global.percent = 5;
    expect(snap.commissionPercent).toBe(10);
    expect(snap.commissionAmount).toBe(1_000);
  });

  it("commissionBreakdown helper", () => {
    const { commissionAmount, publisherAmount } = commissionBreakdown(10_000, 10);
    expect(commissionAmount).toBe(1_000);
    expect(publisherAmount).toBe(9_000);
  });
});
