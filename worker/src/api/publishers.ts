import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../env";
import { ApiError, audit, parseJsonSafe, paging, paginated } from "../utils";
import { requireAuth } from "../auth";
import { jsonBody, me } from "./helpers";
import type { AppBindings } from "./helpers";
import { computeInventory, inventoryStatus, slugify, type MediaType } from "@agency/shared";

const profileSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  category: z.string().max(100).optional().nullable(),
  location: z.string().max(200).optional().nullable(),
  website_url: z.string().max(300).optional().nullable(),
  contact_email: z.string().max(200).optional().nullable(),
  contact_phone: z.string().max(30).optional().nullable(),
  social_links: z.record(z.string()).optional().nullable(),
  about: z.string().max(5000).optional().nullable(),
  advertising_policies: z.string().max(3000).optional().nullable(),
  logo_url: z.string().max(500).optional().nullable(),
  cover_url: z.string().max(500).optional().nullable(),
});

const statsSchema = z.object({
  platform: z.enum(["INSTAGRAM", "FACEBOOK", "YOUTUBE", "WEBSITE", "NEWSPAPER", "TELEVISION", "RADIO", "DIGITAL_MAGAZINE", "OUTDOOR", "OTHER"]),
  platform_url: z.string().max(300).optional().nullable(),
  followers: z.number().int().min(0).optional(),
  subscribers: z.number().int().min(0).optional().nullable(),
  monthly_visitors: z.number().int().min(0).optional().nullable(),
  monthly_page_views: z.number().int().min(0).optional().nullable(),
  avg_views: z.number().int().min(0).optional().nullable(),
  avg_reach: z.number().int().min(0).optional().nullable(),
  engagement_rate: z.number().min(0).max(100).optional().nullable(),
  avg_post_views: z.number().int().min(0).optional().nullable(),
  avg_story_views: z.number().int().min(0).optional().nullable(),
  avg_video_views: z.number().int().min(0).optional().nullable(),
  audience_location: z.string().max(200).optional().nullable(),
  audience_age_group: z.string().max(50).optional().nullable(),
  gender_distribution: z.record(z.number()).optional().nullable(),
  primary_age_group: z.string().max(50).optional().nullable(),
  extra_notes: z.string().max(2000).optional().nullable(),
});

const packageSchema = z.object({
  title: z.string().min(2).max(200),
  platform: z.enum(["INSTAGRAM", "FACEBOOK", "YOUTUBE", "WEBSITE", "NEWSPAPER", "TELEVISION", "RADIO", "DIGITAL_MAGAZINE", "OUTDOOR", "OTHER"]),
  description: z.string().max(3000).optional().nullable(),
  price: z.number().min(0),
  currency: z.string().max(10).default("INR"),
  quantity: z.number().int().min(1).default(1),
  duration_days: z.number().int().min(1).default(30),
  total_slots: z.number().int().min(1).default(1),
  availability_start: z.string().nullable().optional(),
  availability_end: z.string().nullable().optional(),
  blackout_dates: z.array(z.string()).optional().nullable(),
  daily_limit: z.number().int().min(1).nullable().optional(),
  monthly_limit: z.number().int().min(1).nullable().optional(),
  creative_specs: z.record(z.unknown()).optional().nullable(),
  requirements: z.string().max(3000).optional().nullable(),
  is_active: z.boolean().optional(),
});

const payoutSchema = z.object({
  account_holder: z.string().max(200).optional().nullable(),
  bank_name: z.string().max(200).optional().nullable(),
  account_number: z.string().max(50).optional().nullable(),
  ifsc: z.string().max(20).optional().nullable(),
  upi: z.string().max(200).optional().nullable(),
});

export const publisherRoutes = new Hono<AppBindings>();
publisherRoutes.use("*", requireAuth);

function ownPublisher(c: ReturnType<typeof me> & { publisherId?: string | null }) {
  if (!c.publisherId) {
    throw new ApiError(403, "NO_PUBLISHER", "You are not registered as a publisher.");
  }
  return c.publisherId;
}

