export interface Env {
  DB: D1Database;
  FILES: R2Bucket;
  KV: KVNamespace;
  ASSETS: Fetcher;
  APP_NAME: string;
  AUDIT_ENABLED: string;
  // Secrets (set via wrangler secret put / Cloudflare dashboard):
  SESSION_SECRET: string;
  ADMIN_BOOTSTRAP_USERNAME?: string;
  ADMIN_BOOTSTRAP_PASSWORD?: string;
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  PAYMENT_PROVIDER?: string;
  RAZORPAY_KEY_ID?: string;
  RAZORPAY_KEY_SECRET?: string;
  RAZORPAY_WEBHOOK_SECRET?: string;
  R2_PUBLIC_URL?: string;
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: "admin" | "publisher" | "advertiser";
  account_status: string;
  must_change_password: number;
  staff_role?: string | null;
  publisherId?: string | null;
  advertiserId?: string | null;
}

export interface AppVariables {
  user?: SessionUser;
  sessionToken?: string;
}

export type AppBindings = {
  Bindings: Env;
  Variables: AppVariables;
};
