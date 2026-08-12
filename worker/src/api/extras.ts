import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../env";
import { ApiError, audit, nowIso } from "../utils";
import { requireAuth } from "../auth";
import { jsonBody, me, idParam } from "./helpers";
import type { AppBindings } from "./helpers";
import { notify } from "../services/notifications";
import { loadBooking } from "../services/bookings";
import type { SessionUser } from "../env";
import { getProvider } from "../services/payments";

const favoriteSchema = z.object({
  publisher_id: z.string().min(4).max(64).nullable().optional(),
  package_id: z.string().min(4).max(64).nullable().optional(),
});

export const favoritesRoutes = new Hono<AppBindings>();
favoritesRoutes.use("*", requireAuth);

favoritesRoutes.get("/", async (c) => {
  const user = me(c);
  const rows = await c.env.DB.prepare(
    `SELECT f.id, f.publisher_id, f.package_id, f.created_at,
            pu.name AS publisher_name, pu.slug AS publisher_slug, pu.logo_url,
            pk.title AS package_title, pk.price AS package_price, pk.platform
     FROM favorites f
     LEFT JOIN publishers pu ON pu.id = f.publisher_id
     LEFT JOIN ad_packages pk ON pk.id = f.package_id
     WHERE f.user_id = ? ORDER BY f.created_at DESC`,
  )
    .bind(user.id)
    .all();
  return c.json(rows.results);
});

favoritesRoutes.post("/", async (c) => {
  const user = me(c);
  const input = await jsonBody(favoriteSchema, c);
  if (!input.publisher_id && !input.package_id) {
    throw new ApiError(400, "VALIDATION_ERROR", "Provide publisher_id or package_id.");
  }
  if (input.publisher_id) {
    const exists = await c.env.DB.prepare(`SELECT id FROM favorites WHERE user_id = ? AND publisher_id = ?`)
      .bind(user.id, input.publisher_id)
      .first();
    if (exists) return c.json({ ok: true, already: true });
    await c.env.DB.prepare(`INSERT INTO favorites (id, user_id, publisher_id, created_at) VALUES (?, ?, ?, ?)`)
      .bind(crypto.randomUUID(), user.id, input.publisher_id, nowIso())
      .run();
  } else {
    const exists = await c.env.DB.prepare(`SELECT id FROM favorites WHERE user_id = ? AND package_id = ?`)
      .bind(user.id, input.package_id)
      .first();
    if (exists) return c.json({ ok: true, already: true });
    await c.env.DB.prepare(`INSERT INTO favorites (id, user_id, package_id, created_at) VALUES (?, ?, ?, ?)`)
      .bind(crypto.randomUUID(), user.id, input.package_id, nowIso())
      .run();
  }
  return c.json({ ok: true });
});

favoritesRoutes.delete("/:id", async (c) => {
  const user = me(c);
  const res = await c.env.DB.prepare(`DELETE FROM favorites WHERE id = ? AND user_id = ?`)
    .bind(idParam(c), user.id)
    .run();
  if (res.meta.changes === 0) throw new ApiError(404, "NOT_FOUND", "Favorite not found.");
  return c.json({ ok: true });
});

// ---------- Notifications ----------

export const notificationRoutes = new Hono<AppBindings>();
notificationRoutes.use("*", requireAuth);

notificationRoutes.get("/", async (c) => {
  const user = me(c);
  const rows = await c.env.DB.prepare(
    `SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`,
  )
    .bind(user.id)
    .all();
  const unread = await c.env.DB.prepare(`SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read = 0`)
    .bind(user.id)
    .first<{ n: number }>();
  return c.json({ items: rows.results, unread: unread?.n ?? 0 });
});

notificationRoutes.post("/read-all", async (c) => {
  const user = me(c);
  await c.env.DB.prepare(`UPDATE notifications SET read = 1 WHERE user_id = ?`).bind(user.id).run();
  return c.json({ ok: true });
});

notificationRoutes.post("/:id/read", async (c) => {
  const user = me(c);
  await c.env.DB.prepare(`UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?`)
    .bind(idParam(c), user.id)
    .run();
  return c.json({ ok: true });
});

// ---------- Invoices ----------

export const invoiceRoutes = new Hono<AppBindings>();
invoiceRoutes.use("*", requireAuth);

