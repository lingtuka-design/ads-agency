import { describe, expect, it } from "vitest";
import {
  BOOKING_TRANSITIONS,
  canTransition,
  transitionBooking,
  InvalidBookingTransitionError,
  timelineIndex,
  CAMPAIGN_TIMELINE,
} from "@agency/shared";

describe("booking state machine (spec §73)", () => {
  it("allows the happy path", () => {
    const path: string[] = [
      "DRAFT",
      "PENDING_PAYMENT",
      "PAID",
      "CREATIVE_REQUIRED",
      "CREATIVE_APPROVED",
      "SENT_TO_PUBLISHER",
      "PUBLISHER_APPROVED",
      "SCHEDULED",
      "LIVE",
      "PROOF_SUBMITTED",
      "COMPLETED",
    ];
    let current = "DRAFT";
    for (const next of path.slice(1)) {
      current = transitionBooking(current as never, next as never);
    }
    expect(current).toBe("COMPLETED");
  });

  it("rejects invalid transitions", () => {
    expect(() => transitionBooking("DRAFT", "COMPLETED")).toThrow(InvalidBookingTransitionError);
    expect(() => transitionBooking("COMPLETED", "LIVE")).toThrow();
  });

  it("canTransition guards", () => {
    expect(canTransition("PAID", "DISPUTED")).toBe(true);
    expect(canTransition("DRAFT", "REFUNDED")).toBe(false);
  });

  it("dispute can resolve back to a live state", () => {
    expect(canTransition("DISPUTED", "SCHEDULED")).toBe(true);
    expect(canTransition("DISPUTED", "REFUNDED")).toBe(true);
    expect(canTransition("DISPUTED", "CANCELLED")).toBe(true);
  });

  it("refund path", () => {
    expect(canTransition("CANCELLED", "REFUNDED")).toBe(true);
    expect(canTransition("PAID", "REFUNDED")).toBe(true);
  });

  it("every transition is bidirectional-valid in the map", () => {
    // every status key exists and every target exists
    for (const [from, targets] of Object.entries(BOOKING_TRANSITIONS)) {
      for (const t of targets) {
        expect(BOOKING_TRANSITIONS[t], `target ${t} of ${from}`).toBeDefined();
      }
    }
  });

  it("timeline ordering", () => {
    expect(CAMPAIGN_TIMELINE.length).toBeGreaterThan(5);
    expect(timelineIndex("DRAFT")).toBe(0);
    expect(timelineIndex("COMPLETED")).toBe(CAMPAIGN_TIMELINE.length - 1);
    expect(timelineIndex("LIVE")).toBeGreaterThan(timelineIndex("SCHEDULED"));
  });
});
