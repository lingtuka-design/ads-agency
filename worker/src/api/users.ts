import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../env";
import { audit } from "../utils";
import { requireAuth } from "../auth";
import { jsonBody, me, type AppBindings } from "./helpers";

const profileSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  phone: z.string().max(30).nullable().optional(),
  company_name: z.string().max(200).nullable().optional(),
  industry: z.string().max(100).nullable().optional(),
  location: z.string().max(200).nullable().optional(),
});

export const userRoutes = new Hono<AppBindings>();
userRoutes.use("*", requireAuth);

userRoutes.patch("/me", async (c) => {
  const user = me(c);
  const input = await jsonBody(profileSchema, c);
  const fields: string[] = [];
  const params: unknown[] = [];
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;
    fields.push(`${key} = ?`);
    params.push(value);
  }
  if (fields.length > 0) {
    params.push(new Date().toISOString(), user.id);
    await c.env.DB.prepare(`UPDATE users SET ${fields.join(", ")}, updated_at = ? WHERE id = ?`)
      .bind(...params)
      .run();
  }
  if (user.role === "advertiser" && user.advertiserId && (input.company_name !== undefined || input.industry !== undefined || input.location !== undefined)) {
    const advFields: string[] = [];
    const advParams: unknown[] = [];
    if (input.company_name !== undefined) {
      advFields.push("company_name = ?");
      advParams.push(input.company_name);
    }
    if (input.industry !== undefined) {
      advFields.push("industry = ?");
      advParams.push(input.industry);
    }
    if (input.location !== undefined) {
      advFields.push("location = ?");
      advParams.push(input.location);
    }
    advParams.push(user.advertiserId);
    await c.env.DB.prepare(`UPDATE advertisers SET ${advFields.join(", ")} WHERE id = ?`)
      .bind(...advParams)
      .run();
  }
  await audit(c.env, { user_id: user.id, action: "USER_UPDATE", entity: "user", entity_id: user.id });
  return c.json({ ok: true });
});