invoiceRoutes.get("/", async (c) => {
  const user = me(c);
  let where = "1=1";
  const params: unknown[] = [];
  if (user.role === "advertiser") {
    where = "i.advertiser_id = ?";
    params.push(user.advertiserId);
  } else if (user.role === "publisher") {
    where = "i.booking_id IN (SELECT id FROM bookings WHERE publisher_id = ?)";
    params.push(user.publisherId);
  }
  const rows = await c.env.DB.prepare(
    `SELECT i.id, i.number, i.payment_id, i.booking_id, i.amount, i.tax, i.total, i.currency, i.status, i.created_at,
            b.amount AS booking_amount, pk.title AS package_title, pu.name AS publisher_name
     FROM invoices i
     LEFT JOIN bookings b ON b.id = i.booking_id
     LEFT JOIN ad_packages pk ON pk.id = b.package_id
     LEFT JOIN publishers pu ON pu.id = b.publisher_id
     WHERE ${where} ORDER BY i.created_at DESC LIMIT 100`,
  )
    .bind(...params)
    .all();
  return c.json(rows.results);
});

invoiceRoutes.get("/:id", async (c) => {
  const user = me(c);
  const invoice = await c.env.DB.prepare(
    `SELECT i.*, b.amount AS booking_amount, b.finance, pk.title AS package_title, pk.platform,
            pu.name AS publisher_name, c.name AS campaign_name, u.name AS advertiser_name, u.email AS advertiser_email
     FROM invoices i
     LEFT JOIN bookings b ON b.id = i.booking_id
     LEFT JOIN ad_packages pk ON pk.id = b.package_id
     LEFT JOIN publishers pu ON pu.id = b.publisher_id
     LEFT JOIN campaigns c ON c.id = b.campaign_id
     LEFT JOIN advertisers a ON a.id = i.advertiser_id
     LEFT JOIN users u ON u.id = a.user_id
     WHERE i.id = ?`,
  )
    .bind(idParam(c))
    .first();
  if (!invoice) throw new ApiError(404, "INVOICE_NOT_FOUND", "Invoice not found.");
  if (user.role === "advertiser" && invoice.advertiser_id !== user.advertiserId) {
    throw new ApiError(403, "FORBIDDEN", "Not your invoice.");
  }
  return c.json({ invoice });
});

// ---------- Uploads (R2, signed URLs) ----------

const uploadInitSchema = z.object({
  file_name: z.string().min(1).max(300),
  mime_type: z.string().max(100),
  size: z.number().int().min(1).max(500 * 1024 * 1024),
});

export const uploadRoutes = new Hono<AppBindings>();
uploadRoutes.use("*", requireAuth);

uploadRoutes.get("/list", async (c) => {
  const user = me(c);
  const rows = await c.env.DB.prepare(
    `SELECT id, key, file_name, mime_type, size, created_at FROM uploads WHERE owner_id = ? ORDER BY created_at DESC LIMIT 100`,
  )
    .bind(user.id)
    .all();
  return c.json(rows.results);
});

uploadRoutes.post("/init", async (c) => {  const user = me(c);
  const input = await jsonBody(uploadInitSchema, c);
  const ext = input.file_name.split(".").pop()?.toLowerCase() ?? "bin";
  const key = `u/${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
  const uploadId = crypto.randomUUID();

  await c.env.DB.prepare(
    `INSERT INTO uploads (id, owner_id, bucket, key, file_name, mime_type, size, created_at)
     VALUES (?, ?, 'files', ?, ?, ?, ?, ?)`,
  )
    .bind(uploadId, user.id, key, input.file_name, input.mime_type, input.size, nowIso())
    .run();

  return c.json({
    ok: true,
    upload_id: uploadId,
    key,
    url: `https://upload.internal/${key}`,
    r2: { key, bucket: "files" },
  });
});

