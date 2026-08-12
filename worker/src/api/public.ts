import { Hono } from "hono";
import type { Env } from "../env";
import { paging, paginated } from "../utils";
import type { AppBindings } from "./helpers";

export const publicRoutes = new Hono<AppBindings>();

function publisherSelect(): string {
  return `
    SELECT p.id, p.name, p.slug, p.logo_url, p.cover_url, p.description, p.category, p.location,
           p.website_url, p.verified, p.trust_level, p.featured, p.joined_at,
           s.platform, s.platform_url, s.followers, s.subscribers, s.monthly_visitors,
           s.monthly_page_views, s.avg_reach, s.engagement_rate, s.audience_location,
           s.audience_age_group, s.primary_age_group, s.gender_distribution,
           (SELECT MIN(price) FROM ad_packages pk WHERE pk.publisher_id = p.id AND pk.is_active = 1
             AND (pk.total_slots - pk.booked_slots - pk.reserved_slots) > 0) AS starting_price,
           COALESCE(r.review_count, 0) AS review_count,
           COALESCE(r.avg_overall, 0) AS avg_rating
    FROM publishers p
    LEFT JOIN publisher_stats s ON s.publisher_id = p.id
    LEFT JOIN publisher_reviews_aggregate r ON r.publisher_id = p.id`;
}

function activeWhere(): string {
  return `WHERE p.status IN ('APPROVED','ACTIVE')`;
}

publicRoutes.get("/publishers", async (c) => {
  const q = c.req.query();
  const { page, pageSize, offset } = paging(new URLSearchParams(q));
  const clauses = [activeWhere()];
  const params: unknown[] = [];

  if (q.q) {
    clauses.push(`(p.name LIKE ? OR p.description LIKE ? OR p.category LIKE ? OR p.location LIKE ?)`);
    const like = `%${q.q}%`;
    params.push(like, like, like, like);
  }
  if (q.platform) {
    clauses.push(`s.platform = ?`);
    params.push(q.platform);
  }
  if (q.category) {
    clauses.push(`p.category = ?`);
    params.push(q.category);
  }
  if (q.location) {
    clauses.push(`LOWER(COALESCE(p.location, s.audience_location, '')) LIKE ?`);
    params.push(`%${q.location.toLowerCase()}%`);
  }
  if (q.minFollowers) {
    clauses.push(`COALESCE(s.followers, 0) >= ?`);
    params.push(parseInt(q.minFollowers, 10));
  }
  if (q.audienceAge) {
    clauses.push(`s.primary_age_group LIKE ?`);
    params.push(`%${q.audienceAge}%`);
  }
  if (q.verified === "1") {
    clauses.push(`p.verified = 1`);
  }
  if (q.featured === "1") {
    clauses.push(`p.featured = 1`);
  }
  if (q.available === "1") {
    clauses.push(`EXISTS (SELECT 1 FROM ad_packages pk WHERE pk.publisher_id = p.id AND pk.is_active = 1
      AND (pk.total_slots - pk.booked_slots - pk.reserved_slots) > 0)`);
  }
  if (q.maxPrice) {
    clauses.push(`EXISTS (SELECT 1 FROM ad_packages pk WHERE pk.publisher_id = p.id AND pk.is_active = 1 AND pk.price <= ?)`);
    params.push(parseFloat(q.maxPrice));
  }

  const sortMap: Record<string, string> = {
    recommended: `p.featured DESC, review_count DESC`,
    "price-asc": `starting_price ASC`,
    "price-desc": `starting_price DESC`,
    followers: `COALESCE(s.followers, 0) DESC`,
    reach: `COALESCE(s.avg_reach, 0) DESC`,
    engagement: `COALESCE(s.engagement_rate, 0) DESC`,
    popular: `review_count DESC`,
    newest: `p.joined_at DESC`,
  };
  const sort = sortMap[q.sort ?? "recommended"] ?? sortMap.recommended;

  const where = clauses.join(" AND ");
  const countRow = await c.env.DB.prepare(
    `SELECT COUNT(*) AS n FROM publishers p LEFT JOIN publisher_stats s ON s.publisher_id = p.id
     LEFT JOIN publisher_reviews_aggregate r ON r.publisher_id = p.id ${where}`,
  )
    .bind(...params)
    .first<{ n: number }>();
  const rows = await c.env.DB.prepare(
    `${publisherSelect()} ${where} ORDER BY ${sort} LIMIT ? OFFSET ?`,
  )
    .bind(...params, pageSize, offset)
    .all();
  return c.json(paginated(rows.results, countRow?.n ?? 0, page, pageSize));
});

