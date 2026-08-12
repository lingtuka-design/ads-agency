import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../env";
import { ApiError, audit, nowIso } from "../utils";
import { requireAuth } from "../auth";
import { jsonBody, me, idParam } from "./helpers";
import type { AppBindings } from "./helpers";
import { loadBooking, moveBooking, requireBookingActor } from "../services/bookings";
import { confirmBookingInventory, releaseBookedInventory, releaseReservation, reserveSlots } from "../services/inventory";
import { notify } from "../services/notifications";
import { loadCommissionConfig, calcForBooking } from "../services/commission";
import { BOOKING_STATUS, type BookingStatus } from "@agency/shared";

const campaignSchema = z.object({
  name: z.string().min(2).max(200),
  objective: z.string().max(500).optional().nullable(),
  product_service: z.string().max(500).optional().nullable(),
  target_audience: z.string().max(500).optional().nullable(),
  start_date: z.string(),
  end_date: z.string(),
});

const bookingSchema = z.object({
  campaign_id: z.string().min(4).max(64).optional(),
  campaign: campaignSchema.optional(),
  package_ids: z.array(z.string().min(4).max(64)).min(1).max(20),
  instructions: z.string().max(3000).optional().nullable(),
});

const transitionSchema = z.object({
  to: z.enum(BOOKING_STATUS),
  note: z.string().max(1000).optional().nullable(),
});

export const bookingRoutes = new Hono<AppBindings>();
bookingRoutes.use("*", requireAuth);

async function ensureAdvertiserId(c: Parameters<typeof me>[0]) {
  const user = me(c);
  if (user.role !== "advertiser") {
    throw new ApiError(403, "FORBIDDEN", "Only advertiser accounts can create bookings.");
  }
  if (!user.advertiserId) {
    const row = await c.env.DB.prepare(`SELECT id FROM advertisers WHERE user_id = ?`)
      .bind(user.id)
      .first<{ id: string }>();
    if (!row) throw new ApiError(403, "NO_ADVERTISER", "Advertiser profile missing.");
    return row.id;
  }
  return user.advertiserId;
}

// Create campaign (single or multi-package)
bookingRoutes.post("/campaigns", async (c) => {
  const user = me(c);
  const advertiserId = await ensureAdvertiserId(c);
  const input = await jsonBody(
    z.object({
      name: z.string().min(2).max(200),
      objective: z.string().max(500).optional().nullable(),
      product_service: z.string().max(500).optional().nullable(),
      target_audience: z.string().max(500).optional().nullable(),
      start_date: z.string(),
      end_date: z.string(),
      package_ids: z.array(z.string().min(4).max(64)).min(1).max(20),
      instructions: z.string().max(3000).optional().nullable(),
    }),
    c,
  );

  if (input.start_date > input.end_date) {
    throw new ApiError(400, "INVALID_DATES", "Campaign start date must be before end date.");
  }

  // Validate all packages exist, are active, and have inventory (reserve later, atomically per booking)
  const packageRows = [];
  for (const pid of input.package_ids) {
    const pkg = await c.env.DB.prepare(
      `SELECT id, publisher_id, title, price, currency, total_slots, booked_slots, reserved_slots
       FROM ad_packages WHERE id = ? AND is_active = 1`,
    )
      .bind(pid)
      .first<{ id: string; publisher_id: string; title: string; price: number; currency: string }>();
    if (!pkg) throw new ApiError(400, "PACKAGE_INVALID", "One or more packages are unavailable.");
    packageRows.push(pkg);
  }

  const campaignId = crypto.randomUUID();
  const ts = nowIso();
  const totalAmount = packageRows.reduce((s, p) => s + p.price, 0);
  await c.env.DB.prepare(
    `INSERT INTO campaigns (id, advertiser_id, name, objective, product_service, target_audience, start_date, end_date, status, total_amount, currency, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?, 'INR', ?, ?)`,
  )
    .bind(
      campaignId,
      advertiserId,
      input.name,
      input.objective ?? null,
      input.product_service ?? null,
      input.target_audience ?? null,
      input.start_date,
      input.end_date,
      totalAmount,
      ts,
      ts,
    )
    .run();

  await audit(c.env, { user_id: user.id, action: "CAMPAIGN_CREATE", entity: "campaign", entity_id: campaignId });
  return c.json({ ok: true, campaign_id: campaignId, totalAmount });
});

