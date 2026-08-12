import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../env";
import { ApiError, audit, nowIso } from "../utils";
import { requireAuth } from "../auth";
import { jsonBody, me, idParam, type AppBindings } from "./helpers";
import { loadBooking } from "../services/bookings";
import { getProvider } from "../services/payments";
import { confirmBookingInventory } from "../services/inventory";
import { notify } from "../services/notifications";

const checkoutSchema = z.object({
  booking_ids: z.array(z.string().min(4).max(64)).min(1).max(20),
  method: z.enum(["UPI", "CARD", "NET_BANKING", "WALLET", "MANUAL", "BANK_TRANSFER"]).optional(),
});

const confirmSchema = z.object({
  ref: z.string().min(4).max(100),
});

export const paymentRoutes = new Hono<AppBindings>();
paymentRoutes.use("/*", requireAuth);

function invoiceNumber(seq: number): string {
  const d = new Date();
  return `INV-${d.getFullYear()}-${String(seq).padStart(6, "0")}`;
}

async function nextInvoiceNumber(env: Env): Promise<string> {
  const row = await env.DB.prepare(`SELECT COUNT(*) AS n FROM invoices`).first<{ n: number }>();
  return invoiceNumber((row?.n ?? 0) + 1);
}

paymentRoutes.post("/checkout", async (c) => {
  const user = me(c);
  const input = await jsonBody(checkoutSchema, c);
  if (user.role !== "advertiser") throw new ApiError(403, "FORBIDDEN", "Only advertisers can pay.");
  const advertiserId = user.advertiserId;

  const bookings = [];
  let total = 0;
  for (const bid of input.booking_ids) {
    const booking = await c.env.DB.prepare(
      `SELECT id, advertiser_id, status, amount, currency, package_id, quantity, campaign_id
       FROM bookings WHERE id = ?`,
    )
      .bind(bid)
      .first<{
        id: string;
        advertiser_id: string;
        status: string;
        amount: number;
        currency: string;
        package_id: string;
        quantity: number;
        campaign_id: string;
      }>();
    if (!booking) throw new ApiError(404, "BOOKING_NOT_FOUND", "Booking not found.");
    if (booking.advertiser_id !== advertiserId) {
      throw new ApiError(403, "FORBIDDEN", "You do not own this booking.");
    }
    if (booking.status !== "DRAFT" && booking.status !== "PENDING_PAYMENT") {
      throw new ApiError(409, "BOOKING_NOT_PAYABLE", "This booking is no longer awaiting payment.");
    }
    const paid = await c.env.DB.prepare(`SELECT id FROM payments WHERE booking_id = ? AND status = 'SUCCESSFUL' LIMIT 1`)
      .bind(bid)
      .first();
    if (paid) throw new ApiError(409, "ALREADY_PAID", "This booking has already been paid.");
    bookings.push(booking);
    total += booking.amount;
  }

  // Single provider order for the whole checkout
  const provider = getProvider(c.env);
  const result = await provider.createPayment(c.env, {
    bookingId: bookings[0].id,
    amount: total,
    currency: bookings[0].currency,
    method: input.method ?? null,
    metadata: { bookingIds: input.booking_ids },
  });

  const paymentId = crypto.randomUUID();
  await c.env.DB.batch([
    ...bookings.map((b) =>
      c.env.DB.prepare(`UPDATE bookings SET status = 'PENDING_PAYMENT', updated_at = ? WHERE id = ?`)
        .bind(nowIso(), b.id),
    ),
    c.env.DB.prepare(
      `INSERT INTO payments (id, booking_id, advertiser_id, amount, currency, status, method, provider, provider_ref, provider_payload, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'INITIATED', ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        paymentId,
        bookings[0].id,
        advertiserId,
        total,
        bookings[0].currency,
        input.method ?? null,
        provider.name,
        result.providerRef,
        JSON.stringify({ bookingIds: input.booking_ids, ...result.clientPayload }),
        nowIso(),
        nowIso(),
      ),
    c.env.DB.prepare(
      `INSERT INTO payment_events (id, payment_id, event, payload) VALUES (?, ?, 'created', ?)`,
    ).bind(crypto.randomUUID(), paymentId, JSON.stringify({ providerRef: result.providerRef })),
  ]);

  await audit(c.env, {
    user_id: user.id,
    action: "PAYMENT_INITIATED",
    entity: "payment",
    entity_id: paymentId,
    new_value: JSON.stringify({ amount: total, provider: provider.name }),
  });
  await notify(c.env, [user.id], "SYSTEM", "Payment initiated", `₹${total} — complete your payment to confirm the booking.`, "/payments");

  return c.json({
    ok: true,
    payment_id: paymentId,
    amount: total,
    currency: bookings[0].currency,
    provider: provider.name,
    client_payload: result.clientPayload,
  });
});

// Manual / mock provider confirmation (used when PAYMENT_PROVIDER=manual)
paymentRoutes.post("/confirm", async (c) => {
  const user = me(c);
  const input = await jsonBody(confirmSchema, c);
  const payment = await findPaymentByRef(c.env, input.ref);
  if (!payment) throw new ApiError(404, "PAYMENT_NOT_FOUND", "Payment not found.");
  if (payment.advertiser_id !== user.advertiserId) {
    throw new ApiError(403, "FORBIDDEN", "You do not own this payment.");
  }
  if (payment.status === "SUCCESSFUL") return c.json({ ok: true, already: true });
  if (payment.status !== "INITIATED" && payment.status !== "PENDING") {
    throw new ApiError(409, "INVALID_PAYMENT_STATE", "This payment cannot be confirmed.");
  }
  const result = await finalizePayment(c.env, payment, "MANUAL", user.id);
  return c.json(result);
});

// Admin manual capture (test/failover path)
paymentRoutes.post("/admin-capture", async (c) => {
  const user = me(c);
  if (user.role !== "admin") throw new ApiError(403, "FORBIDDEN", "Admins only.");
  const input = await jsonBody(confirmSchema, c);
  const payment = await findPaymentByRef(c.env, input.ref);
  if (!payment) throw new ApiError(404, "PAYMENT_NOT_FOUND", "Payment not found.");
  if (payment.status === "SUCCESSFUL") return c.json({ ok: true, already: true });
  const result = await finalizePayment(c.env, payment, "ADMIN_CAPTURE", user.id);
  return c.json(result);
});

// Payment provider webhook endpoint — verified server-side (spec §18, §56)
paymentRoutes.post("/webhook/:provider", async (c) => {
  const providerName = c.req.param("provider");
  const provider = getProvider(c.env);
  if (provider.name !== providerName) {
    return c.json({ ok: false, error: "unknown provider" }, 404);
  }
  const body = await c.req.text();
  const result = await provider.handleWebhook(c.env, body, c.req.raw.headers);
  if (!result.ok) return c.json({ ok: false }, 401);
  // Locate payment by provider_ref embedded in the event payload
  let providerRef: string | null = null;
  try {
    const data = JSON.parse(body) as { payload?: { payment?: { id?: string }; order?: { id?: string } } };
    providerRef = data.payload?.payment?.id ?? data.payload?.order?.id ?? null;
  } catch {
    return c.json({ ok: false }, 400);
  }
  if (providerRef) {
    const payment = await findPaymentByRef(c.env, providerRef);
    if (payment && (payment.status === "INITIATED" || payment.status === "PENDING")) {
      await finalizePayment(c.env, payment, "WEBHOOK", null);
    }
  }
  return c.json({ ok: true });
});

paymentRoutes.get("/", async (c) => {
  const user = me(c);
  const page = Math.max(1, parseInt(c.req.query("page") ?? "1", 10) || 1);
  const pageSize = Math.min(50, Math.max(1, parseInt(c.req.query("pageSize") ?? "20", 10) || 20));
  const offset = (page - 1) * pageSize;
  let where = "1=1";
  const params: unknown[] = [];
  if (user.role === "advertiser") {
    where = "advertiser_id = ?";
    params.push(user.advertiserId);
  } else if (user.role === "publisher") {
    where = "booking_id IN (SELECT id FROM bookings WHERE publisher_id = ?)";
    params.push(user.publisherId);
  }
  if (c.req.query("status")) {
    where += " AND status = ?";
    params.push(c.req.query("status"));
  }
  const count = await c.env.DB.prepare(`SELECT COUNT(*) AS n FROM payments WHERE ${where}`)
    .bind(...params)
    .first<{ n: number }>();
  const rows = await c.env.DB.prepare(
    `SELECT p.id, p.amount, p.currency, p.status, p.method, p.provider, p.provider_ref, p.paid_at, p.created_at,
            b.id AS booking_id, pk.title AS package_title
     FROM payments p
     LEFT JOIN bookings b ON b.id = p.booking_id
     LEFT JOIN ad_packages pk ON pk.id = b.package_id
     WHERE ${where} ORDER BY p.created_at DESC LIMIT ? OFFSET ?`,
  )
    .bind(...params, pageSize, offset)
    .all();
  return c.json({ items: rows.results, total: count?.n ?? 0, page, pageSize });
});

paymentRoutes.get("/:id", async (c) => {
  const user = me(c);
  const payment = await c.env.DB.prepare(
    `SELECT p.*, b.publisher_id, pk.title AS package_title, c.name AS campaign_name
     FROM payments p
     LEFT JOIN bookings b ON b.id = p.booking_id
     LEFT JOIN ad_packages pk ON pk.id = b.package_id
     LEFT JOIN campaigns c ON c.id = b.campaign_id
     WHERE p.id = ?`,
  )
    .bind(idParam(c))
    .first<PaymentRow>();
  if (!payment) throw new ApiError(404, "PAYMENT_NOT_FOUND", "Payment not found.");
  if (user.role === "advertiser" && payment.advertiser_id !== user.advertiserId) {
    throw new ApiError(403, "FORBIDDEN", "You do not own this payment.");
  }
  if (user.role === "publisher" && payment.publisher_id !== user.publisherId) {
    throw new ApiError(403, "FORBIDDEN", "You do not have access to this payment.");
  }
  return c.json({ payment });
});

export interface PaymentRow {
  id: string;
  booking_id: string;
  advertiser_id: string;
  amount: number;
  currency: string;
  status: string;
  provider: string | null;
  provider_ref: string | null;
  method: string | null;
  invoice_id: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
  publisher_id?: string;
  package_title?: string;
  campaign_name?: string;
}

export async function findPaymentByRef(env: Env, ref: string): Promise<PaymentRow | null> {
  return env.DB.prepare(
    `SELECT * FROM payments WHERE provider_ref = ? ORDER BY created_at DESC LIMIT 1`,
  )
    .bind(ref)
    .first<PaymentRow>();
}

export interface FinalizeResult {
  ok: boolean;
  error?: string;
  booking_id?: string;
  invoice_created?: boolean;
}

/** Shared finalize: verify → record → confirm inventory → generate invoice → notify. */
export async function finalizePayment(
  env: Env,
  payment: PaymentRow,
  source: string,
  actorId: string | null,
): Promise<FinalizeResult> {
  // Server-side verification before marking success (spec §18)
  const provider = getProvider(env);
  let verified = false;
  if (payment.provider_ref && provider.name !== "manual" && provider.name !== "mock") {
    const res = await provider.verifyPayment(env, {
      providerRef: payment.provider_ref,
      amount: payment.amount,
      currency: payment.currency,
    });
    verified = res.success;
  } else {
    verified = true; // manual/mock provider is verified by user action
  }
  if (!verified) {
    await env.DB.prepare(`UPDATE payments SET status = 'FAILED', updated_at = ? WHERE id = ?`)
      .bind(nowIso(), payment.id)
      .run();
    await env.DB.prepare(`INSERT INTO payment_events (id, payment_id, event, payload) VALUES (?, ?, 'failed', ?)`)
      .bind(crypto.randomUUID(), payment.id, JSON.stringify({ source }))
      .run();
    await audit(env, { user_id: actorId, action: "PAYMENT_VERIFY_FAILED", entity: "payment", entity_id: payment.id });
    return { ok: false, error: "VERIFICATION_FAILED" };
  }

  const booking = await loadBooking(env, payment.booking_id);
  if (!booking) throw new ApiError(404, "BOOKING_NOT_FOUND", "Booking missing for payment.");

  const ts = nowIso();
  await env.DB.batch([
    env.DB.prepare(`UPDATE payments SET status = 'SUCCESSFUL', paid_at = ?, updated_at = ? WHERE id = ?`)
      .bind(ts, ts, payment.id),
    env.DB.prepare(`INSERT INTO payment_events (id, payment_id, event, payload) VALUES (?, ?, 'successful', ?)`)
      .bind(crypto.randomUUID(), payment.id, JSON.stringify({ source, at: ts })),
    env.DB.prepare(`UPDATE bookings SET status = 'PAID', updated_at = ? WHERE id = ?`)
      .bind(ts, booking.id),
    env.DB.prepare(
      `INSERT INTO booking_status_history (id, booking_id, from_status, to_status, actor_id, note) VALUES (?, ?, ?, 'PAID', ?, ?)`,
    )
      .bind(crypto.randomUUID(), booking.id, booking.status, actorId, "Payment confirmed"),
  ]);

  await confirmBookingInventory(env, booking.package_id, booking.quantity);
  await notify(env, [booking.advertiser_id, booking.publisher_id], "PAYMENT_SUCCESSFUL", "Payment received", `Your booking of ${booking.package_title} is confirmed.`, `/bookings/${booking.id}`);
  await audit(env, {
    user_id: actorId,
    action: "PAYMENT_SUCCESS",
    entity: "payment",
    entity_id: payment.id,
    new_value: JSON.stringify({ amount: payment.amount, booking: payment.booking_id, source }),
  });

  // Invoice generation
  try {
    const number = await nextInvoiceNumber(env);
    const finance = booking.finance ? (JSON.parse(booking.finance) as { grossAmount?: number; tax?: number }) : null;
    const invoiceId = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO invoices (id, number, payment_id, advertiser_id, booking_id, amount, tax, total, currency, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ISSUED', ?)`,
    )
      .bind(
        invoiceId,
        number,
        payment.id,
        payment.advertiser_id,
        booking.id,
        finance?.grossAmount ?? payment.amount,
        finance?.tax ?? 0,
        payment.amount,
        payment.currency,
        ts,
      )
      .run();
    await env.DB.prepare(`UPDATE payments SET invoice_id = ? WHERE id = ?`).bind(invoiceId, payment.id).run();
  } catch {
    // invoice failure must not roll back payment success
  }
  return { ok: true, booking_id: booking.id, invoice_created: true };
}