// Direct multipart upload to R2 (presigned URLs are not available in local dev)
uploadRoutes.post("/", async (c) => {
  const user = me(c);
  const form = await c.req.formData();
  const rawFile = form.get("file");
  const file = rawFile as unknown as File | null;
  if (!file || typeof file.arrayBuffer !== "function") throw new ApiError(400, "FILE_REQUIRED", "Upload a file.");
  const allowed = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf", "video/mp4", "video/quicktime"]);
  if (!allowed.has(file.type)) {
    throw new ApiError(400, "INVALID_FILE_TYPE", "This file type is not allowed.");
  }
  if (file.size > 100 * 1024 * 1024) {
    throw new ApiError(400, "FILE_TOO_LARGE", "File must be under 100MB.");
  }
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
  const key = `u/${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
  await c.env.FILES.put(key, file.stream(), {
    httpMetadata: { contentType: file.type },
    customMetadata: { fileName: file.name, mime: file.type },
  });
  await c.env.DB.prepare(
    `INSERT INTO uploads (id, owner_id, bucket, key, file_name, mime_type, size, created_at)
     VALUES (?, ?, 'files', ?, ?, ?, ?, ?)`,
  )
    .bind(crypto.randomUUID(), user.id, key, file.name, file.type, file.size, nowIso())
    .run();
  return c.json({
    ok: true,
    key,
    url: `/api/uploads/${key}`,
    file_name: file.name,
    size: file.size,
  });
});

uploadRoutes.get("/:key{.*}", async (c) => {
  const key = c.req.param("key");
  const user = c.get("user") as SessionUser | undefined;
  if (user) {
    const row = await c.env.DB.prepare(`SELECT owner_id FROM uploads WHERE key = ?`)
      .bind(key)
      .first<{ owner_id: string }>();
    if (row && row.owner_id !== user.id) {
      // Booking parties (advertiser/publisher) and admins may access creatives
      const party = await c.env.DB.prepare(
        `SELECT b.id FROM creative_versions cv
         JOIN creatives cr ON cr.id = cv.creative_id
         JOIN bookings b ON b.id = cr.booking_id
         WHERE instr(cv.file_url, ?) > 0`,
      )
        .bind(key)
        .first<{ id: string }>();
      if (!party) {
        const viaLinks = await c.env.DB.prepare(
          `SELECT b.id FROM creatives cr JOIN bookings b ON b.id = cr.booking_id
           WHERE instr(coalesce(cr.drive_links,''), ?) > 0`,
        )
          .bind(key)
          .first<{ id: string }>();
        const bookingParty = party ?? viaLinks;
        if (!bookingParty) throw new ApiError(403, "FORBIDDEN", "You do not have access to this file.");
        const booking = await loadBooking(c.env, bookingParty.id);
        if (!booking) throw new ApiError(403, "FORBIDDEN", "You do not have access to this file.");
        const allowed =
          user.role === "admin" ||
          (user.role === "advertiser" && booking.advertiser_id === user.advertiserId) ||
          (user.role === "publisher" && booking.publisher_id === user.publisherId);
        if (!allowed) throw new ApiError(403, "FORBIDDEN", "You do not have access to this file.");
      }
    }
  } else {
    throw new ApiError(401, "UNAUTHORIZED", "Please log in to access this file.");
  }
  const obj = await c.env.FILES.get(key);
  if (!obj) throw new ApiError(404, "FILE_NOT_FOUND", "File not found.");
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("Content-Type", obj.httpMetadata?.contentType ?? "application/octet-stream");
  headers.set("Cache-Control", "private, max-age=3600");
  return new Response(obj.body, { headers });
});

// ---------- Reviews ----------

export const reviewRoutes = new Hono<AppBindings>();
reviewRoutes.use("*", requireAuth);

const reviewSchema = z.object({
  booking_id: z.string().min(4).max(64),
  communication: z.number().int().min(1).max(5),
  reliability: z.number().int().min(1).max(5),
  execution: z.number().int().min(1).max(5),
  comment: z.string().max(2000).optional().nullable(),
});

reviewRoutes.post("/", async (c) => {
  const user = me(c);
  const input = await jsonBody(reviewSchema, c);
  if (user.role !== "advertiser") throw new ApiError(403, "FORBIDDEN", "Only advertisers can review.");
  const booking = await loadBooking(c.env, input.booking_id);
  if (!booking) throw new ApiError(404, "BOOKING_NOT_FOUND", "Booking not found.");
  if (booking.advertiser_id !== user.advertiserId) throw new ApiError(403, "FORBIDDEN", "Not your booking.");
  if (booking.status !== "COMPLETED") {
    throw new ApiError(409, "NOT_COMPLETED", "You can only review completed campaigns.");
  }
  const overall = Math.round((input.communication + input.reliability + input.execution) / 3);
  await c.env.DB.prepare(
    `INSERT INTO reviews (id, booking_id, advertiser_id, publisher_id, communication, reliability, execution, overall, comment, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(booking_id) DO UPDATE SET communication = excluded.communication, reliability = excluded.reliability,
       execution = excluded.execution, overall = excluded.overall, comment = excluded.comment`,
  )
    .bind(
      crypto.randomUUID(),
      booking.id,
      user.advertiserId,
      booking.publisher_id,
      input.communication,
      input.reliability,
      input.execution,
      overall,
      input.comment ?? null,
      nowIso(),
    )
    .run();
  await c.env.DB.prepare(
    `INSERT INTO publisher_reviews_aggregate (publisher_id, review_count, avg_communication, avg_reliability, avg_execution, avg_overall)
     SELECT publisher_id, COUNT(*), AVG(communication), AVG(reliability), AVG(execution), AVG(overall)
     FROM reviews WHERE publisher_id = ? AND moderated = 0
     ON CONFLICT(publisher_id) DO UPDATE SET
       review_count = excluded.review_count, avg_communication = excluded.avg_communication,
       avg_reliability = excluded.avg_reliability, avg_execution = excluded.avg_execution, avg_overall = excluded.avg_overall`,
  )
    .bind(booking.publisher_id)
    .run();
  return c.json({ ok: true });
});