// Create booking on an existing campaign (or draft campaign)
bookingRoutes.post("/", async (c) => {
  const user = me(c);
  const advertiserId = await ensureAdvertiserId(c);
  const input = await jsonBody(bookingSchema, c);
  const ts = nowIso();

  let campaignId = input.campaign_id;
  if (!campaignId) {
    if (!input.campaign) throw new ApiError(400, "CAMPAIGN_REQUIRED", "Campaign details are required.");
    const camp = input.campaign;
    if (camp.start_date > camp.end_date) throw new ApiError(400, "INVALID_DATES", "Invalid campaign dates.");
    campaignId = crypto.randomUUID();
    await c.env.DB.prepare(
      `INSERT INTO campaigns (id, advertiser_id, name, objective, product_service, target_audience, start_date, end_date, status, total_amount, currency, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', 0, 'INR', ?, ?)`,
    )
      .bind(campaignId, advertiserId, camp.name, camp.objective ?? null, camp.product_service ?? null, camp.target_audience ?? null, camp.start_date, camp.end_date, ts, ts)
      .run();
  } else {
    const camp = await c.env.DB.prepare(`SELECT id, advertiser_id, status FROM campaigns WHERE id = ?`)
      .bind(campaignId)
      .first<{ id: string; advertiser_id: string; status: string }>();
    if (!camp) throw new ApiError(404, "CAMPAIGN_NOT_FOUND", "Campaign not found.");
    if (camp.advertiser_id !== advertiserId) {
      throw new ApiError(403, "FORBIDDEN", "You do not own this campaign.");
    }
  }

  const financeConfig = await loadCommissionConfig(c.env);
  const taxPercent = await c.env.DB.prepare(`SELECT value FROM system_settings WHERE key = 'commission.taxPercent'`)
    .first<{ value: string }>();

  const bookings = [];
  let grandTotal = 0;
  for (const pid of input.package_ids) {
    const pkg = await c.env.DB.prepare(
      `SELECT id, publisher_id, title, price, currency, total_slots, booked_slots, reserved_slots,
              availability_start, availability_end, blackout_dates
       FROM ad_packages WHERE id = ? AND is_active = 1`,
    )
      .bind(pid)
      .first<{
        id: string;
        publisher_id: string;
        title: string;
        price: number;
        currency: string;
        total_slots: number;
        booked_slots: number;
        reserved_slots: number;
        availability_start: string | null;
        availability_end: string | null;
        blackout_dates: string | null;
      }>();
    if (!pkg) throw new ApiError(400, "PACKAGE_INVALID", `Package ${pid} is unavailable.`);

    const inventory = await reserveSlots(c.env, pkg.id, 1);
    const finance = calcForBooking(financeConfig, {
      price: pkg.price,
      publisherId: pkg.publisher_id,
      packageId: pkg.id,
      campaignId,
      taxPercent: parseFloat(taxPercent?.value ?? "0"),
      currency: pkg.currency,
    });
    grandTotal += finance.grossAmount;

    const bookingId = crypto.randomUUID();
    await c.env.DB.prepare(
      `INSERT INTO bookings (id, campaign_id, package_id, publisher_id, advertiser_id, quantity, unit_price, amount, currency, status, instructions, finance, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, 'DRAFT', ?, ?, ?, ?)`,
    )
      .bind(bookingId, campaignId, pkg.id, pkg.publisher_id, advertiserId, pkg.price, finance.grossAmount, pkg.currency, input.instructions ?? null, JSON.stringify(finance), ts, ts)
      .run();
    await c.env.DB.prepare(
      `INSERT INTO booking_status_history (id, booking_id, from_status, to_status, actor_id) VALUES (?, ?, NULL, 'DRAFT', ?)`,
    )
      .bind(crypto.randomUUID(), bookingId, user.id)
      .run();
    bookings.push({ booking_id: bookingId, package_id: pkg.id, title: pkg.title, amount: finance.grossAmount });
  }

  await c.env.DB.prepare(`UPDATE campaigns SET total_amount = ?, updated_at = ? WHERE id = ?`)
    .bind(grandTotal, ts, campaignId)
    .run();

  await audit(c.env, {
    user_id: user.id,
    action: "BOOKING_CREATE",
    entity: "campaign",
    entity_id: campaignId,
    new_value: JSON.stringify(bookings),
  });
  return c.json({ ok: true, campaign_id: campaignId, bookings });
});

