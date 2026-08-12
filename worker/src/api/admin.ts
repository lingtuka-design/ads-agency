import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../env";
import { ApiError, audit, nowIso } from "../utils";
import { requireAuth } from "../auth";
import { jsonBody, me, idParam } from "./helpers";
import type { AppBindings } from "./helpers";
import { notify } from "../services/notifications";
import { STAFF_ROLES, type PublisherStatus } from "@agency/shared";

export const adminRoutes = new Hono<AppBindings>();
adminRoutes.use("*", requireAuth);

adminRoutes.use("*", async (c, next) => {
  const user = c.get("user") as { role: string } | undefined;
  if (!user || user.role !== "admin") {
    throw new ApiError(403, "FORBIDDEN", "Admin access required.");
  }
  await next();
});

// ---------- Overview KPIs (spec Â§32) ----------

adminRoutes.get("/overview", async (c) => {
  const q = c.req.query();
  const period = q.period ?? "month";
  const dateFns: Record<string, string> = {
    day: `date(created_at) = date('now')`,
    week: `created_at >= datetime('now', '-7 days')`,
    month: `created_at >= datetime('now', '-30 days')`,
    year: `created_at >= datetime('now', '-365 days')`,
  };
  const since = dateFns[period] ?? dateFns.month;
  const disputesSince = dateFns[period] ?? dateFns.month;

  const [
    counts,
    revenue,
    bookings,
    settlements,
    disputes,
    chartMonthly,
    topPublishers,
  ] = await Promise.all([
    c.env.DB.prepare(
      `SELECT
        (SELECT COUNT(*) FROM users WHERE role = 'advertiser') AS advertisers,
        (SELECT COUNT(*) FROM users WHERE role = 'publisher') AS publishers,
        (SELECT COUNT(*) FROM campaigns) AS campaigns,
        (SELECT COUNT(*) FROM bookings WHERE status IN ('LIVE','SCHEDULED','PUBLISHER_APPROVED','SENT_TO_PUBLISHER','CREATIVE_APPROVED','CREATIVE_REQUIRED','UNDER_REVIEW','PAID')) AS active_campaigns,
        (SELECT COUNT(*) FROM bookings WHERE status = 'PENDING_PAYMENT') AS pending_bookings,
        (SELECT COUNT(*) FROM bookings WHERE status = 'COMPLETED') AS completed_campaigns,
        (SELECT COUNT(*) FROM creative_jobs WHERE status NOT IN ('DELIVERED','CANCELLED')) AS creative_requests,
        (SELECT COUNT(*) FROM disputes WHERE status IN ('OPEN','UNDER_REVIEW')) AS open_disputes,
        (SELECT COUNT(*) FROM payments WHERE status = 'FAILED') AS failed_payments`,
    ).first(),
    c.env.DB.prepare(
      `SELECT
        COALESCE(SUM(CASE WHEN ${since} AND status = 'SUCCESSFUL' THEN amount END), 0) AS revenue,
        COALESCE(SUM(CASE WHEN status = 'SUCCESSFUL' THEN amount END), 0) AS revenue_total,
        COALESCE(SUM(CASE WHEN ${since} AND status = 'SUCCESSFUL' THEN CAST(JSON_EXTRACT((SELECT finance FROM bookings b WHERE b.id = p.booking_id), '$.commissionAmount') AS REAL) END), 0) AS commission,
        COALESCE(SUM(CASE WHEN ${since} AND status = 'SUCCESSFUL' THEN CAST(JSON_EXTRACT((SELECT finance FROM bookings b WHERE b.id = p.booking_id), '$.publisherAmount') AS REAL) END), 0) AS publisher_payable
      FROM payments p`,
    ).first(),
    c.env.DB.prepare(
      `SELECT COUNT(*) AS n, COALESCE(SUM(amount), 0) AS gross FROM bookings WHERE ${since}`,
    ).first(),
    c.env.DB.prepare(
      `SELECT COALESCE(SUM(CASE WHEN status IN ('PENDING','APPROVED') THEN amount END), 0) AS pending,
              COALESCE(SUM(CASE WHEN status = 'PAID' THEN amount END), 0) AS paid
       FROM settlements`,
    ).first(),
    c.env.DB.prepare(
      `SELECT COUNT(*) AS n FROM disputes WHERE ${disputesSince}`,
    ).first(),
    c.env.DB.prepare(
      `SELECT substr(created_at, 1, 7) AS month,
              COUNT(*) AS bookings,
              COALESCE(SUM(amount), 0) AS revenue
       FROM bookings WHERE created_at >= datetime('now', '-11 months')
       GROUP BY month ORDER BY month ASC`,
    ).all(),
    c.env.DB.prepare(
      `SELECT pu.name, COUNT(b.id) AS bookings, COALESCE(SUM(b.amount), 0) AS revenue
       FROM bookings b JOIN publishers pu ON pu.id = b.publisher_id
       GROUP BY pu.id ORDER BY revenue DESC LIMIT 5`,
    ).all(),
  ]);

  return c.json({
    counts: counts ?? {},
    revenue: revenue ?? {},
    booking_volume: bookings ?? {},
    settlements: settlements ?? {},
    disputes: disputes?.n ?? 0,
    monthly: chartMonthly.results,
    top_publishers: topPublishers.results,
  });
});

