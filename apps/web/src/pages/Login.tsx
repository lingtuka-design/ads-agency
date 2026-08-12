import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { Megaphone, LogIn, Sparkles, Camera, Video, Globe, Newspaper, UserCheck, Shield } from "lucide-react";
import { api } from "../lib/api";
import { apiErrorMessage } from "../lib/utils";
import { Button, Card, CardBody, Field, Input } from "../components/ui";
import { useAuth } from "../lib/auth";

const DEMO_ACCOUNTS = [
  {
    role: "Publisher",
    name: "Mizo Vibes Media",
    platform: "Instagram (185k)",
    email: "demo.influencer@agency.test",
    password: "demo1234",
    icon: Camera,
    color: "bg-gradient-to-br from-pink-500 to-purple-600 text-white",
  },
  {
    role: "Publisher",
    name: "Mizoram Tech Channel",
    platform: "YouTube (84k)",
    email: "demo.youtube@agency.test",
    password: "demo1234",
    icon: Video,
    color: "bg-red-600 text-white",
  },
  {
    role: "Publisher",
    name: "Mizoram News Daily",
    platform: "Website (950k/mo)",
    email: "demo.news@agency.test",
    password: "demo1234",
    icon: Globe,
    color: "bg-blue-600 text-white",
  },
  {
    role: "Publisher",
    name: "Mizoram Herald",
    platform: "Newspaper",
    email: "demo.paper@agency.test",
    password: "demo1234",
    icon: Newspaper,
    color: "bg-emerald-600 text-white",
  },
  {
    role: "Advertiser",
    name: "Lucky Clothing Store",
    platform: "Advertiser Account",
    email: "demo.advertiser@agency.test",
    password: "demo1234",
    icon: UserCheck,
    color: "bg-amber-600 text-white",
  },
  {
    role: "Admin",
    name: "Super Admin",
    platform: "Full System Admin",
    email: "lingtuka",
    password: "MAWLA1984@mala",
    icon: Shield,
    color: "bg-ink-900 text-white",
  },
];

export function LoginPage() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const search = useSearch({ from: "/login" }) as Record<string, unknown>;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function performLogin(targetEmail: string, targetPass: string) {
    setError("");
    setLoading(true);
    try {
      const res = await api.post<{ user: { role: string; must_change_password: boolean } }>("/api/auth/login", {
        email: targetEmail,
        password: targetPass,
      });
      await refresh();
      if (res.user.must_change_password) {
        navigate({ to: "/register" });
        return;
      }
      if (res.user.role === "advertiser" && typeof search.redirect === "string" && search.redirect) {
        const [path, query] = search.redirect.split("?");
        const params = new URLSearchParams(query ?? "");
        const s: Record<string, unknown> = {};
        params.forEach((v, k) => (s[k] = v));
        navigate({ to: path as never, search: s as never });
        return;
      }
      const target =
        res.user.role === "admin"
          ? "/admin"
          : res.user.role === "publisher"
            ? "/publisher/dashboard"
            : "/advertiser/dashboard";
      navigate({ to: target as never });
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await performLogin(email, password);
  }

  async function quickLogin(acc: (typeof DEMO_ACCOUNTS)[number]) {
    setEmail(acc.email);
    setPassword(acc.password);
    await performLogin(acc.email, acc.password);
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-12">
      <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-600/30">
        <Megaphone className="h-6 w-6" />
      </div>
      <h1 className="text-2xl font-bold text-ink-900">Welcome back</h1>
      <p className="mt-1 text-sm text-ink-500">Log in to manage campaigns, media kits or the marketplace.</p>

      {/* Quick Test Accounts Switcher */}
      <Card className="mt-6 w-full border-brand-200 bg-brand-50/40">
        <CardBody className="py-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand-700">
            <Sparkles className="h-4 w-4" /> Quick Test Accounts (One-Click Login)
          </div>
          <p className="mt-1 text-xs text-ink-600">Click any sample publisher or test account below to log in instantly:</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {DEMO_ACCOUNTS.map((acc) => {
              const Icon = acc.icon;
              return (
                <button
                  key={acc.email}
                  onClick={() => quickLogin(acc)}
                  disabled={loading}
                  className="flex items-center gap-3 rounded-xl border border-ink-200 bg-white p-2.5 text-left transition-all hover:border-brand-400 hover:shadow-sm"
                >
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${acc.color}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-ink-900">{acc.name}</p>
                    <p className="truncate text-[11px] text-ink-500">{acc.platform}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </CardBody>
      </Card>

      <Card className="mt-6 w-full">
        <CardBody className="pt-6">
          <form onSubmit={submit} className="space-y-4">
            <Field label="Email or username" required>
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
            </Field>
            <Field label="Password" required>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
            </Field>
            {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <Button type="submit" className="w-full" loading={loading} icon={<LogIn className="h-4 w-4" />}>
              Log in
            </Button>
          </form>
          <p className="mt-5 text-center text-sm text-ink-500">
            New here?{" "}
            <Link to="/register" className="font-semibold text-brand-600 hover:text-brand-700">
              Create an account
            </Link>
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