bookingRoutes.get("/campaigns/:id", async (c) => {
  const user = me(c);
  const campaignId = idParam(c);
  const campaign = await c.env.DB.prepare(
    `SELECT c.*, a.company_name FROM campaigns c LEFT JOIN advertisers a ON a.id = c.advertiser_id WHERE c.id = ?`,
  )
    .bind(campaignId)
    .first<{ id: string; advertiser_id: string }>();
  if (!campaign) throw new ApiError(404, "CAMPAIGN_NOT_FOUND", "Campaign not found.");
  if (user.role !== "admin" && campaign.advertiser_id !== user.advertiserId) {
    throw new ApiError(403, "FORBIDDEN", "You do not have access to this campaign.");
  }
  const bookings = await c.env.DB.prepare(
    `SELECT b.*, p.title AS package_title, p.platform, pu.name AS publisher_name, pu.slug AS publisher_slug
     FROM bookings b
     JOIN ad_packages p ON p.id = b.package_id
     JOIN publishers pu ON pu.id = b.publisher_id
     WHERE b.campaign_id = ? ORDER BY b.created_at ASC`,
  )
    .bind(campaignId)
    .all();
  return c.json({ campaign, bookings: bookings.results });
});

bookingRoutes.get("/campaigns", async (c) => {
  const user = me(c);
  if (user.role !== "advertiser") {
    throw new ApiError(403, "FORBIDDEN", "Only advertiser accounts have campaigns.");
  }
  const advertiserId = user.advertiserId ?? (await ensureAdvertiserId(c));
  const rows = await c.env.DB.prepare(
    `SELECT c.*, 
       (SELECT COUNT(*) FROM bookings b WHERE b.campaign_id = c.id) AS booking_count,
       (SELECT COUNT(*) FROM bookings b WHERE b.campaign_id = c.id AND b.status = 'COMPLETED') AS completed_count
     FROM campaigns c WHERE c.advertiser_id = ? ORDER BY c.created_at DESC`,
  )
    .bind(advertiserId)
    .all();
  return c.json(rows.results);
});

bookingRoutes.get("/", async (c) => {
  const user = me(c);
  let advertiserId: string | null = null;
  if (user.role === "advertiser") advertiserId = user.advertiserId ?? (await ensureAdvertiserId(c));
  const q = c.req.query();
  const page = Math.max(1, parseInt(q.page ?? "1", 10) || 1);
  const pageSize = Math.min(50, Math.max(1, parseInt(q.pageSize ?? "20", 10) || 20));
  const offset = (page - 1) * pageSize;

  let where = "1=1";
  const params: unknown[] = [];
  if (user.role === "advertiser" && advertiserId) {
    where = "b.advertiser_id = ?";
    params.push(advertiserId);
  } else if (user.role === "publisher") {
    if (!user.publisherId) throw new ApiError(403, "NO_PUBLISHER", "Publisher profile missing.");
    where = "b.publisher_id = ?";
    params.push(user.publisherId);
  } else if (user.role === "admin") {
    if (q.status) {
      where = "b.status = ?";
      params.push(q.status);
    }
  }
  if (user.role !== "admin" && q.status) {
    where += " AND b.status = ?";
    params.push(q.status);
  }
  const count = await c.env.DB.prepare(`SELECT COUNT(*) AS n FROM bookings b WHERE ${where}`)
    .bind(...params)
    .first<{ n: number }>();
  const rows = await c.env.DB.prepare(
    `SELECT b.id, b.status, b.amount, b.currency, b.quantity, b.created_at, b.scheduled_start, b.scheduled_end,
            p.title AS package_title, p.platform, pu.name AS publisher_name, pu.slug AS publisher_slug, pu.logo_url,
            c.name AS campaign_name, c.start_date, c.end_date,
            a.company_name, u.name AS advertiser_user_name
     FROM bookings b
     JOIN ad_packages p ON p.id = b.package_id
     JOIN publishers pu ON pu.id = b.publisher_id
     JOIN campaigns c ON c.id = b.campaign_id
     LEFT JOIN advertisers a ON a.id = b.advertiser_id
     LEFT JOIN users u ON u.id = (SELECT user_id FROM advertisers adv WHERE adv.id = b.advertiser_id)
     WHERE ${where} ORDER BY b.created_at DESC LIMIT ? OFFSET ?`,
  )
    .bind(...params, pageSize, offset)
    .all();
  return c.json({ items: rows.results, total: count?.n ?? 0, page, pageSize });
});

