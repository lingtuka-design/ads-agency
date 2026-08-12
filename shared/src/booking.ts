import {
  BOOKING_TRANSITIONS,
  canTransition,
  type BookingStatus,
} from "./constants";

export class InvalidBookingTransitionError extends Error {
  from: BookingStatus;
  to: BookingStatus;
  constructor(from: BookingStatus, to: BookingStatus) {
    super(`Invalid booking state transition: ${from} -> ${to}`);
    this.from = from;
    this.to = to;
    this.name = "InvalidBookingTransitionError";
  }
}

export function transitionBooking(
  from: BookingStatus,
  to: BookingStatus,
): BookingStatus {
  if (!canTransition(from, to)) {
    throw new InvalidBookingTransitionError(from, to);
  }
  return to;
}

export const ALLOWED_TRANSITIONS = BOOKING_TRANSITIONS;

/** Steps of the campaign lifecycle for the visual timeline (spec §23). */
export const CAMPAIGN_TIMELINE: { status: BookingStatus; label: string }[] = [
  { status: "DRAFT", label: "Booking Created" },
  { status: "PENDING_PAYMENT", label: "Payment Pending" },
  { status: "PAID", label: "Payment Received" },
  { status: "CREATIVE_APPROVED", label: "Creative Approved" },
  { status: "SENT_TO_PUBLISHER", label: "Sent to Publisher" },
  { status: "PUBLISHER_APPROVED", label: "Publisher Approved" },
  { status: "SCHEDULED", label: "Scheduled" },
  { status: "LIVE", label: "Published" },
  { status: "PROOF_SUBMITTED", label: "Proof Received" },
  { status: "COMPLETED", label: "Campaign Completed" },
];

export function timelineIndex(status: BookingStatus): number {
  const i = CAMPAIGN_TIMELINE.findIndex((s) => s.status === status);
  return i < 0 ? 0 : i;
}
