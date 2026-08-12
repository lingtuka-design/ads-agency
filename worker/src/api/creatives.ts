import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../env";
import { ApiError, audit, nowIso } from "../utils";
import { requireAuth } from "../auth";
import { jsonBody, me, idParam } from "./helpers";
import type { AppBindings } from "./helpers";
import { loadBooking, requireBookingActor } from "../services/bookings";
import { notify } from "../services/notifications";
import { CREATIVE_JOB_STATUS, CREATIVE_STATUS, type CreativeStatus } from "@agency/shared";

const versionSchema = z.object({
  file_url: z.string().max(1000),
  file_name: z.string().max(300),
  file_size: z.number().int().min(0).optional().nullable(),
  mime_type: z.string().max(100).optional().nullable(),
  comment: z.string().max(2000).optional().nullable(),
  status: z.enum(CREATIVE_STATUS).optional(),
});

const statusSchema = z.object({
  status: z.enum(CREATIVE_STATUS),
  note: z.string().max(1000).optional().nullable(),
});

const jobSchema = z.object({
  business_name: z.string().max(200).optional(),
  product_service: z.string().max(500).optional(),
  objective: z.string().max(1000).optional(),
  target_audience: z.string().max(500).optional(),
  preferred_style: z.string().max(500).optional(),
  preferred_colors: z.string().max(300).optional(),
  required_text: z.string().max(2000).optional(),
  format: z.string().max(100).optional(),
  deadline: z.string().nullable().optional(),
  budget: z.number().min(0).nullable().optional(),
  brief: z.string().max(3000).optional(),
  attachments: z.array(z.object({ url: z.string(), name: z.string() })).optional().nullable(),
  drive_links: z.array(z.string()).optional().nullable(),
});

export const creativeRoutes = new Hono<AppBindings>();
creativeRoutes.use("*", requireAuth);

const CREATIVE_JOB_TRANSITIONS: Record<string, string[]> = {
  NEW_REQUEST: ["ASSIGNED", "DESIGNING", "REVIEW", "REVISION_REQUESTED", "FINAL_APPROVAL", "APPROVED", "DELIVERED", "CANCELLED"],
  ASSIGNED: ["DESIGNING", "REVIEW", "REVISION_REQUESTED", "FINAL_APPROVAL", "APPROVED", "DELIVERED"],
  DESIGNING: ["REVIEW", "REVISION_REQUESTED", "FINAL_APPROVAL", "APPROVED", "DELIVERED"],
  REVIEW: ["REVISION_REQUESTED", "FINAL_APPROVAL", "APPROVED", "DELIVERED", "DESIGNING"],
  REVISION_REQUESTED: ["DESIGNING", "REVIEW", "FINAL_APPROVAL", "APPROVED", "DELIVERED"],
  FINAL_APPROVAL: ["APPROVED", "REVISION_REQUESTED", "DELIVERED"],
  APPROVED: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
};

// ---------- Creative versions (attached to bookings) ----------

creativeRoutes.get("/booking/:id", async (c) => {
  const user = me(c);
  const booking = await loadBooking(c.env, idParam(c));
  if (!booking) throw new ApiError(404, "BOOKING_NOT_FOUND", "Booking not found.");
  requireBookingActor(user, booking);
  const creative = await c.env.DB.prepare(`SELECT * FROM creatives WHERE booking_id = ?`)
    .bind(booking.id)
    .first();
  const versions = creative
    ? await c.env.DB.prepare(
        `SELECT v.*, u.name AS uploaded_by_name FROM creative_versions v
         LEFT JOIN users u ON u.id = v.uploaded_by
         WHERE v.creative_id = ? ORDER BY v.version DESC`,
      )
        .bind(creative.id)
        .all()
    : { results: [] };
  return c.json({ creative, versions: versions.results });
});