bookingRoutes.get("/:id", async (c) => {
  const user = me(c);
  const booking = await loadBooking(c.env, idParam(c));
  if (!booking) throw new ApiError(404, "BOOKING_NOT_FOUND", "Booking not found.");
  requireBookingActor(user, booking);
  const history = await c.env.DB.prepare(
    `SELECT h.*, u.name AS actor_name FROM booking_status_history h
     LEFT JOIN users u ON u.id = h.actor_id WHERE h.booking_id = ? ORDER BY h.created_at ASC`,
  )
    .bind(booking.id)
    .all();
  const creative = await c.env.DB.prepare(`SELECT * FROM creatives WHERE booking_id = ?`)
    .bind(booking.id)
    .first();
  const payment = await c.env.DB.prepare(
    `SELECT id, amount, status, method, provider, provider_ref, paid_at, created_at FROM payments WHERE booking_id = ? ORDER BY created_at DESC LIMIT 1`,
  )
    .bind(booking.id)
    .first();
  return c.json({ booking, history: history.results, creative, payment });
});

// Status transitions with role-specific guards (spec Â§73, Â§74)
bookingRoutes.post("/:id/transition", async (c) => {
  const user = me(c);
  const bookingId = idParam(c);
  const input = await jsonBody(transitionSchema, c);
  const booking = await loadBooking(c.env, bookingId);
  if (!booking) throw new ApiError(404, "BOOKING_NOT_FOUND", "Booking not found.");

  const target = input.to as BookingStatus;
  const allowedByRole = {
    advertiser: ["CANCELLED", "DISPUTED"],
    publisher: ["PUBLISHER_APPROVED", "LIVE", "PROOF_SUBMITTED", "COMPLETED", "SCHEDULED", "SENT_TO_PUBLISHER"],
    admin: BOOKING_STATUS as unknown as string[],
  }[user.role] as string[];

  requireBookingActor(user, booking);
  if (!allowedByRole.includes(target)) {
    throw new ApiError(403, "TRANSITION_FORBIDDEN", `This role cannot move a booking to ${target}.`);
  }

  const next = await c.env.DB.prepare(`SELECT status FROM bookings WHERE id = ?`).bind(bookingId).first<{ status: string }>();
  if (next?.status === "PENDING_PAYMENT" && target === "CANCELLED" && user.role === "advertiser") {
    await releaseReservation(c.env, booking.package_id, booking.quantity);
  }
  if (next?.status !== "PAID" && ["COMPLETED", "LIVE", "PROOF_SUBMITTED", "SCHEDULED"].includes(target)) {
    // Publication-related transitions require payment
    const pay = await c.env.DB.prepare(`SELECT status FROM payments WHERE booking_id = ? AND status = 'SUCCESSFUL' LIMIT 1`)
      .bind(bookingId)
      .first();
    if (!pay) throw new ApiError(409, "PAYMENT_REQUIRED", "Payment must be confirmed before publication steps.");
  }

  await moveBooking(c.env, bookingId, target, { actorId: user.id, note: input.note, ip: c.req.header("CF-Connecting-IP") });
  await notify(c.env, [booking.advertiser_id, booking.publisher_id], "SYSTEM", `Booking ${target.toLowerCase()}`, input.note ?? null, `/bookings/${bookingId}`);

  return c.json({ ok: true, status: target });
});

// Cancel with refund path: releases inventory only when not paid
bookingRoutes.post("/:id/cancel", async (c) => {
  const user = me(c);
  const bookingId = idParam(c);
  const booking = await loadBooking(c.env, bookingId);
  if (!booking) throw new ApiError(404, "BOOKING_NOT_FOUND", "Booking not found.");
  requireBookingActor(user, booking);
  if (user.role === "publisher") {
    throw new ApiError(403, "FORBIDDEN", "Publishers cannot cancel bookings directly; raise a dispute instead.");
  }
  const current = await c.env.DB.prepare(`SELECT status FROM bookings WHERE id = ?`)
    .bind(bookingId)
    .first<{ status: string }>();
  if (!current || !["DRAFT", "PENDING_PAYMENT", "PAID", "UNDER_REVIEW", "CREATIVE_REQUIRED", "CREATIVE_APPROVED", "SENT_TO_PUBLISHER", "PUBLISHER_APPROVED", "SCHEDULED", "LIVE", "PROOF_SUBMITTED"].includes(current.status)) {
    throw new ApiError(409, "INVALID_STATE", "This booking cannot be cancelled in its current state.");
  }
  await moveBooking(c.env, bookingId, "CANCELLED", { actorId: user.id, note: "Cancelled by " + user.role, ip: c.req.header("CF-Connecting-IP") });
  await releaseReservation(c.env, booking.package_id, booking.quantity);
  await releaseBookedInventory(c.env, booking.package_id, booking.quantity);
  await audit(c.env, { user_id: user.id, action: "BOOKING_CANCEL", entity: "booking", entity_id: bookingId });
  return c.json({ ok: true });
});
