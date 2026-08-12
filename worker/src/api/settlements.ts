import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../env";
import { ApiError, audit, nowIso } from "../utils";
import { requireAuth } from "../auth";
import { jsonBody, me, idParam } from "./helpers";
import type { AppBindings } from "./helpers";
import { notify } from "../services/notifications";
import { loadBooking } from "../services/bookings";

const createSettlementSchema = z.object({
  publisher_id: z.string().min(4).max(64),
  booking_ids: z.array(z.string().min(4).max(64)).min(1).max(50),
  method: z.string().max(100).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

const paySchema = z.object({
  status: z.enum(["APPROVED", "PAID", "FAILED", "CANCELLED"]),
  payout_ref: z.string().max(200).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

export const settlementRoutes = new Hono<AppBindings>();
settlementRoutes.use("*", requireAuth);

settlementRoutes.get("/", async (c) => {
  const user = me(c);
  let where = "1=1";
  const params: unknown[] = [];
  if (user.role === "publisher") {
    where = "publisher_id = ?";
    params.push(user.publisherId);
  }
  const rows = await c.env.DB.prepare(
    `SELECT s.*, pu.name AS publisher_name,
            (SELECT COUNT(*) FROM settlement_items si WHERE si.settlement_id = s.id) AS item_count
     FROM settlements s LEFT JOIN publishers pu ON pu.id = s.publisher_id
     WHERE ${where} ORDER BY s.created_at DESC LIMIT 100`,
  )
    .bind(...params)
    .all();
  return c.json(rows.results);
});

settlementRoutes.get("/:id", async (c) => {
  const user = me(c);
  const settlement = await c.env.DB.prepare(
    `SELECT s.id, s.publisher_id, s.status, s.amount, s.currency, s.method, s.payout_ref, s.paid_at, s.notes, s.created_at, s.updated_at,
            pu.name AS publisher_name, pu.slug AS publisher_slug
     FROM settlements s LEFT JOIN publishers pu ON pu.id = s.publisher_id WHERE s.id = ?`,
  )
    .bind(idParam(c))
    .first<{ id: string; publisher_id: string; status: string }>();
  if (!settlement) throw new ApiError(404, "SETTLEMENT_NOT_FOUND", "Settlement not found.");
  if (user.role === "publisher" && settlement.publisher_id !== user.publisherId) {
    throw new ApiError(403, "FORBIDDEN", "Not your settlement.");
  }
  const items = await c.env.DB.prepare(
    `SELECT si.*, b.status AS booking_status, b.currency, pk.title AS package_title, c.name AS campaign_name
     FROM settlement_items si
     JOIN bookings b ON b.id = si.booking_id
     LEFT JOIN ad_packages pk ON pk.id = b.package_id
     LEFT JOIN campaigns c ON c.id = b.campaign_id
     WHERE si.settlement_id = ?`,
  )
    .bind(settlement.id)
    .all();
  return c.json({ settlement, items: items.results });
});

// Admin only
settlementRoutes.post("/", async (c) => {
  const user = me(c);
  if (user.role !== "admin") throw new ApiError(403, "FORBIDDEN", "Only the agency creates settlements.");
  const input = await jsonBody(createSettlementSchema, c);

  let total = 0;
  const items: { booking_id: string; amount: number; commission_amount: number }[] = [];
  for (const bid of input.booking_ids) {
    const booking = await c.env.DB.prepare(
      `SELECT id, publisher_id, amount, finance FROM bookings WHERE id = ? AND publisher_id = ?`,
    )
      .bind(bid, input.publisher_id)
      .first<{ id: string; publisher_id: string; amount: number; finance: string | null }>();
    if (!booking) throw new ApiError(400, "BOOKING_INVALID", `Booking ${bid} does not belong to this publisher.`);
    const already = await c.env.DB.prepare(`SELECT id FROM settlement_items WHERE booking_id = ?`)
      .bind(bid)
      .first();
    if (already) throw new ApiError(409, "ALREADY_SETTLED", `Booking ${bid} is already part of a settlement.`);
    const finance = booking.finance ? JSON.parse(booking.finance) : null;
    const amount = finance?.publisherAmount ?? booking.amount;
    total += amount;
    items.push({ booking_id: booking.id, amount, commission_amount: finance?.commissionAmount ?? 0 });
  }
  if (total <= 0) throw new ApiError(400, "INVALID_AMOUNT", "Settlement amount must be positive.");

  const id = crypto.randomUUID();
  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO settlements (id, publisher_id, status, amount, currency, method, notes, created_at, updated_at)
       VALUES (?, ?, 'PENDING', ?, 'INR', ?, ?, ?, ?)`,
    )
      .bind(id, input.publisher_id, total, input.method ?? null, input.notes ?? null, nowIso(), nowIso()),
    ...items.map((it) =>
      c.env.DB.prepare(
        `INSERT INTO settlement_items (id, settlement_id, booking_id, amount, commission_amount) VALUES (?, ?, ?, ?, ?)`,
      ).bind(crypto.randomUUID(), id, it.booking_id, it.amount, it.commission_amount),
    ),
  ]);
  const pubUser = await c.env.DB.prepare(`SELECT user_id FROM publishers WHERE id = ?`)
    .bind(input.publisher_id)
    .first<{ user_id: string }>();
  await notify(c.env, [pubUser?.user_id], "SETTLEMENT_CREATED", "Settlement created", `â‚¹${total} is being processed.`, `/earnings`);
  await audit(c.env, { user_id: user.id, action: "SETTLEMENT_CREATE", entity: "settlement", entity_id: id, new_value: JSON.stringify({ amount: total, bookings: input.booking_ids.length }) });
  return c.json({ ok: true, id, amount: total });
});

// Admin only
settlementRoutes.post("/:id/pay", async (c) => {
  const user = me(c);
  if (user.role !== "admin") throw new ApiError(403, "FORBIDDEN", "Only the agency can update settlements.");
  const input = await jsonBody(paySchema, c);
  const settlement = await c.env.DB.prepare(`SELECT * FROM settlements WHERE id = ?`)
    .bind(idParam(c))
    .first<{ id: string; publisher_id: string; status: string; amount: number }>();
  if (!settlement) throw new ApiError(404, "SETTLEMENT_NOT_FOUND", "Settlement not found.");
  const ts = nowIso();
  await c.env.DB.prepare(
    `UPDATE settlements SET status = ?, payout_ref = COALESCE(?, payout_ref), notes = COALESCE(?, notes), paid_at = CASE WHEN ? = 'PAID' THEN ? ELSE paid_at END, updated_at = ? WHERE id = ?`,
  )
    .bind(input.status, input.payout_ref ?? null, input.notes ?? null, input.status, ts, ts, settlement.id)
    .run();
  if (input.status === "PAID") {
    await c.env.DB.prepare(`UPDATE payments SET status = 'PUBLISHER_PAID', updated_at = ? WHERE booking_id IN (SELECT booking_id FROM settlement_items WHERE settlement_id = ?)`)
      .bind(ts, settlement.id)
      .run();
  }
  const pubUser = await c.env.DB.prepare(`SELECT user_id FROM publishers WHERE id = ?`)
    .bind(settlement.publisher_id)
    .first<{ user_id: string }>();
  await notify(c.env, [pubUser?.user_id], "SETTLEMENT_PAID", `Settlement ${input.status.toLowerCase()}`, `â‚¹${settlement.amount} â€” ${input.payout_ref ?? "see details"}.`, `/earnings`);
  await audit(c.env, { user_id: user.id, action: "SETTLEMENT_UPDATE", entity: "settlement", entity_id: settlement.id, new_value: input.status });
  return c.json({ ok: true });
});

// Publishers can see what's payable for them
export async function publisherPayable(env: Env, publisherId: string) {
  const rows = await env.DB.prepare(
    `SELECT b.id AS booking_id, CAST(JSON_EXTRACT(b.finance, '$.publisherAmount') AS REAL) AS amount,
            b.finance
     FROM bookings b JOIN payments p ON p.booking_id = b.id
     WHERE b.publisher_id = ? AND p.status = 'SUCCESSFUL'
       AND b.id NOT IN (SELECT booking_id FROM settlement_items)
     ORDER BY p.paid_at ASC`,
  )
    .bind(publisherId)
    .all();
  return rows.results;
}