// ---------- Publisher management (spec Â§33) ----------

const publisherDecisionSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED", "SUSPENDED", "ACTIVE", "INFO_REQUIRED", "PENDING"]),
  reason: z.string().max(1000).optional().nullable(),
  trust_level: z.enum(["REGISTERED", "VERIFIED", "PREMIUM", "FEATURED"]).optional(),
  featured: z.boolean().optional(),
});

adminRoutes.get("/publishers", async (c) => {
  const q = c.req.query();
  const page = Math.max(1, parseInt(q.page ?? "1", 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(q.pageSize ?? "25", 10) || 25));
  const offset = (page - 1) * pageSize;
  let where = "1=1";
  const params: unknown[] = [];
  if (q.status) {
    where = "status = ?";
    params.push(q.status);
  }
  if (q.q) {
    where += ` AND (name LIKE ? OR email LIKE ?)`;
    params.push(`%${q.q}%`, `%${q.q}%`);
  }
  const count = await c.env.DB.prepare(
    `SELECT COUNT(*) AS n FROM publishers p LEFT JOIN users u ON u.id = p.user_id WHERE ${where}`,
  )
    .bind(...params)
    .first<{ n: number }>();
  const rows = await c.env.DB.prepare(
    `SELECT p.id, p.name, p.slug, p.status, p.trust_level, p.verified, p.featured, p.joined_at, p.location, p.category,
            u.email, u.name AS owner_name, u.account_status,
            (SELECT COUNT(*) FROM ad_packages pk WHERE pk.publisher_id = p.id) AS package_count,
            (SELECT COUNT(*) FROM bookings b WHERE b.publisher_id = p.id) AS booking_count
     FROM publishers p LEFT JOIN users u ON u.id = p.user_id
     WHERE ${where} ORDER BY p.joined_at DESC LIMIT ? OFFSET ?`,
  )
    .bind(...params, pageSize, offset)
    .all();
  return c.json({ items: rows.results, total: count?.n ?? 0, page, pageSize });
});

