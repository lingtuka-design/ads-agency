import type { Env } from "./env";
import { moveBooking } from "./services/bookings";
import { releaseReservation, releaseBookedInventory } from "./services/inventory";
import { notify } from "./services/notifications";

/**
 * Scheduled maintenance (spec §72): released by wrangler cron trigger every 15 minutes.
 * - Cancels PENDING_PAYMENT bookings whose payment never completed within the
 *   reservation window, releasing inventory back to AVAILABLE.
 * - Cancels abandoned DRAFT bookings.
 */
export async function runScheduledTasks(env: Env): Promise<{ released: number; cancelled: number }> {
  const settings = await env.DB.prepare(
    `SELECT key, value FROM system_settings WHERE key IN ('inventory.reservation_minutes', 'booking.auto_cancel_after_minutes')`,
  ).all<{ key: string; value: string }>();
  const map = new Map(settings.results.map((r) => [r.key, r.value]));
  const reservationMinutes = parseInt(map.get("inventory.reservation_minutes") ?? "30", 10);
  const autoCancelMinutes = parseInt(map.get("booking.auto_cancel_after_minutes") ?? "1440", 10);

  let released = 0;
  let cancelled = 0;

  // 1. Expired reservations (payment never completed)
  const expired = await env.DB.prepare(
    `SELECT b.id, b.package_id, b.quantity, b.campaign_id, b.advertiser_id, b.publisher_id,
            (SELECT COUNT(*) FROM payments p WHERE p.booking_id = b.id AND p.status = 'SUCCESSFUL') AS paid_count
     FROM bookings b
     WHERE b.status = 'PENDING_PAYMENT'
       AND datetime(b.created_at) < datetime('now', ? || ' minutes')
       AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.booking_id = b.id AND p.status = 'SUCCESSFUL')`,
  )
    .bind(`-${reservationMinutes}`)
    .all<{ id: string; package_id: string; quantity: number; campaign_id: string; advertiser_id: string; publisher_id: string }>();

  for (const b of expired.results) {
    try {
      await moveBooking(env, b.id, "CANCELLED", { actorId: null, note: "Reservation expired — payment not completed" });
      await releaseReservation(env, b.package_id, b.quantity);
      await notify(env, [b.advertiser_id], "SYSTEM", "Booking expired", "Your reservation expired because payment was not completed. The slot has been released.", "/advertiser/bookings");
      released++;
    } catch {
      // already moved or in a state that cannot cancel
    }
  }

  // 2. Abandoned drafts
  const drafts = await env.DB.prepare(
    `SELECT id, package_id, quantity, advertiser_id
     FROM bookings
     WHERE status = 'DRAFT' AND datetime(created_at) < datetime('now', ? || ' minutes')`,
  )
    .bind(`-${autoCancelMinutes}`)
    .all<{ id: string; package_id: string; quantity: number; advertiser_id: string }>();

  for (const b of drafts.results) {
    try {
      await moveBooking(env, b.id, "CANCELLED", { actorId: null, note: "Abandoned draft booking auto-cancelled" });
      await releaseReservation(env, b.package_id, b.quantity);
      await releaseBookedInventory(env, b.package_id, b.quantity);
      cancelled++;
    } catch {
      /* already cancelled */
    }
  }

  return { released, cancelled };
}