publicRoutes.get("/publishers/:slug", async (c) => {
  const slug = c.req.param("slug");
  const publisher = await c.env.DB.prepare(
    `${publisherSelect()} WHERE p.slug = ? AND p.status IN ('APPROVED','ACTIVE')`,
  )
    .bind(slug)
    .first();
  if (!publisher) return c.json({ error: { code: "NOT_FOUND", message: "Publisher not found." } }, 404);
  const packages = await c.env.DB.prepare(
    `SELECT id, title, platform, description, price, currency, quantity, duration_days,
            total_slots, booked_slots, reserved_slots, (total_slots - booked_slots - reserved_slots) AS available_slots,
            availability_start, availability_end, blackout_dates, creative_specs, requirements, is_featured
     FROM ad_packages WHERE publisher_id = ? AND is_active = 1 ORDER BY price ASC`,
  )
    .bind(publisher.id)
    .all();
  const reviews = await c.env.DB.prepare(
    `SELECT r.overall, r.communication, r.reliability, r.execution, r.comment, r.created_at, u.name AS reviewer
     FROM reviews r JOIN users u ON u.id = r.advertiser_id
     WHERE r.publisher_id = ? AND r.moderated = 0 ORDER BY r.created_at DESC LIMIT 10`,
  )
    .bind(publisher.id)
    .all();
  return c.json({ publisher, packages: packages.results, reviews: reviews.results });
});

publicRoutes.get("/packages", async (c) => {
  const q = c.req.query();
  const { page, pageSize, offset } = paging(new URLSearchParams(q));
  const clauses: string[] = [
    `pk.is_active = 1`,
    `pu.status IN ('APPROVED','ACTIVE')`,
    `(pk.total_slots - pk.booked_slots - pk.reserved_slots) > 0`,
  ];
  const params: unknown[] = [];
  if (q.platform) {
    clauses.push(`pk.platform = ?`);
    params.push(q.platform);
  }
  if (q.minPrice) {
    clauses.push(`pk.price >= ?`);
    params.push(parseFloat(q.minPrice));
  }
  if (q.maxPrice) {
    clauses.push(`pk.price <= ?`);
    params.push(parseFloat(q.maxPrice));
  }
  if (q.q) {
    clauses.push(`(pk.title LIKE ? OR pu.name LIKE ?)`);
    const like = `%${q.q}%`;
    params.push(like, like);
  }
  if (q.duration) {
    clauses.push(`pk.duration_days <= ?`);
    params.push(parseInt(q.duration, 10));
  }
  const where = clauses.join(" AND ");
  const count = await c.env.DB.prepare(
    `SELECT COUNT(*) AS n FROM ad_packages pk JOIN publishers pu ON pu.id = pk.publisher_id WHERE ${where}`,
  )
    .bind(...params)
    .first<{ n: number }>();
  const sort =
    q.sort === "price-asc"
      ? "pk.price ASC"
      : q.sort === "price-desc"
        ? "pk.price DESC"
        : "pk.is_featured DESC, pk.created_at DESC";
  const rows = await c.env.DB.prepare(
    `SELECT pk.id, pk.title, pk.platform, pk.price, pk.currency, pk.quantity, pk.duration_days,
            (pk.total_slots - pk.booked_slots - pk.reserved_slots) AS available_slots, pk.total_slots,
            pk.description, pu.name AS publisher_name, pu.slug AS publisher_slug, pu.logo_url, pu.verified
     FROM ad_packages pk JOIN publishers pu ON pu.id = pk.publisher_id
     WHERE ${where} ORDER BY ${sort} LIMIT ? OFFSET ?`,
  )
    .bind(...params, pageSize, offset)
    .all();
  return c.json(paginated(rows.results, count?.n ?? 0, page, pageSize));
});

publicRoutes.get("/featured-publishers", async (c) => {
  const rows = await c.env.DB.prepare(
    `${publisherSelect()} ${activeWhere()} AND (p.featured = 1 OR p.trust_level IN ('VERIFIED','PREMIUM'))
     ORDER BY p.featured DESC, COALESCE(s.followers, 0) DESC LIMIT 8`,
  ).all();
  return c.json(rows.results);
});

publicRoutes.get("/cms/:key", async (c) => {
  const key = c.req.param("key");
  if (!/^[a-z0-9_.-]+$/.test(key)) return c.json(null);
  const row = await c.env.DB.prepare(`SELECT content FROM cms_content WHERE key = ?`).bind(key).first<{ content: string }>();
  if (!row) return c.json(null);
  try {
    return c.json(JSON.parse(row.content));
  } catch {
    return c.json(row.content);
  }
});

publicRoutes.get("/settings", async (c) => {
  const keys = [
    "agency.name",
    "agency.legal_name",
    "agency.registration",
    "agency.address",
    "agency.email",
    "agency.phone",
    "agency.gst",
    "app.currency",
  ];
  const rows = await c.env.DB.prepare(
    `SELECT key, value FROM system_settings WHERE key IN (${keys.map(() => "?").join(",")})`,
  )
    .bind(...keys)
    .all<{ key: string; value: string }>();
  const settings: Record<string, string> = {};
  for (const r of rows.results) settings[r.key] = r.value;
  return c.json(settings);
});