creativeRoutes.post("/booking/:id/upload", async (c) => {
  const user = me(c);
  const booking = await loadBooking(c.env, idParam(c));
  if (!booking) throw new ApiError(404, "BOOKING_NOT_FOUND", "Booking not found.");
  requireBookingActor(user, booking);
  const input = await jsonBody(versionSchema, c);

  let creative = await c.env.DB.prepare(`SELECT * FROM creatives WHERE booking_id = ?`)
    .bind(booking.id)
    .first<{ id: string; current_version: number }>();
  const ts = nowIso();
  if (!creative) {
    const id = crypto.randomUUID();
    await c.env.DB.prepare(
      `INSERT INTO creatives (id, booking_id, current_version, status, created_at, updated_at)
       VALUES (?, ?, 0, 'UPLOADED', ?, ?)`,
    )
      .bind(id, booking.id, ts, ts)
      .run();
    creative = { id, current_version: 0 };
  }
  const version = creative.current_version + 1;
  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO creative_versions (id, creative_id, version, file_url, file_name, file_size, mime_type, uploaded_by, status, comment, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(crypto.randomUUID(), creative.id, version, input.file_url, input.file_name, input.file_size ?? null, input.mime_type ?? null, user.id, input.status ?? "UPLOADED", input.comment ?? null, ts),
    c.env.DB.prepare(`UPDATE creatives SET current_version = ?, status = ?, updated_at = ? WHERE id = ?`)
      .bind(version, input.status ?? "UPLOADED", ts, creative.id),
    c.env.DB.prepare(`UPDATE bookings SET status = 'CREATIVE_REQUIRED', updated_at = ? WHERE id = ?`)
      .bind(ts, booking.id),
    c.env.DB.prepare(
      `INSERT INTO booking_status_history (id, booking_id, from_status, to_status, actor_id, note) VALUES (?, ?, ?, 'CREATIVE_REQUIRED', ?, ?)`,
    )
      .bind(crypto.randomUUID(), booking.id, booking.status, user.id, "Creative uploaded"),
  ]);
  await notify(c.env, [booking.publisher_id, booking.advertiser_id], "CREATIVE_UPLOADED", "Creative uploaded", input.file_name, `/bookings/${booking.id}`);
  await audit(c.env, { user_id: user.id, action: "CREATIVE_UPLOAD", entity: "booking", entity_id: booking.id, new_value: `v${version}: ${input.file_name}` });
  return c.json({ ok: true, version });
});

// Agency/publisher/admin status updates for the creative
creativeRoutes.post("/booking/:id/status", async (c) => {
  const user = me(c);
  const booking = await loadBooking(c.env, idParam(c));
  if (!booking) throw new ApiError(404, "BOOKING_NOT_FOUND", "Booking not found.");
  requireBookingActor(user, booking);
  const input = await jsonBody(statusSchema, c);
  if (user.role === "advertiser" && input.status !== "UPLOADED") {
    throw new ApiError(403, "FORBIDDEN", "Advertisers can only upload creatives.");
  }
  const creative = await c.env.DB.prepare(`SELECT id FROM creatives WHERE booking_id = ?`)
    .bind(booking.id)
    .first<{ id: string }>();
  if (!creative) throw new ApiError(404, "NO_CREATIVE", "No creative exists for this booking yet.");
  const ts = nowIso();
  await c.env.DB.batch([
    c.env.DB.prepare(`UPDATE creatives SET status = ?, updated_at = ? WHERE id = ?`).bind(input.status, ts, creative.id),
    c.env.DB.prepare(`UPDATE creative_versions SET status = ? WHERE creative_id = ? AND version = (SELECT MAX(version) FROM creative_versions WHERE creative_id = ?)`)
      .bind(input.status, creative.id, creative.id),
  ]);
  await notify(c.env, [booking.advertiser_id, booking.publisher_id], "CREATIVE_APPROVED", `Creative ${input.status.replace(/_/g, " ").toLowerCase()}`, input.note ?? null, `/bookings/${booking.id}`);
  await audit(c.env, { user_id: user.id, action: "CREATIVE_STATUS", entity: "booking", entity_id: booking.id, new_value: input.status });
  return c.json({ ok: true });
});

creativeRoutes.post("/booking/:id/links", async (c) => {
  const user = me(c);
  const booking = await loadBooking(c.env, idParam(c));
  if (!booking) throw new ApiError(404, "BOOKING_NOT_FOUND", "Booking not found.");
  requireBookingActor(user, booking);
  const input = await jsonBody(
    z.object({ links: z.array(z.string().max(1000)).max(20), replace: z.boolean().optional() }),
    c,
  );
  let creative = await c.env.DB.prepare(`SELECT id, drive_links FROM creatives WHERE booking_id = ?`)
    .bind(booking.id)
    .first<{ id: string; drive_links: string | null }>();
  const ts = nowIso();
  if (!creative) {
    const id = crypto.randomUUID();
    await c.env.DB.prepare(
      `INSERT INTO creatives (id, booking_id, current_version, status, drive_links, created_at, updated_at)
       VALUES (?, ?, 0, 'UPLOADED', ?, ?, ?)`,
    )
      .bind(id, booking.id, JSON.stringify(input.links), ts, ts)
      .run();
    creative = { id, drive_links: null };
  } else {
    let existing: string[] = [];
    try {
      existing = creative.drive_links ? JSON.parse(creative.drive_links) : [];
    } catch {
      existing = [];
    }
    const merged = input.replace ? input.links : [...existing, ...input.links.filter((l) => !existing.includes(l))];
    await c.env.DB.prepare(`UPDATE creatives SET drive_links = ?, updated_at = ? WHERE id = ?`)
      .bind(JSON.stringify(merged), ts, creative.id)
      .run();
  }
  await audit(c.env, { user_id: user.id, action: "CREATIVE_LINKS", entity: "booking", entity_id: booking.id, new_value: JSON.stringify(input.links) });
  return c.json({ ok: true, count: input.links.length });
});

