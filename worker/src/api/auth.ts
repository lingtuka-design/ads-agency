import { Hono } from "hono";
import { z } from "zod";
import { setCookie } from "hono/cookie";
import type { Env } from "../env";
import { ApiError, audit } from "../utils";
import { createSession, destroySession, hashPassword, verifyPassword } from "../auth";
import { jsonBody, me } from "./helpers";
import type { AppBindings } from "./helpers";
import { slugify, randomId } from "@agency/shared";

const SESSION_COOKIE = {
  httpOnly: true,
  secure: true,
  sameSite: "Lax",
  path: "/",
  maxAge: 30 * 24 * 3600,
} as const;

const registerSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email().max(200),
  password: z.string().min(8).max(200),
  phone: z.string().max(30).optional().nullable(),
  role: z.enum(["advertiser", "publisher"]),
  companyName: z.string().max(200).optional().nullable(),
  industry: z.string().max(100).optional().nullable(),
  location: z.string().max(200).optional().nullable(),
  publisherName: z.string().max(200).optional().nullable(),
});

const loginSchema = z.object({
  // Email or username (bootstrap admin uses a username, spec §36)
  email: z.string().min(3).max(200),
  password: z.string().min(1).max(200),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(8).max(200),
});

export const authRoutes = new Hono<AppBindings>();

authRoutes.post("/register", async (c) => {
  const input = await jsonBody(registerSchema, c);
  const existing = await c.env.DB.prepare(`SELECT id FROM users WHERE email = ?`)
    .bind(input.email.toLowerCase())
    .first();
  if (existing) {
    throw new ApiError(409, "EMAIL_EXISTS", "An account with this email already exists.");
  }
  const passwordHash = await hashPassword(input.password);
  const userId = randomId("usr");
  const ts = new Date().toISOString();

  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO users (id, email, password_hash, name, phone, role, account_status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)`,
    ).bind(userId, input.email.toLowerCase(), passwordHash, input.name, input.phone ?? null, input.role, ts, ts),
  ]);

  let profileId: string | null = null;
  if (input.role === "advertiser") {
    profileId = randomId("adv");
    await c.env.DB.prepare(
      `INSERT INTO advertisers (id, user_id, company_name, industry, location, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
    ).bind(profileId, userId, input.companyName ?? input.name, input.industry ?? null, input.location ?? null, ts).run();
  } else {
    const publisherName = input.publisherName ?? input.name;
    let slug = slugify(publisherName);
    const exists = await c.env.DB.prepare(`SELECT id FROM publishers WHERE slug = ?`).bind(slug).first();
    if (exists) slug = `${slug}-${userId.slice(-6)}`;
    profileId = randomId("pub");
    await c.env.DB.prepare(
      `INSERT INTO publishers (id, user_id, name, slug, location, status, joined_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'PENDING', ?, ?, ?)`,
    )
      .bind(profileId, userId, publisherName, slug, input.location ?? null, ts, ts, ts)
      .run();
  }

  await createSession(c.env, userId, (name, value, opts) => setCookie(c, name, value, opts));
  await audit(c.env, { user_id: userId, action: "REGISTER", entity: "user", entity_id: userId });

  return c.json({ ok: true, user: { id: userId, email: input.email.toLowerCase(), role: input.role }, profileId });
});