adminRoutes.post("/publishers/:id/decision", async (c) => {
  const user = me(c);
  const publisherId = idParam(c);
  const input = await jsonBody(publisherDecisionSchema, c);
  const publisher = await c.env.DB.prepare(
    `SELECT p.*, u.id AS user_id FROM publishers p LEFT JOIN users u ON u.id = p.user_id WHERE p.id = ?`,
  )
    .bind(publisherId)
    .first<{ id: string; user_id: string | null; status: string; verified: number }>();
  if (!publisher) throw new ApiError(404, "PUBLISHER_NOT_FOUND", "Publisher not found.");

  const fields = ["status = ?", "rejected_reason = ?", "updated_at = ?"];
  const params: unknown[] = [input.status, input.reason ?? null, nowIso()];
  if (input.trust_level) {
    fields.push("trust_level = ?");
    params.push(input.trust_level);
  }
  if (input.trust_level === "VERIFIED" || input.trust_level === "PREMIUM" || input.trust_level === "FEATURED") {
    fields.push("verified = 1");
  }
  if (input.featured !== undefined) {
    fields.push("featured = ?");
    params.push(input.featured ? 1 : 0);
  }
  params.push(publisherId);
  await c.env.DB.prepare(`UPDATE publishers SET ${fields.join(", ")} WHERE id = ?`).bind(...params).run();

  await notify(c.env, [publisher.user_id], "SYSTEM", `Publisher ${input.status.toLowerCase()}`, input.reason ?? null, "/publisher/dashboard");
  await audit(c.env, {
    user_id: user.id,
    action: `PUBLISHER_${input.status}`,
    entity: "publisher",
    entity_id: publisherId,
    old_value: publisher.status,
    new_value: input.status,
  });
  return c.json({ ok: true });
});

// ---------- Advertisers ----------

adminRoutes.get("/advertisers", async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT a.id, a.company_name, a.industry, a.location, a.verified, a.created_at,
            u.email, u.name, u.account_status,
            (SELECT COUNT(*) FROM campaigns c WHERE c.advertiser_id = a.id) AS campaign_count,
            (SELECT COALESCE(SUM(p.amount), 0) FROM payments p WHERE p.advertiser_id = a.id AND p.status = 'SUCCESSFUL') AS total_spend
     FROM advertisers a JOIN users u ON u.id = a.user_id
     ORDER BY a.created_at DESC LIMIT 200`,
  ).all();
  return c.json(rows.results);
});

adminRoutes.post("/advertisers/:id/status", async (c) => {
  const user = me(c);
  const input = await jsonBody(
    z.object({ status: z.enum(["ACTIVE", "VERIFICATION_REQUIRED", "SUSPENDED", "BLOCKED", "PENDING"]) }),
    c,
  );
  const adv = await c.env.DB.prepare(`SELECT user_id FROM advertisers WHERE id = ?`)
    .bind(idParam(c))
    .first<{ user_id: string }>();
  if (!adv) throw new ApiError(404, "ADVERTISER_NOT_FOUND", "Advertiser not found.");
  await c.env.DB.prepare(`UPDATE users SET account_status = ?, updated_at = ? WHERE id = ?`)
    .bind(input.status, nowIso(), adv.user_id)
    .run();
  await audit(c.env, { user_id: user.id, action: `ADVERTISER_STATUS`, entity: "advertiser", entity_id: idParam(c), new_value: input.status });
  return c.json({ ok: true });
});

// ---------- Staff (spec Â§35) ----------

const staffSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(120),
  staff_role: z.enum(STAFF_ROLES),
  title: z.string().max(200).optional().nullable(),
  bio: z.string().max(2000).optional().nullable(),
  photo_url: z.string().max(500).optional().nullable(),
  password: z.string().min(8).max(200).optional(),
});

adminRoutes.get("/staff", async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT s.*, u.email, u.name, u.account_status FROM staff s JOIN users u ON u.id = s.user_id ORDER BY s.created_at ASC`,
  ).all();
  return c.json(rows.results);
});

