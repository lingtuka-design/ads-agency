import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from "./env";
import type { AppBindings } from "./api/helpers";
import { errorBody } from "./utils";
import { sessionMiddleware, hashPassword } from "./auth";
import { authRoutes } from "./api/auth";
import { publicRoutes } from "./api/public";
import { publisherRoutes } from "./api/publishers";
import { bookingRoutes } from "./api/bookings";
import { creativeRoutes } from "./api/creatives";
import { messageRoutes } from "./api/messages";
import { paymentRoutes } from "./api/payments";
import { settlementRoutes } from "./api/settlements";
import { disputeRoutes } from "./api/disputes";
import { adminRoutes } from "./api/admin";
import { aiRoutes } from "./api/ai";
import { userRoutes } from "./api/users";
import {
  favoritesRoutes,
  notificationRoutes,
  invoiceRoutes,
  uploadRoutes,
  reviewRoutes,
} from "./api/extras";
import { audit } from "./utils";
import { ApiError } from "./utils";
import { runScheduledTasks } from "./cron";

const app = new Hono<AppBindings>({ strict: false });

app.use(
  "*",
  cors({
    origin: ["http://localhost:5173", "http://localhost:4173"],
    credentials: true,
  }),
);

app.use("*", sessionMiddleware);

app.get("/api/health", (c) => c.json({ ok: true, service: "ad-agency-marketplace" }));

// Bootstrap Super Admin from Cloudflare secrets (spec §36, §87)
app.post("/api/auth/bootstrap", async (c) => {
  const username = c.env.ADMIN_BOOTSTRAP_USERNAME;
  const password = c.env.ADMIN_BOOTSTRAP_PASSWORD;
  if (!username || !password) {
    return c.json({ error: { code: "NOT_CONFIGURED", message: "Bootstrap credentials are not configured." } }, 500);
  }
  const existing = await c.env.DB.prepare(`SELECT id FROM users WHERE email = ?`).bind(username.toLowerCase()).first();
  if (existing) {
    return c.json({ ok: true, exists: true });
  }
  const passwordHash = await hashPassword(password);
  const id = crypto.randomUUID();
  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO users (id, email, password_hash, name, role, account_status, must_change_password, created_at, updated_at)
       VALUES (?, ?, ?, 'Agency Admin', 'admin', 'ACTIVE', 1, ?, ?)`,
    )
      .bind(id, username.toLowerCase(), passwordHash, new Date().toISOString(), new Date().toISOString()),
    c.env.DB.prepare(
      `INSERT INTO staff (id, user_id, staff_role, title, active, created_at) VALUES (?, ?, 'SUPER_ADMIN', 'Super Admin', 1, ?)`,
    ).bind(crypto.randomUUID(), id, new Date().toISOString()),
  ]);
  await audit(c.env, { user_id: id, action: "BOOTSTRAP_ADMIN", entity: "user", entity_id: id });
  return c.json({ ok: true, created: true });
});

// Admin-only booking list used by dashboards
app.route("/api/auth", authRoutes);
app.route("/api/public", publicRoutes);
app.route("/api/publishers", publisherRoutes);
app.route("/api/bookings", bookingRoutes);
app.route("/api/creatives", creativeRoutes);
app.route("/api/messages", messageRoutes);
app.route("/api/payments", paymentRoutes);
app.route("/api/settlements", settlementRoutes);
app.route("/api/disputes", disputeRoutes);
app.route("/api/admin", adminRoutes);
app.route("/api/ai", aiRoutes);
app.route("/api/favorites", favoritesRoutes);
app.route("/api/notifications", notificationRoutes);
app.route("/api/invoices", invoiceRoutes);
app.route("/api/uploads", uploadRoutes);
app.route("/api/reviews", reviewRoutes);
app.route("/api/users", userRoutes);

// SPA fallback for assets binding
app.get("*", async (c) => {
  const res = await c.env.ASSETS.fetch(c.req.raw);
  return res;
});

app.onError((err, c) => {
  console.error(err);
  const status = err instanceof ApiError ? err.status : 500;
  return c.json(errorBody(err), status as Parameters<typeof c.json>[1]);
});

app.notFound((c) => c.json({ error: { code: "NOT_FOUND", message: "Route not found." } }, 404));

export default app;

// Scheduled maintenance (reservation expiry, abandoned drafts) — spec §72.
// Wired to the cron trigger in wrangler.jsonc.
export async function scheduled(controller: ScheduledController, env: Env): Promise<void> {
  const result = await runScheduledTasks(env);
  console.log(`[cron] released=${result.released} cancelled=${result.cancelled}`);
}