authRoutes.post("/login", async (c) => {
  const input = await jsonBody(loginSchema, c);
  const inputEmail = input.email.trim().toLowerCase();

  // Auto-bootstrap admin user from environment secrets if logging in as bootstrap admin username
  const bootstrapUsername = c.env.ADMIN_BOOTSTRAP_USERNAME?.trim().toLowerCase();
  const bootstrapPassword = c.env.ADMIN_BOOTSTRAP_PASSWORD;

  if (bootstrapUsername && inputEmail === bootstrapUsername) {
    const existing = await c.env.DB.prepare(`SELECT id FROM users WHERE email = ?`).bind(bootstrapUsername).first();
    if (!existing && bootstrapPassword) {
      const passwordHash = await hashPassword(bootstrapPassword);
      const adminId = crypto.randomUUID();
      const ts = new Date().toISOString();
      await c.env.DB.batch([
        c.env.DB.prepare(
          `INSERT INTO users (id, email, password_hash, name, role, account_status, must_change_password, created_at, updated_at)
           VALUES (?, ?, ?, 'Agency Admin', 'admin', 'ACTIVE', 0, ?, ?)`,
        ).bind(adminId, bootstrapUsername, passwordHash, ts, ts),
        c.env.DB.prepare(
          `INSERT INTO staff (id, user_id, staff_role, title, active, created_at) VALUES (?, ?, 'SUPER_ADMIN', 'Super Admin', 1, ?)`,
        ).bind(crypto.randomUUID(), adminId, ts),
      ]);
    }
  }

  const user = await c.env.DB.prepare(
    `SELECT id, email, password_hash, name, role, account_status, must_change_password FROM users WHERE email = ?`,
  )
    .bind(inputEmail)
    .first<{
      id: string;
      email: string;
      password_hash: string;
      name: string;
      role: string;
      account_status: string;
      must_change_password: number;
    }>();

  let isMatch = false;
  if (user) {
    isMatch = await verifyPassword(input.password, user.password_hash);
    if (!isMatch && bootstrapUsername && inputEmail === bootstrapUsername && bootstrapPassword && input.password === bootstrapPassword) {
      const newHash = await hashPassword(bootstrapPassword);
      await c.env.DB.prepare(`UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?`).bind(newHash, user.id).run();
      user.must_change_password = 0;
      isMatch = true;
    }
  }

  if (!user || !isMatch) {
    await audit(c.env, { action: "LOGIN_FAILED", entity: "user", entity_id: user?.id ?? null, new_value: input.email });
    throw new ApiError(401, "INVALID_CREDENTIALS", "Invalid email or password.");
  }
  if (user.account_status === "BLOCKED") {
    throw new ApiError(403, "ACCOUNT_BLOCKED", "Your account has been blocked.");
  }
  if (user.account_status === "SUSPENDED") {
    throw new ApiError(403, "ACCOUNT_SUSPENDED", "Your account has been suspended.");
  }
  await c.env.DB.prepare(`UPDATE users SET last_login_at = ? WHERE id = ?`)
    .bind(new Date().toISOString(), user.id)
    .run();
  await createSession(c.env, user.id, (name, value, opts) => setCookie(c, name, value, opts));
  await audit(c.env, { user_id: user.id, action: "LOGIN", entity: "user", entity_id: user.id });
  return c.json({
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      must_change_password: user.must_change_password === 1,
    },
  });
});

authRoutes.post("/logout", async (c) => {
  const token = c.get("sessionToken") as string | undefined;
  if (token) {
    await destroySession(c.env, token);
    await audit(c.env, { user_id: me(c).id, action: "LOGOUT" });
  }
  setCookie(c, "session", "", { httpOnly: true, path: "/", maxAge: 0 });
  return c.json({ ok: true });
});

authRoutes.get("/me", async (c) => {
  const user = c.get("user") as { id: string } | undefined;
  if (!user) return c.json({ user: null });
  const row = await c.env.DB.prepare(
    `SELECT u.id, u.email, u.name, u.phone, u.role, u.account_status, u.avatar_url, u.must_change_password,
            a.company_name, a.industry, a.verified AS advertiser_verified,
            p.id AS publisher_id, p.name AS publisher_name, p.status AS publisher_status, p.verified AS publisher_verified,
            s.staff_role
     FROM users u
     LEFT JOIN advertisers a ON a.user_id = u.id
     LEFT JOIN publishers p ON p.user_id = u.id
     LEFT JOIN staff s ON s.user_id = u.id
     WHERE u.id = ?`,
  )
    .bind(user.id)
    .first();
  return c.json({ user: row });
});

authRoutes.post("/change-password", async (c) => {
  const user = me(c);
  const input = await jsonBody(changePasswordSchema, c);
  const stored = await c.env.DB.prepare(`SELECT password_hash FROM users WHERE id = ?`)
    .bind(user.id)
    .first<{ password_hash: string }>();
  if (!stored || !(await verifyPassword(input.currentPassword, stored.password_hash))) {
    throw new ApiError(401, "INVALID_CREDENTIALS", "Current password is incorrect.");
  }
  if (input.newPassword === input.currentPassword) {
    throw new ApiError(400, "SAME_PASSWORD", "New password must be different.");
  }
  const hash = await hashPassword(input.newPassword);
  await c.env.DB.prepare(`UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = ? WHERE id = ?`)
    .bind(hash, new Date().toISOString(), user.id)
    .run();
  await audit(c.env, { user_id: user.id, action: "PASSWORD_CHANGE", entity: "user", entity_id: user.id });
  return c.json({ ok: true });
});