adminRoutes.post("/staff", async (c) => {
  const user = me(c);
  const input = await jsonBody(staffSchema, c);
  const { hashPassword } = await import("../auth");
  const existing = await c.env.DB.prepare(`SELECT id FROM users WHERE email = ?`).bind(input.email.toLowerCase()).first();
  let userId = existing?.id as string | undefined;
  if (!userId) {
    userId = crypto.randomUUID();
    const passwordHash = await hashPassword(input.password ?? `${input.email.toLowerCase()}@ChangeMe123`);
    await c.env.DB.prepare(
      `INSERT INTO users (id, email, password_hash, name, role, account_status, must_change_password, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'admin', 'ACTIVE', 1, ?, ?)`,
    )
      .bind(userId, input.email.toLowerCase(), passwordHash, input.name, nowIso(), nowIso())
      .run();
  }
  await c.env.DB.prepare(
    `INSERT INTO staff (id, user_id, staff_role, title, bio, photo_url, active, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?)
     ON CONFLICT(user_id) DO UPDATE SET staff_role = excluded.staff_role, title = excluded.title, bio = excluded.bio, photo_url = excluded.photo_url`,
  )
    .bind(crypto.randomUUID(), userId, input.staff_role, input.title ?? null, input.bio ?? null, input.photo_url ?? null, nowIso())
    .run();
  await audit(c.env, { user_id: user.id, action: "STAFF_CREATE", entity: "staff", entity_id: userId, new_value: input.staff_role });
  return c.json({ ok: true, user_id: userId });
});

adminRoutes.patch("/staff/:id", async (c) => {
  const user = me(c);
  const input = await jsonBody(
    z.object({
      staff_role: z.enum(STAFF_ROLES).optional(),
      title: z.string().max(200).nullable().optional(),
      bio: z.string().max(2000).nullable().optional(),
      active: z.boolean().optional(),
    }),
    c,
  );
  const fields: string[] = [];
  const params: unknown[] = [];
  if (input.staff_role) {
    fields.push("staff_role = ?");
    params.push(input.staff_role);
  }
  if (input.title !== undefined) {
    fields.push("title = ?");
    params.push(input.title);
  }
  if (input.bio !== undefined) {
    fields.push("bio = ?");
    params.push(input.bio);
  }
  if (input.active !== undefined) {
    fields.push("active = ?");
    params.push(input.active ? 1 : 0);
  }
  if (fields.length === 0) return c.json({ ok: true });
  params.push(idParam(c));
  await c.env.DB.prepare(`UPDATE staff SET ${fields.join(", ")} WHERE user_id = ?`).bind(...params).run();
  await audit(c.env, { user_id: user.id, action: "STAFF_UPDATE", entity: "staff", entity_id: idParam(c) });
  return c.json({ ok: true });
});

// ---------- Settings + commission engine (spec Â§19) ----------

const settingSchema = z.object({
  key: z.string().max(200),
  value: z.string().max(4000),
});

adminRoutes.get("/settings", async (c) => {
  const rows = await c.env.DB.prepare(`SELECT key, value FROM system_settings ORDER BY key ASC`).all();
  const cms = await c.env.DB.prepare(`SELECT key, content FROM cms_content ORDER BY key ASC`).all();
  return c.json({ settings: rows.results, cms: cms.results });
});

adminRoutes.post("/settings", async (c) => {
  const user = me(c);
  const input = await jsonBody(settingSchema, c);
  if (!/^[a-z0-9._-]{1,200}$/.test(input.key)) {
    throw new ApiError(400, "INVALID_KEY", "Invalid setting key.");
  }
  await c.env.DB.prepare(
    `INSERT INTO system_settings (key, value, updated_by, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_by = excluded.updated_by, updated_at = excluded.updated_at`,
  )
    .bind(input.key, input.value, user.id, nowIso())
    .run();
  await audit(c.env, { user_id: user.id, action: "SETTING_UPDATE", entity: "system_settings", entity_id: input.key, new_value: input.value.slice(0, 200) });
  return c.json({ ok: true });
});

adminRoutes.post("/cms", async (c) => {
  const user = me(c);
  const input = await jsonBody(
    z.object({ key: z.string().min(1).max(200), content: z.unknown() }),
    c,
  );
  if (!/^[a-z0-9._-]{1,200}$/.test(input.key)) {
    throw new ApiError(400, "INVALID_KEY", "Invalid CMS key.");
  }
  await c.env.DB.prepare(
    `INSERT INTO cms_content (key, content, updated_by, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET content = excluded.content, updated_by = excluded.updated_by, updated_at = excluded.updated_at`,
  )
    .bind(input.key, JSON.stringify(input.content), user.id, nowIso())
    .run();
  await audit(c.env, { user_id: user.id, action: "CMS_UPDATE", entity: "cms_content", entity_id: input.key });
  return c.json({ ok: true });
});

