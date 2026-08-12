import { createMiddleware } from "hono/factory";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import type { Env, SessionUser, AppVariables } from "./env";
import { ApiError, randomToken, sha256Hex } from "./utils";

const PBKDF2_ITERATIONS = 210_000;
const SESSION_TTL_MS = 30 * 24 * 3600 * 1000; // 30 days

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    key,
    256,
  );
  const toHex = (b: ArrayBuffer | Uint8Array) =>
    Array.from(b instanceof Uint8Array ? b : new Uint8Array(b), (x) => x.toString(16).padStart(2, "0")).join("");
  return `pbkdf2:${PBKDF2_ITERATIONS}:${toHex(salt)}:${toHex(bits)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split(":");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const iterations = parseInt(parts[1], 10);
  const salt = hexToBytes(parts[2]);
  const expected = parts[3];
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    key,
    256,
  );
  const actual = Array.from(new Uint8Array(bits), (x) => x.toString(16).padStart(2, "0")).join("");
  return actual === expected;
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export async function createSession(
  env: Env,
  userId: string,
  setCookieFn: (name: string, value: string, opts: Record<string, unknown>) => void,
): Promise<string> {
  const token = randomToken(32);
  const tokenHash = await sha256Hex(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  await env.DB.prepare(
    `INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)`,
  )
    .bind(crypto.randomUUID(), userId, tokenHash, expiresAt)
    .run();
  setCookieFn("session", token, {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
  return token;
}

export async function destroySession(env: Env, token: string): Promise<void> {
  const hash = await sha256Hex(token);
  await env.DB.prepare(`UPDATE sessions SET revoked = 1 WHERE token_hash = ?`).bind(hash).run();
}

async function loadSessionUser(env: Env, token: string): Promise<SessionUser | null> {
  const tokenHash = await sha256Hex(token);
  const row = await env.DB.prepare(
    `SELECT s.user_id, s.expires_at, s.revoked,
            u.email, u.name, u.role, u.account_status, u.must_change_password
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ?`,
  )
    .bind(tokenHash)
    .first<{
      user_id: string;
      expires_at: string;
      revoked: number;
      email: string;
      name: string;
      role: SessionUser["role"];
      account_status: string;
      must_change_password: number;
    }>();
  if (!row) return null;
  if (row.revoked || new Date(row.expires_at).getTime() < Date.now()) return null;

  const user: SessionUser = {
    id: row.user_id,
    email: row.email,
    name: row.name,
    role: row.role,
    account_status: row.account_status,
    must_change_password: row.must_change_password,
  };

  if (user.role === "admin") {
    const staff = await env.DB.prepare(`SELECT staff_role FROM staff WHERE user_id = ? AND active = 1`)
      .bind(user.id)
      .first<{ staff_role: string }>();
    user.staff_role = staff?.staff_role ?? "SUPER_ADMIN";
  }
  if (user.role === "publisher") {
    const p = await env.DB.prepare(`SELECT id, status FROM publishers WHERE user_id = ?`)
      .bind(user.id)
      .first<{ id: string; status: string }>();
    user.publisherId = p?.id ?? null;
  }
  if (user.role === "advertiser") {
    const a = await env.DB.prepare(`SELECT id FROM advertisers WHERE user_id = ?`)
      .bind(user.id)
      .first<{ id: string }>();
    user.advertiserId = a?.id ?? null;
  }
  return user;
}

export const sessionMiddleware = createMiddleware<{ Bindings: Env; Variables: AppVariables }>(async (c, next) => {
  const authHeader = c.req.header("Authorization") ?? "";
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const cookieToken = getCookie(c, "session");
  const token = bearer ?? cookieToken;

  if (token) {
    const user = await loadSessionUser(c.env, token);
    if (user) {
      c.set("user", user);
      c.set("sessionToken", token);
      if (user.account_status === "BLOCKED") {
        throw new ApiError(403, "ACCOUNT_BLOCKED", "Your account has been blocked.");
      }
      if (user.account_status === "SUSPENDED") {
        throw new ApiError(403, "ACCOUNT_SUSPENDED", "Your account has been suspended.");
      }
    }
  }
  await next();
});

export const requireAuth = createMiddleware<{ Bindings: Env; Variables: AppVariables }>(async (c, next) => {
  const user = c.get("user");
  if (!user) throw new ApiError(401, "UNAUTHORIZED", "Please log in to continue.");
  await next();
});

export function requireRole(...roles: string[]) {
  return createMiddleware<{ Bindings: Env; Variables: AppVariables }>(async (c, next) => {
    const user = c.get("user");
    if (!user || !roles.includes(user.role)) {
      throw new ApiError(403, "FORBIDDEN", "You do not have permission to perform this action.");
    }
    await next();
  });
}

export function requirePermission(perm: string) {
  return createMiddleware<{ Bindings: Env; Variables: AppVariables }>(async (c, next) => {
    const user = c.get("user");
    if (!user) throw new ApiError(401, "UNAUTHORIZED", "Please log in to continue.");
    if (user.role !== "admin") {
      throw new ApiError(403, "FORBIDDEN", "You do not have permission to perform this action.");
    }
    const { STAFF_PERMISSIONS } = await import("@agency/shared");
    const perms = STAFF_PERMISSIONS[(user.staff_role ?? "SUPER_ADMIN") as keyof typeof STAFF_PERMISSIONS] ?? [];
    if (!perms.includes("*") && !perms.includes(perm)) {
      throw new ApiError(403, "FORBIDDEN", "You do not have permission to perform this action.");
    }
    await next();
  });
}
