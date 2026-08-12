import type { Env } from "../env";
import type { NotificationType } from "@agency/shared";

export async function notify(
  env: Env,
  userIds: (string | null | undefined)[],
  type: NotificationType,
  title: string,
  body?: string | null,
  link?: string | null,
): Promise<void> {
  const ids = [...new Set(userIds.filter((x): x is string => !!x))];
  if (ids.length === 0) return;
  const stmts = ids.map((uid) =>
    env.DB.prepare(
      `INSERT INTO notifications (id, user_id, type, title, body, link) VALUES (?, ?, ?, ?, ?, ?)`,
    ).bind(crypto.randomUUID(), uid, type, title, body ?? null, link ?? null),
  );
  try {
    await env.DB.batch(stmts);
  } catch {
    // notifications must never break core flows
  }
}

export async function unreadCount(env: Env, userId: string): Promise<number> {
  const row = await env.DB.prepare(`SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read = 0`)
    .bind(userId)
    .first<{ n: number }>();
  return row?.n ?? 0;
}