publisherRoutes.get("/me", async (c) => {
  const user = me(c);
  if (user.role !== "publisher") throw new ApiError(403, "FORBIDDEN", "Not a publisher account.");
  const publisher = await c.env.DB.prepare(
    `SELECT * FROM publishers WHERE user_id = ?`,
  )
    .bind(user.id)
    .first();
  if (!publisher) throw new ApiError(404, "NOT_FOUND", "Publisher profile not found.");
  const stats = await c.env.DB.prepare(`SELECT * FROM publisher_stats WHERE publisher_id = ?`)
    .bind(publisher.id)
    .first();
  const payout = await c.env.DB.prepare(
    `SELECT account_holder, bank_name, ifsc, upi, (account_number IS NOT NULL AND account_number != '') AS has_account_number
     FROM publisher_payout_info WHERE publisher_id = ?`,
  )
    .bind(publisher.id)
    .first();
  return c.json({ publisher, stats, payout });
});

publisherRoutes.patch("/me", async (c) => {
  const user = me(c);
  const input = await jsonBody(profileSchema, c);
  const publisher = await c.env.DB.prepare(`SELECT id, slug FROM publishers WHERE user_id = ?`)
    .bind(user.id)
    .first<{ id: string; slug: string }>();
  if (!publisher) throw new ApiError(404, "NOT_FOUND", "Publisher profile not found.");

  const fields: string[] = [];
  const params: unknown[] = [];
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;
    fields.push(`${key} = ?`);
    params.push(value === null || value === "" ? null : typeof value === "object" ? JSON.stringify(value) : value);
  }
  if (input.name) {
    let slug = slugify(input.name);
    const clash = await c.env.DB.prepare(`SELECT id FROM publishers WHERE slug = ? AND id != ?`)
      .bind(slug, publisher.id)
      .first();
    if (clash) slug = `${slug}-${publisher.id.slice(-6)}`;
    fields.push(`slug = ?`);
    params.push(slug);
  }
  if (fields.length === 0) return c.json({ ok: true });
  params.push(new Date().toISOString(), publisher.id);
  await c.env.DB.prepare(`UPDATE publishers SET ${fields.join(", ")}, updated_at = ? WHERE id = ?`)
    .bind(...params)
    .run();
  await audit(c.env, { user_id: user.id, action: "PUBLISHER_UPDATE", entity: "publisher", entity_id: publisher.id });
  return c.json({ ok: true });
});