// ---------- Creative jobs (Creative Studio / design requests) ----------

creativeRoutes.get("/jobs", async (c) => {
  const user = me(c);
  let where = "1=1";
  const params: unknown[] = [];
  if (user.role === "advertiser") {
    where = "advertiser_id = ?";
    params.push(user.advertiserId);
  } else if (user.role === "admin") {
    if (c.req.query("status")) {
      where = "status = ?";
      params.push(c.req.query("status"));
    }
  } else {
    throw new ApiError(403, "FORBIDDEN", "Not allowed.");
  }
  const rows = await c.env.DB.prepare(
    `SELECT j.*, u.name AS advertiser_name, s.name AS assignee_name
     FROM creative_jobs j
     LEFT JOIN users u ON u.id = (SELECT user_id FROM advertisers a WHERE a.id = j.advertiser_id)
     LEFT JOIN users s ON s.id = j.assigned_to
     WHERE ${where} ORDER BY j.created_at DESC LIMIT 100`,
  )
    .bind(...params)
    .all();
  return c.json(rows.results);
});

creativeRoutes.post("/jobs", async (c) => {
  const user = me(c);
  if (user.role !== "advertiser") throw new ApiError(403, "FORBIDDEN", "Only advertisers can request designs.");
  const input = await jsonBody(jobSchema, c);
  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    `INSERT INTO creative_jobs (id, advertiser_id, status, brief, business_name, product_service, objective, target_audience,
     preferred_style, preferred_colors, required_text, format, budget, deadline, attachments, drive_links, created_at, updated_at)
     VALUES (?, ?, 'NEW_REQUEST', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      user.advertiserId,
      input.brief ?? null,
      input.business_name ?? null,
      input.product_service ?? null,
      input.objective ?? null,
      input.target_audience ?? null,
      input.preferred_style ?? null,
      input.preferred_colors ?? null,
      input.required_text ?? null,
      input.format ?? null,
      input.budget ?? null,
      input.deadline ?? null,
      input.attachments ? JSON.stringify(input.attachments) : null,
      input.drive_links ? JSON.stringify(input.drive_links) : null,
      nowIso(),
      nowIso(),
    )
    .run();
  await audit(c.env, { user_id: user.id, action: "CREATIVE_JOB_CREATE", entity: "creative_job", entity_id: id });
  return c.json({ ok: true, id });
});

creativeRoutes.post("/jobs/:id/status", async (c) => {
  const user = me(c);
  const jobId = idParam(c);
  const input = await jsonBody(
    z.object({
      status: z.enum(CREATIVE_JOB_STATUS),
      design_url: z.string().max(1000).optional().nullable(),
      note: z.string().max(1000).optional().nullable(),
    }),
    c,
  );
  const job = await c.env.DB.prepare(`SELECT * FROM creative_jobs WHERE id = ?`)
    .bind(jobId)
    .first<{ id: string; advertiser_id: string; status: string; assigned_to: string | null }>();
  if (!job) throw new ApiError(404, "JOB_NOT_FOUND", "Design request not found.");
  if (user.role === "advertiser") {
    if (job.advertiser_id !== user.advertiserId) throw new ApiError(403, "FORBIDDEN", "Not your request.");
    if (!["REVISION_REQUESTED", "FINAL_APPROVAL", "APPROVED"].includes(input.status)) {
      throw new ApiError(403, "FORBIDDEN", "Advertisers can only request revisions or approve.");
    }
  } else if (user.role !== "admin") {
    throw new ApiError(403, "FORBIDDEN", "Not allowed.");
  }
  if (!(CREATIVE_JOB_TRANSITIONS[job.status] ?? []).includes(input.status)) {
    throw new ApiError(409, "INVALID_TRANSITION", `Cannot move design request from ${job.status} to ${input.status}.`);
  }
  await c.env.DB.prepare(`UPDATE creative_jobs SET status = ?, design_url = COALESCE(?, design_url), updated_at = ? WHERE id = ?`)
    .bind(input.status, input.design_url ?? null, nowIso(), job.id)
    .run();
  const advUserId = await c.env.DB.prepare(`SELECT user_id FROM advertisers WHERE id = ?`)
    .bind(job.advertiser_id)
    .first<{ user_id: string }>();
  await notify(c.env, [advUserId?.user_id, job.assigned_to], "SYSTEM", `Design request ${input.status.replace(/_/g, " ").toLowerCase()}`, input.note ?? null, `/creative-studio/${job.id}`);
  await audit(c.env, { user_id: user.id, action: "CREATIVE_JOB_STATUS", entity: "creative_job", entity_id: job.id, new_value: input.status });
  return c.json({ ok: true });
});
