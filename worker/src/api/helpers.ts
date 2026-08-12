import type { Context } from "hono";
import { z } from "zod";
import type { Env, SessionUser, AppVariables } from "../env";
import { ApiError } from "../utils";

export type AppBindings = {
  Bindings: Env;
  Variables: AppVariables;
};

export type AppContext = Context<AppBindings>;

export async function jsonBody<T>(schema: z.ZodType<T>, c: AppContext): Promise<T> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    throw new ApiError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    throw new ApiError(400, "VALIDATION_ERROR", issues.join("; "), result.error.issues);
  }
  return result.data;
}

export function me(c: AppContext): SessionUser {
  const user = c.get("user");
  if (!user) throw new ApiError(401, "UNAUTHORIZED", "Please log in to continue.");
  return user;
}

export function getUser(c: AppContext): SessionUser | null {
  return c.get("user") ?? null;
}

export function idParam(c: AppContext): string {
  const id = c.req.param("id");
  if (!id || !/^[a-zA-Z0-9_-]{4,64}$/.test(id)) {
    throw new ApiError(400, "INVALID_ID", "Invalid identifier.");
  }
  return id;
}

export const zodId = z.string().min(4).max(64).regex(/^[a-zA-Z0-9_-]+$/);
