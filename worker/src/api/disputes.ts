import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../env";
import { ApiError, audit, nowIso } from "../utils";
import { requireAuth } from "../auth";
import { jsonBody, me, idParam } from "./helpers";
import type { AppBindings } from "./helpers";
import { loadBooking, moveBooking, requireBookingActor } from "../services/bookings";
import { notify } from "../services/notifications";
import { DISPUTE_REASONS } from "@agency/shared";

const raiseSchema = z.object({
  booking_id: z.string().min(4).max(64),
  reason: z.enum(DISPUTE_REASONS),
  description: z.string().min(10).max(4000),
});

const resolveSchema = z.object({
  status: z.enum(["UNDER_REVIEW", "RESOLVED", "CLOSED"]),
  resolution: z.string().max(4000).optional().nullable(),
  action: z.enum(["REFUND_FULL", "REFUND_PARTIAL", "RESCHEDULE", "REJECT", "CLOSE"]).optional(),
  refund_amount: z.number().min(0).optional(),
});

export const disputeRoutes = new Hono<AppBindings>();
disputeRoutes.use("*", requireAuth);

disputeRoutes.post("/", async (c) => {
  const user = me(c);
  const input = await jsonBody(raiseSchema, c);
  const booking = await loadBooking(c.env, input.booking_id);
  if (!booking) throw new ApiError(404, "BOOKING_NOT_FOUND", "Booking not found.");
  requireBookingActor(user, booking);
  if (user.role === "admin") throw new ApiError(403, "FORBIDDEN", "Admins resolve disputes, they don't raise them.");

  const existing = await c.env.DB.prepare(`SELECT id FROM disputes WHERE booking_id = ? AND status IN ('OPEN','UNDER_REVIEW')`)
    .bind(input.booking_id)
    .first();
  if (existing) throw new ApiError(409, "DISPUTE_EXISTS", "A dispute is already open for this booking.");

  const id = crypto.randomUUID();
  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO disputes (id, booking_id, raised_by, reason, description, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'OPEN', ?, ?)`,
    )
      .bind(id, input.booking_id, user.id, input.reason, input.description, nowIso(), nowIso()),
    c.env.DB.prepare(`UPDATE bookings SET status = 'DISPUTED', updated_at = ? WHERE id = ?`)
      .bind(nowIso(), input.booking_id),
  ]);
  await moveBooking(c.env, input.booking_id, "DISPUTED", { actorId: user.id, note: "Dispute raised" });
  await notify(c.env, [booking.advertiser_id, booking.publisher_id], "DISPUTE_CREATED", "Dispute opened", input.description.slice(0, 120), `/disputes/${id}`);
  await audit(c.env, { user_id: user.id, action: "DISPUTE_CREATE", entity: "dispute", entity_id: id, new_value: input.reason });
  return c.json({ ok: true, id });
});

disputeRoutes.get("/", async (c) => {
  const user = me(c);
  let where = "1=1";
  const params: unknown[] = [];
  if (user.role === "advertiser") {
    where = "b.advertiser_id = ?";
    params.push(user.advertiserId);
  } else if (user.role === "publisher") {
    where = "b.publisher_id = ?";
    params.push(user.publisherId);
  } else if (user.role !== "admin") {
    throw new ApiError(403, "FORBIDDEN", "Not allowed.");
  }
  if (c.req.query("status")) {
    where += " AND d.status = ?";
    params.push(c.req.query("status"));
  }
  const rows = await c.env.DB.prepare(
    `SELECT d.*, b.campaign_id, pk.title AS package_title, pu.name AS publisher_name, u.name AS raised_by_name
     FROM disputes d
     JOIN bookings b ON b.id = d.booking_id
     LEFT JOIN ad_packages pk ON pk.id = b.package_id
     LEFT JOIN publishers pu ON pu.id = b.publisher_id
     LEFT JOIN users u ON u.id = d.raised_by
     WHERE ${where} ORDER BY d.created_at DESC LIMIT 100`,
  )
    .bind(...params)
    .all();
  return c.json(rows.results);
});

disputeRoutes.post("/:id/resolve", async (c) => {
  const user = me(c);
  if (user.role !== "admin") throw new ApiError(403, "FORBIDDEN", "Only the agency can resolve disputes.");
  const id = idParam(c);
  const input = await jsonBody(resolveSchema, c);
  const dispute = await c.env.DB.prepare(`SELECT * FROM disputes WHERE id = ?`)
    .bind(id)
    .first<{ id: string; booking_id: string; status: string }>();
  if (!dispute) throw new ApiError(404, "DISPUTE_NOT_FOUND", "Dispute not found.");

  const booking = await loadBooking(c.env, dispute.booking_id);
  if (!booking) throw new ApiError(404, "BOOKING_NOT_FOUND", "Booking not found.");

  // Apply resolution action
  if (input.action === "REFUND_FULL" || input.action === "REFUND_PARTIAL") {
    const payment = await c.env.DB.prepare(
      `SELECT * FROM payments WHERE booking_id = ? AND status = 'SUCCESSFUL' ORDER BY created_at DESC LIMIT 1`,
    )
      .bind(dispute.booking_id)
      .first<{ id: string; amount: number; provider_ref: string | null; provider: string | null; status: string }>();
    if (payment) {
      await c.env.DB.prepare(
        `UPDATE payments SET status = ?, updated_at = ? WHERE id = ?`,
      )
        .bind(input.action === "REFUND_FULL" ? "REFUNDED" : "PARTIALLY_REFUNDED", nowIso(), payment.id)
        .run();
      await c.env.DB.prepare(`INSERT INTO payment_events (id, payment_id, event, payload) VALUES (?, ?, 'refunded', ?)`)
        .bind(crypto.randomUUID(), payment.id, JSON.stringify({ amount: input.refund_amount ?? payment.amount, by: user.id }))
        .run();
    }
    await moveBooking(c.env, dispute.booking_id, "REFUNDED", { actorId: user.id, note: `Refund ${input.action === "REFUND_FULL" ? "(full)" : "(partial)"}` });
  } else if (input.action === "RESCHEDULE") {
    await moveBooking(c.env, dispute.booking_id, "SCHEDULED", { actorId: user.id, note: "Rescheduled after dispute" });
  } else if (input.action === "REJECT" || input.action === "CLOSE") {
    await moveBooking(c.env, dispute.booking_id, booking.status === "DISPUTED" ? "SCHEDULED" : booking.status, { actorId: user.id, note: "Dispute closed" });
  }

  await c.env.DB.prepare(`UPDATE disputes SET status = ?, resolution = ?, resolved_by = ?, resolved_at = ?, updated_at = ? WHERE id = ?`)
    .bind(input.status, input.resolution ?? null, user.id, nowIso(), nowIso(), id)
    .run();
  await notify(c.env, [booking.advertiser_id, booking.publisher_id], "SYSTEM", `Dispute ${input.status.toLowerCase()}`, input.resolution ?? null, `/disputes/${id}`);
  await audit(c.env, { user_id: user.id, action: "DISPUTE_RESOLVE", entity: "dispute", entity_id: id, new_value: JSON.stringify({ status: input.status, action: input.action }) });
  return c.json({ ok: true });
});
