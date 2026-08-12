import type { Env } from "../env";
import type { BookingStatus } from "@agency/shared";
import { transitionBooking } from "@agency/shared";
import { ApiError, audit, nowIso } from "../utils";

export interface BookingJoined {
  id: string;
  campaign_id: string;
  package_id: string;
  publisher_id: string;
  advertiser_id: string;
  quantity: number;
  unit_price: number;
  amount: number;
  currency: string;
  status: BookingStatus;
  scheduled_start: string | null;
  scheduled_end: string | null;
  instructions: string | null;
  finance: string | null;
  package_title: string;
  platform: string;
  publisher_name: string;
  publisher_slug: string;
  campaign_name: string;
}

export async function loadBooking(env: Env, bookingId: string): Promise<BookingJoined | null> {
  return env.DB.prepare(
    `SELECT b.*, p.title AS package_title, p.platform, pu.name AS publisher_name, pu.slug AS publisher_slug,
            c.name AS campaign_name
     FROM bookings b
     JOIN ad_packages p ON p.id = b.package_id
     JOIN publishers pu ON pu.id = b.publisher_id
     JOIN campaigns c ON c.id = b.campaign_id
     WHERE b.id = ?`,
  )
    .bind(bookingId)
    .first<BookingJoined>();
}

export interface TransitionContext {
  actorId?: string | null;
  note?: string | null;
  ip?: string | null;
}

/**
 * Apply a validated state-machine transition with history + audit trail.
 * Throws if the transition is not allowed (spec §73).
 */
export async function moveBooking(
  env: Env,
  bookingId: string,
  to: BookingStatus,
  ctx: TransitionContext = {},
): Promise<void> {
  const booking = await env.DB.prepare(`SELECT id, status FROM bookings WHERE id = ?`)
    .bind(bookingId)
    .first<{ id: string; status: BookingStatus }>();
  if (!booking) throw new ApiError(404, "BOOKING_NOT_FOUND", "Booking not found.");

  const from = booking.status;
  const next = transitionBooking(from, to); // throws on invalid
  if (next === from) return;

  const id = crypto.randomUUID();
  const ts = nowIso();
  await env.DB.batch([
    env.DB.prepare(`UPDATE bookings SET status = ?, updated_at = ? WHERE id = ?`).bind(next, ts, bookingId),
    env.DB.prepare(
      `INSERT INTO booking_status_history (id, booking_id, from_status, to_status, actor_id, note) VALUES (?, ?, ?, ?, ?, ?)`,
    )
      .bind(id, bookingId, from, next, ctx.actorId ?? null, ctx.note ?? null),
  ]);
  await audit(env, {
    user_id: ctx.actorId ?? null,
    action: `BOOKING_${next}`,
    entity: "booking",
    entity_id: bookingId,
    old_value: from,
    new_value: next,
    ip: ctx.ip ?? null,
  });
}

export async function bookingHistory(env: Env, bookingId: string) {
  return env.DB.prepare(
    `SELECT h.*, u.name AS actor_name FROM booking_status_history h
     LEFT JOIN users u ON u.id = h.actor_id
     WHERE h.booking_id = ? ORDER BY h.created_at ASC`,
  )
    .bind(bookingId)
    .all();
}

export function requireBookingActor(
  user: { role: string; id: string; publisherId?: string | null; advertiserId?: string | null },
  booking: BookingJoined,
): void {
  if (user.role === "admin") return;
  if (user.role === "advertiser" && user.advertiserId === booking.advertiser_id) return;
  if (user.role === "publisher" && user.publisherId === booking.publisher_id) return;
  throw new ApiError(403, "FORBIDDEN", "You do not have access to this booking.");
}