// ---------- Audit logs (spec Â§58) ----------

adminRoutes.get("/audit-logs", async (c) => {
  const q = c.req.query();
  const page = Math.max(1, parseInt(q.page ?? "1", 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(q.pageSize ?? "50", 10) || 50));
  const offset = (page - 1) * pageSize;
  let where = "1=1";
  const params: unknown[] = [];
  if (q.action) {
    where = "action = ?";
    params.push(q.action);
  }
  if (q.entity) {
    where = "entity = ?";
    params.push(q.entity);
  }
  const count = await c.env.DB.prepare(`SELECT COUNT(*) AS n FROM audit_logs WHERE ${where}`)
    .bind(...params)
    .first<{ n: number }>();
  const rows = await c.env.DB.prepare(
    `SELECT a.*, u.email AS user_email FROM audit_logs a
     LEFT JOIN users u ON u.id = a.user_id
     WHERE ${where} ORDER BY a.created_at DESC LIMIT ? OFFSET ?`,
  )
    .bind(...params, pageSize, offset)
    .all();
  return c.json({ items: rows.results, total: count?.n ?? 0, page, pageSize });
});

// ---------- Creative job assignment (spec §16) ----------

adminRoutes.post("/creative-jobs/:id/assign", async (c) => {
  const user = me(c);
  const input = await jsonBody(z.object({ assigned_to: z.string().max(64).nullable() }), c);
  const job = await c.env.DB.prepare(`SELECT id FROM creative_jobs WHERE id = ?`)
    .bind(idParam(c))
    .first<{ id: string }>();
  if (!job) throw new ApiError(404, "JOB_NOT_FOUND", "Design request not found.");
  await c.env.DB.prepare(
    `UPDATE creative_jobs SET assigned_to = ?, status = CASE WHEN status = 'NEW_REQUEST' THEN 'ASSIGNED' ELSE status END, updated_at = ? WHERE id = ?`,
  )
    .bind(input.assigned_to, nowIso(), job.id)
    .run();
  if (input.assigned_to) {
    await notify(c.env, [input.assigned_to], "SYSTEM", "Design job assigned", "A new design request has been assigned to you.", "/admin/creative-studio");
  }
  await audit(c.env, { user_id: user.id, action: "CREATIVE_JOB_ASSIGN", entity: "creative_job", entity_id: job.id, new_value: input.assigned_to ?? "unassigned" });
  return c.json({ ok: true });
});

// ---------- Publisher payable (for settlement creation) ----------

adminRoutes.get("/payable/:id", async (c) => {
  const publisherId = idParam(c);
  const rows = await c.env.DB.prepare(
    `SELECT b.id AS booking_id, CAST(JSON_EXTRACT(b.finance, '$.publisherAmount') AS REAL) AS amount
     FROM bookings b JOIN payments p ON p.booking_id = b.id
     WHERE b.publisher_id = ? AND p.status = 'SUCCESSFUL'
       AND b.id NOT IN (SELECT booking_id FROM settlement_items)
     ORDER BY p.paid_at ASC`,
  )
    .bind(publisherId)
    .all();
  return c.json(rows.results);
});

// ---------- Reports / CSV export (spec §67) ----------