publisherRoutes.put("/me/stats", async (c) => {
  const user = me(c);
  const input = await jsonBody(statsSchema, c);
  const publisher = await c.env.DB.prepare(`SELECT id FROM publishers WHERE user_id = ?`)
    .bind(user.id)
    .first<{ id: string }>();
  if (!publisher) throw new ApiError(404, "NOT_FOUND", "Publisher profile not found.");

  const existing = await c.env.DB.prepare(`SELECT id FROM publisher_stats WHERE publisher_id = ?`)
    .bind(publisher.id)
    .first<{ id: string }>();
  const ts = new Date().toISOString();
  const values: (string | number | null)[] = [
    input.platform,
    input.platform_url ?? null,
    input.followers ?? 0,
    input.subscribers ?? null,
    input.monthly_visitors ?? null,
    input.monthly_page_views ?? null,
    input.avg_views ?? null,
    input.avg_reach ?? null,
    input.engagement_rate ?? null,
    input.avg_post_views ?? null,
    input.avg_story_views ?? null,
    input.avg_video_views ?? null,
    input.audience_location ?? null,
    input.audience_age_group ?? null,
    input.gender_distribution ? JSON.stringify(input.gender_distribution) : null,
    input.primary_age_group ?? null,
    input.extra_notes ?? null,
    ts,
  ];
  if (existing) {
    await c.env.DB.prepare(
      `UPDATE publisher_stats SET platform = ?, platform_url = ?, followers = ?, subscribers = ?, monthly_visitors = ?,
       monthly_page_views = ?, avg_views = ?, avg_reach = ?, engagement_rate = ?, avg_post_views = ?,
       avg_story_views = ?, avg_video_views = ?, audience_location = ?, audience_age_group = ?,
       gender_distribution = ?, primary_age_group = ?, extra_notes = ?, updated_at = ? WHERE publisher_id = ?`,
    )
      .bind(...values, publisher.id)
      .run();
  } else {
    await c.env.DB.prepare(
      `INSERT INTO publisher_stats (id, publisher_id, platform, platform_url, followers, subscribers, monthly_visitors,
       monthly_page_views, avg_views, avg_reach, engagement_rate, avg_post_views, avg_story_views, avg_video_views,
       audience_location, audience_age_group, gender_distribution, primary_age_group, extra_notes, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(crypto.randomUUID(), publisher.id, ...values)
      .run();
  }
  await audit(c.env, { user_id: user.id, action: "PUBLISHER_STATS_UPDATE", entity: "publisher", entity_id: publisher.id });
  return c.json({ ok: true });
});

publisherRoutes.get("/me/packages", async (c) => {
  const user = me(c);
  const publisher = await c.env.DB.prepare(`SELECT id FROM publishers WHERE user_id = ?`)
    .bind(user.id)
    .first<{ id: string }>();
  if (!publisher) throw new ApiError(404, "NOT_FOUND", "Publisher profile not found.");
  const rows = await c.env.DB.prepare(
    `SELECT *, (total_slots - booked_slots - reserved_slots) AS available_slots FROM ad_packages
     WHERE publisher_id = ? ORDER BY created_at DESC`,
  )
    .bind(publisher.id)
    .all();
  return c.json(rows.results);
});

publisherRoutes.post("/me/packages", async (c) => {
  const user = me(c);
  const input = await jsonBody(packageSchema, c);
  const publisher = await c.env.DB.prepare(`SELECT id, status FROM publishers WHERE user_id = ?`)
    .bind(user.id)
    .first<{ id: string; status: string }>();
  if (!publisher) throw new ApiError(404, "NOT_FOUND", "Publisher profile not found.");
  if (!["APPROVED", "ACTIVE"].includes(publisher.status)) {
    throw new ApiError(403, "PUBLISHER_NOT_APPROVED", "Your publisher account must be approved before adding packages.");
  }
  const id = crypto.randomUUID();
  const ts = new Date().toISOString();
  await c.env.DB.prepare(
    `INSERT INTO ad_packages (id, publisher_id, title, platform, description, price, currency, quantity,
     duration_days, total_slots, availability_start, availability_end, blackout_dates, daily_limit, monthly_limit,
     creative_specs, requirements, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      publisher.id,
      input.title,
      input.platform,
      input.description ?? null,
      input.price,
      input.currency,
      input.quantity,
      input.duration_days,
      input.total_slots,
      input.availability_start ?? null,
      input.availability_end ?? null,
      input.blackout_dates ? JSON.stringify(input.blackout_dates) : null,
      input.daily_limit ?? null,
      input.monthly_limit ?? null,
      input.creative_specs ? JSON.stringify(input.creative_specs) : null,
      input.requirements ?? null,
      input.is_active === false ? 0 : 1,
      ts,
      ts,
    )
    .run();
  await audit(c.env, { user_id: user.id, action: "PACKAGE_CREATE", entity: "ad_packages", entity_id: id, new_value: JSON.stringify({ title: input.title, price: input.price }) });
  return c.json({ ok: true, id });
});

publisherRoutes.patch("/me/packages/:id", async (c) => {
  const user = me(c);
  const input = await jsonBody(packageSchema.partial(), c);
  const pkg = await c.env.DB.prepare(`SELECT * FROM ad_packages WHERE id = ? AND publisher_id = (SELECT id FROM publishers WHERE user_id = ?)`)
    .bind(c.req.param("id"), user.id)
    .first<{ id: string }>();
  if (!pkg) throw new ApiError(404, "NOT_FOUND", "Package not found.");
  const fields: string[] = [];
  const params: unknown[] = [];
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;
    fields.push(`${key} = ?`);
    params.push(
      value === null ? null : typeof value === "boolean" ? (value ? 1 : 0) : typeof value === "object" ? JSON.stringify(value) : value,
    );
  }
  params.push(new Date().toISOString(), pkg.id);
  await c.env.DB.prepare(`UPDATE ad_packages SET ${fields.join(", ")}, updated_at = ? WHERE id = ?`)
    .bind(...params)
    .run();
  await audit(c.env, { user_id: user.id, action: "PACKAGE_UPDATE", entity: "ad_packages", entity_id: pkg.id });
  return c.json({ ok: true });
});

publisherRoutes.delete("/me/packages/:id", async (c) => {
  const user = me(c);
  const pkg = await c.env.DB.prepare(`SELECT id FROM ad_packages WHERE id = ? AND publisher_id = (SELECT id FROM publishers WHERE user_id = ?)`)
    .bind(c.req.param("id"), user.id)
    .first<{ id: string }>();
  if (!pkg) throw new ApiError(404, "NOT_FOUND", "Package not found.");
  const activeBookings = await c.env.DB.prepare(
    `SELECT id FROM bookings WHERE package_id = ? AND status IN ('PENDING_PAYMENT','PAID','UNDER_REVIEW','CREATIVE_REQUIRED','CREATIVE_APPROVED','SENT_TO_PUBLISHER','PUBLISHER_APPROVED','SCHEDULED','LIVE','PROOF_SUBMITTED')`,
  )
    .bind(pkg.id)
    .first();
  if (activeBookings) {
    throw new ApiError(409, "PACKAGE_HAS_BOOKINGS", "This package has active bookings and cannot be deleted. Deactivate it instead.");
  }
  await c.env.DB.prepare(`DELETE FROM ad_packages WHERE id = ?`).bind(pkg.id).run();
  await audit(c.env, { user_id: user.id, action: "PACKAGE_DELETE", entity: "ad_packages", entity_id: pkg.id });
  return c.json({ ok: true });
});

publisherRoutes.put("/me/payout", async (c) => {
  const user = me(c);
  const input = await jsonBody(payoutSchema, c);
  const publisher = await c.env.DB.prepare(`SELECT id FROM publishers WHERE user_id = ?`)
    .bind(user.id)
    .first<{ id: string }>();
  if (!publisher) throw new ApiError(404, "NOT_FOUND", "Publisher profile not found.");
  await c.env.DB.prepare(
    `INSERT INTO publisher_payout_info (id, publisher_id, account_holder, bank_name, account_number, ifsc, upi, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(publisher_id) DO UPDATE SET
       account_holder = excluded.account_holder, bank_name = excluded.bank_name,
       account_number = excluded.account_number, ifsc = excluded.ifsc, upi = excluded.upi, updated_at = excluded.updated_at`,
  )
    .bind(
      crypto.randomUUID(),
      publisher.id,
      input.account_holder ?? null,
      input.bank_name ?? null,
      input.account_number ?? null,
      input.ifsc ?? null,
      input.upi ?? null,
      new Date().toISOString(),
    )
    .run();
  await audit(c.env, { user_id: user.id, action: "PAYOUT_INFO_UPDATE", entity: "publisher", entity_id: publisher.id });
  return c.json({ ok: true });
});

publisherRoutes.get("/me/earnings", async (c) => {
  const user = me(c);
  const publisher = await c.env.DB.prepare(`SELECT id FROM publishers WHERE user_id = ?`)
    .bind(user.id)
    .first<{ id: string }>();
  if (!publisher) throw new ApiError(404, "NOT_FOUND", "Publisher profile not found.");

  const totals = await c.env.DB.prepare(
    `SELECT
       COALESCE(SUM(CASE WHEN b.status NOT IN ('CANCELLED','REFUNDED','DRAFT') AND p.status = 'SUCCESSFUL' THEN j.publisher_amount ELSE 0 END), 0) AS earned,
       COALESCE(SUM(CASE WHEN p.status = 'SUCCESSFUL' AND s.id IS NULL THEN j.publisher_amount ELSE 0 END), 0) AS pending,
       COALESCE(SUM(CASE WHEN p.status = 'SUCCESSFUL' AND s.id IS NOT NULL AND s.status IN ('PAID') THEN j.publisher_amount ELSE 0 END), 0) AS paid
     FROM bookings b
     JOIN payments p ON p.booking_id = b.id
     LEFT JOIN settlement_items si ON si.booking_id = b.id
     LEFT JOIN settlements s ON s.id = si.settlement_id
     JOIN (SELECT b2.id AS bid, CAST(JSON_EXTRACT(b2.finance, '$.publisherAmount') AS REAL) AS publisher_amount FROM bookings b2) j ON j.bid = b.id
     WHERE b.publisher_id = ?`,
  )
    .bind(publisher.id)
    .first<{ earned: number; pending: number; paid: number }>();

  const settlements = await c.env.DB.prepare(
    `SELECT s.*, COUNT(si.id) AS item_count FROM settlements s
     LEFT JOIN settlement_items si ON si.settlement_id = s.id
     WHERE s.publisher_id = ? GROUP BY s.id ORDER BY s.created_at DESC LIMIT 20`,
  )
    .bind(publisher.id)
    .all();
  return c.json({
    totals: { earned: totals?.earned ?? 0, pending: totals?.pending ?? 0, paid: totals?.paid ?? 0 },
    settlements: settlements.results,
  });
});

publisherRoutes.get("/me/bookings", async (c) => {
  const user = me(c);
  const publisher = await c.env.DB.prepare(`SELECT id FROM publishers WHERE user_id = ?`)
    .bind(user.id)
    .first<{ id: string }>();
  if (!publisher) throw new ApiError(404, "NOT_FOUND", "Publisher profile not found.");
  const q = c.req.query();
  const { page, pageSize, offset } = paging(new URLSearchParams(q));
  const where = `b.publisher_id = ?`;
  const params: unknown[] = [publisher.id];
  if (q.status) {
    params.push(q.status);
  }
  const count = await c.env.DB.prepare(
    `SELECT COUNT(*) AS n FROM bookings b WHERE ${where}`,
  )
    .bind(params[0])
    .first<{ n: number }>();
  const rows = await c.env.DB.prepare(
    `SELECT b.id, b.status, b.amount, b.currency, b.scheduled_start, b.scheduled_end, b.created_at,
            p.title AS package_title, c.name AS campaign_name, u.name AS advertiser_name,
            (SELECT COUNT(*) FROM creatives cr WHERE cr.booking_id = b.id) AS has_creative,
            (SELECT group_concat(slot_date || ' ' || COALESCE(slot_time, ''), ', ')
             FROM publication_slots ps WHERE ps.booking_id = b.id AND ps.status IN ('PROPOSED','APPROVED','ADJUSTED')
             ORDER BY ps.slot_date) AS pub_dates,
            (SELECT COUNT(*) FROM publication_slots ps WHERE ps.booking_id = b.id AND ps.status = 'PROPOSED') AS pending_dates
     FROM bookings b
     JOIN ad_packages p ON p.id = b.package_id
     JOIN campaigns c ON c.id = b.campaign_id
     JOIN users u ON u.id = (SELECT user_id FROM advertisers a WHERE a.id = b.advertiser_id)
     WHERE ${where} ORDER BY b.created_at DESC LIMIT ? OFFSET ?`,
  )
    .bind(...params, pageSize, offset)
    .all();
  return c.json(paginated(rows.results, count?.n ?? 0, page, pageSize));
});

publisherRoutes.get("/me/analytics", async (c) => {
  const user = me(c);
  const publisher = await c.env.DB.prepare(`SELECT id FROM publishers WHERE user_id = ?`)
    .bind(user.id)
    .first<{ id: string }>();
  if (!publisher) throw new ApiError(404, "NOT_FOUND", "Publisher profile not found.");
  const summary = await c.env.DB.prepare(
    `SELECT
       COUNT(*) AS booking_count,
       COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) AS completed_count,
       COALESCE(SUM(amount), 0) AS gross_value
     FROM bookings WHERE publisher_id = ?`,
  )
    .bind(publisher.id)
    .first();
  const byPackage = await c.env.DB.prepare(
    `SELECT p.title, COUNT(b.id) AS bookings, COALESCE(SUM(b.amount), 0) AS revenue
     FROM bookings b JOIN ad_packages p ON p.id = b.package_id
     WHERE b.publisher_id = ? GROUP BY p.id ORDER BY revenue DESC LIMIT 10`,
  )
    .bind(publisher.id)
    .all();
  const monthly = await c.env.DB.prepare(
    `SELECT substr(created_at, 1, 7) AS month, COUNT(*) AS bookings, COALESCE(SUM(amount), 0) AS revenue
     FROM bookings WHERE publisher_id = ? GROUP BY month ORDER BY month DESC LIMIT 12`,
  )
    .bind(publisher.id)
    .all();
  return c.json({ summary: summary ?? {}, byPackage: byPackage.results, monthly: monthly.results });
});
