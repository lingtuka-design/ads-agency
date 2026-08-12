import { describe, expect, it } from "vitest";
import {
  computeInventory,
  inventoryStatus,
  canReserve,
  isDateConflict,
  isDateInRange,
} from "@agency/shared";

describe("inventory engine (spec §6, §72)", () => {
  it("computes available slots", () => {
    const inv = computeInventory(5, 3, 1);
    expect(inv.availableSlots).toBe(1);
    expect(inventoryStatus(inv)).toBe("LOW");
  });

  it("sold out when everything is booked", () => {
    const inv = computeInventory(5, 5, 0);
    expect(inv.availableSlots).toBe(0);
    expect(inventoryStatus(inv)).toBe("SOLD_OUT");
  });

  it("sold out when capacity is zero", () => {
    expect(inventoryStatus(computeInventory(0, 0, 0))).toBe("SOLD_OUT");
  });

  it("cannot reserve beyond availability (no overbooking)", () => {
    const inv = computeInventory(5, 4, 0);
    expect(canReserve(inv, 1)).toBe(true);
    expect(canReserve(inv, 2)).toBe(false);
  });

  it("reservations reduce availability without counting as booked", () => {
    const inv = computeInventory(5, 0, 5);
    expect(inv.availableSlots).toBe(0);
    expect(inventoryStatus(inv)).toBe("SOLD_OUT");
  });

  it("status transitions: AVAILABLE → LOW → SOLD_OUT", () => {
    expect(inventoryStatus(computeInventory(10, 0, 0))).toBe("AVAILABLE");
    expect(inventoryStatus(computeInventory(10, 8, 0))).toBe("LOW");
    expect(inventoryStatus(computeInventory(10, 10, 0))).toBe("SOLD_OUT");
  });

  it("detects blackout date conflicts", () => {
    expect(
      isDateConflict({
        startDate: "2026-08-10",
        endDate: "2026-08-15",
        blackoutDates: ["2026-08-12"],
        availableFrom: null,
        availableTo: null,
      }),
    ).toBe(true);
    expect(
      isDateConflict({
        startDate: "2026-08-10",
        endDate: "2026-08-11",
        blackoutDates: ["2026-08-12"],
        availableFrom: null,
        availableTo: null,
      }),
    ).toBe(false);
  });

  it("respects availability windows", () => {
    expect(
      isDateConflict({
        startDate: "2026-07-01",
        endDate: "2026-07-10",
        blackoutDates: [],
        availableFrom: "2026-08-01",
        availableTo: "2026-08-31",
      }),
    ).toBe(true);
    expect(
      isDateConflict({
        startDate: "2026-08-05",
        endDate: "2026-08-10",
        blackoutDates: [],
        availableFrom: "2026-08-01",
        availableTo: "2026-08-31",
      }),
    ).toBe(false);
  });

  it("rejects inverted date ranges", () => {
    expect(
      isDateConflict({
        startDate: "2026-08-20",
        endDate: "2026-08-10",
        blackoutDates: [],
        availableFrom: null,
        availableTo: null,
      }),
    ).toBe(true);
  });

  it("isDateInRange", () => {
    expect(isDateInRange("2026-08-15", "2026-08-01", "2026-08-31")).toBe(true);
    expect(isDateInRange("2026-09-01", "2026-08-01", "2026-08-31")).toBe(false);
  });
});