adminRoutes.get("/reports/:type.csv", async (c) => {
  const type = (c.req.param("type.csv") ?? c.req.param("type") ?? "").replace(/\.csv$/, "");
  let rows: unknown[] = [];
  if (type === "revenue") {
    rows = (
      await c.env.DB.prepare(
        `SELECT p.created_at AS date, p.amount, p.currency, p.status, b.id AS booking_id,
                CAST(JSON_EXTRACT(b.finance, '$.commissionAmount') AS REAL) AS commission,
                CAST(JSON_EXTRACT(b.finance, '$.publisherAmount') AS REAL) AS publisher_amount
         FROM payments p JOIN bookings b ON b.id = p.booking_id ORDER BY p.created_at DESC`,
      ).all()
    ).results;
  } else if (type === "bookings") {
    rows = (
      await c.env.DB.prepare(
        `SELECT b.id, b.status, b.amount, b.currency, b.created_at, b.scheduled_start, b.scheduled_end,
                c.name AS campaign_name, pu.name AS publisher_name
         FROM bookings b JOIN campaigns c ON c.id = b.campaign_id JOIN publishers pu ON pu.id = b.publisher_id
         ORDER BY b.created_at DESC`,
      ).all()
    ).results;
  } else if (type === "publishers") {
    rows = (
      await c.env.DB.prepare(
        `SELECT p.id, p.name, p.status, p.trust_level, p.verified, p.joined_at,
                (SELECT COUNT(*) FROM bookings b WHERE b.publisher_id = p.id) AS bookings,
                (SELECT COALESCE(SUM(b.amount), 0) FROM bookings b WHERE b.publisher_id = p.id) AS revenue
         FROM publishers p ORDER BY revenue DESC`,
      ).all()
    ).results;
  } else if (type === "settlements") {
    rows = (
      await c.env.DB.prepare(
        `SELECT s.id, s.status, s.amount, s.currency, s.method, s.payout_ref, s.paid_at, s.created_at, pu.name AS publisher_name
         FROM settlements s JOIN publishers pu ON pu.id = s.publisher_id ORDER BY s.created_at DESC`,
      ).all()
    ).results;
  } else if (type === "advertisers") {
    rows = (
      await c.env.DB.prepare(
        `SELECT a.id, a.company_name, a.industry, a.location, a.created_at,
                (SELECT COALESCE(SUM(p.amount), 0) FROM payments p WHERE p.advertiser_id = a.id AND p.status = 'SUCCESSFUL') AS spend
         FROM advertisers a ORDER BY spend DESC`,
      ).all()
    ).results;
  } else {
    throw new ApiError(404, "NOT_FOUND", "Unknown report type.");
  }

  const headers = rows.length ? Object.keys(rows[0] as Record<string, unknown>) : [];
  const escape = (v: unknown) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => escape((r as Record<string, unknown>)[h])).join(","))].join("\n");
  c.header("Content-Type", "text/csv; charset=utf-8");
  c.header("Content-Disposition", `attachment; filename="${type}-${new Date().toISOString().slice(0, 10)}.csv"`);
  return c.body(csv);
});

adminRoutes.get("/analytics", async (c) => {
  const [platforms, avgBooking, advertisers, publishers] = await Promise.all([
    c.env.DB.prepare(
      `SELECT pk.platform, COUNT(*) AS n, COALESCE(SUM(b.amount), 0) AS revenue
       FROM bookings b JOIN ad_packages pk ON pk.id = b.package_id GROUP BY pk.platform ORDER BY revenue DESC`,
    ).all(),
    c.env.DB.prepare(`SELECT COALESCE(AVG(amount), 0) AS avg FROM bookings WHERE status != 'DRAFT'`).first(),
    c.env.DB.prepare(
      `SELECT substr(created_at, 1, 7) AS month, COUNT(*) AS n FROM advertisers GROUP BY month ORDER BY month DESC LIMIT 12`,
    ).all(),
    c.env.DB.prepare(
      `SELECT substr(joined_at, 1, 7) AS month, COUNT(*) AS n FROM publishers GROUP BY month ORDER BY month DESC LIMIT 12`,
    ).all(),
  ]);
  return c.json({ platforms: platforms.results, avg_booking: avgBooking?.avg ?? 0, advertisers: advertisers.results, publishers: publishers.results });
});
