import type { Env } from "./env";

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function errorBody(err: unknown) {
  if (err instanceof ApiError) {
    return {
      error: { code: err.code, message: err.message, details: err.details },
    };
  }
  return {
    error: {
      code: "INTERNAL_ERROR",
      message: "Something went wrong. Please try again.",
    },
  };
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function isoDaysFromNow(days: number): string {
  return new Date(Date.now() + days * 86400000).toISOString();
}

export function parseJsonSafe<T = unknown>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function toDateOnly(iso: string): string {
  return iso.slice(0, 10);
}

export function paging(q: URLSearchParams): { page: number; pageSize: number; offset: number } {
  const page = Math.max(1, parseInt(q.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(q.get("pageSize") ?? "20", 10) || 20));
  return { page, pageSize, offset: (page - 1) * pageSize };
}

export function paginated<T>(items: T[], total: number, page: number, pageSize: number) {
  return { items, total, page, pageSize };
}

export function randomToken(bytes = 32): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function audit(env: Env, entry: {
  user_id?: string | null;
  action: string;
  entity?: string | null;
  entity_id?: string | null;
  old_value?: string | null;
  new_value?: string | null;
  ip?: string | null;
}): Promise<void> {
  if (env.AUDIT_ENABLED === "false") return;
  try {
    await env.DB.prepare(
      `INSERT INTO audit_logs (id, user_id, action, entity, entity_id, old_value, new_value, ip)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        crypto.randomUUID(),
        entry.user_id ?? null,
        entry.action,
        entry.entity ?? null,
        entry.entity_id ?? null,
        entry.old_value ?? null,
        entry.new_value ?? null,
        entry.ip ?? null,
      )
      .run();
  } catch {
    // audit must never break the main flow
  }
}

export function sanitizeErrorDetail(msg: string): string {
  return msg.replace(/\b(secret|password|token|key)\b/gi, "***");
}
