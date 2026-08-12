import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../env";
import { ApiError, audit } from "../utils";
import { requireAuth } from "../auth";
import { jsonBody, me } from "./helpers";
import type { AppBindings } from "./helpers";
import { loadBooking, requireBookingActor } from "../services/bookings";
import { notify } from "../services/notifications";

const sendSchema = z.object({
  thread_type: z.enum(["campaign", "creative_job", "dispute", "support"]),
  thread_id: z.string().min(4).max(64),
  body: z.string().min(1).max(4000).optional(),
  attachment_url: z.string().max(1000).optional().nullable(),
  attachment_name: z.string().max(300).optional().nullable(),
});

async function assertThreadAccess(env: Env, c: { req: { param: (k: string) => string } }, user: { role: string; id: string; publisherId?: string | null; advertiserId?: string | null }) {
  const threadType = c.req.param("type");
  const threadId = c.req.param("thread");
  if (threadType === "campaign") {
    const booking = await loadBooking(env, threadId);
    if (!booking) throw new ApiError(404, "BOOKING_NOT_FOUND", "Campaign thread not found.");
    requireBookingActor(user, booking);
  } else if (threadType === "creative_job") {
    const job = await env.DB.prepare(`SELECT * FROM creative_jobs WHERE id = ?`)
      .bind(threadId)
      .first<{ advertiser_id: string; assigned_to: string | null }>();
    if (!job) throw new ApiError(404, "JOB_NOT_FOUND", "Thread not found.");
    if (user.role === "advertiser" && job.advertiser_id !== user.advertiserId) throw new ApiError(403, "FORBIDDEN", "Not your thread.");
  } else if (threadType === "dispute") {
    const dispute = await env.DB.prepare(`SELECT * FROM disputes WHERE id = ?`)
      .bind(threadId)
      .first<{ booking_id: string }>();
    if (!dispute) throw new ApiError(404, "DISPUTE_NOT_FOUND", "Thread not found.");
    const booking = await loadBooking(env, dispute.booking_id);
    if (booking) requireBookingActor(user, booking);
  } else {
    if (user.role !== "admin") throw new ApiError(403, "FORBIDDEN", "Support threads are agency-only.");
  }
}

export const messageRoutes = new Hono<AppBindings>();
messageRoutes.use("*", requireAuth);

messageRoutes.get("/threads", async (c) => {
  const user = me(c);
  const rows = await c.env.DB.prepare(
    `SELECT DISTINCT thread_type, thread_id, MAX(created_at) AS last_at,
            (SELECT body FROM messages m2 WHERE m2.thread_type = m.thread_type AND m2.thread_id = m.thread_id ORDER BY m2.created_at DESC LIMIT 1) AS last_body,
            (SELECT COUNT(*) FROM messages m3 WHERE m3.thread_type = m.thread_type AND m3.thread_id = m.thread_id AND m3.sender_id != ?) AS message_count
     FROM messages m
     WHERE thread_type != 'support' OR ? IN (SELECT user_id FROM staff)
     ORDER BY last_at DESC LIMIT 100`,
  )
    .bind(user.id, user.id)
    .all();
  return c.json(rows.results);
});

messageRoutes.get("/:type/:thread", async (c) => {
  const user = me(c);
  await assertThreadAccess(c.env, c, user);
  const rows = await c.env.DB.prepare(
    `SELECT m.*, u.name AS sender_name FROM messages m
     LEFT JOIN users u ON u.id = m.sender_id
     WHERE m.thread_type = ? AND m.thread_id = ? ORDER BY m.created_at ASC LIMIT 500`,
  )
    .bind(c.req.param("type"), c.req.param("thread"))
    .all();
  return c.json(rows.results);
});

messageRoutes.post("/", async (c) => {
  const user = me(c);
  const input = await jsonBody(sendSchema, c);
  if (!input.body && !input.attachment_url) {
    throw new ApiError(400, "EMPTY_MESSAGE", "Message must contain text or an attachment.");
  }
  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    `INSERT INTO messages (id, thread_type, thread_id, sender_id, sender_role, body, attachment_url, attachment_name, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      input.thread_type,
      input.thread_id,
      user.id,
      user.role,
      input.body ?? null,
      input.attachment_url ?? null,
      input.attachment_name ?? null,
      new Date().toISOString(),
    )
    .run();

  // Notify the counterparty
  if (input.thread_type === "campaign") {
    const booking = await loadBooking(c.env, input.thread_id);
    if (booking) {
      const otherParty =
        user.role === "advertiser" ? booking.publisher_id : user.role === "publisher" ? booking.advertiser_id : null;
      if (otherParty) {
        const otherUserId = await c.env.DB.prepare(`SELECT user_id FROM publishers WHERE id = ? UNION ALL SELECT user_id FROM advertisers WHERE id = ?`)
          .bind(otherParty, otherParty)
          .first<{ user_id: string }>();
        if (otherUserId) {
          await notify(c.env, [otherUserId.user_id], "MESSAGE", "New message", input.body?.slice(0, 120) ?? "Attachment", `/campaigns/${booking.campaign_id}`);
        }
      }
    }
  }
  return c.json({ ok: true, id });
});
