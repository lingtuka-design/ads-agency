import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { Megaphone, LogIn, Sparkles, Camera, Video, Globe, Newspaper, Tv, UserCheck, Shield, ShoppingBag } from "lucide-react";
import { api } from "../lib/api";
import { apiErrorMessage } from "../lib/utils";
import { Button, Card, CardBody, Field, Input } from "../components/ui";
import { useAuth } from "../lib/auth";

interface DemoAccount {
  category: "publisher" | "advertiser" | "admin";
  name: string;
  platform: string;
  email: string;
  password: string;
  icon: any;
  color: string;
}

const DEMO_ACCOUNTS: DemoAccount[] = [
  // --- PUBLISHERS ---
  {
    category: "publisher",
    name: "Zofooty",
    platform: "Instagram (210k)",
    email: "zofooty@agency.test",
    password: "demo1234",
    icon: Camera,
    color: "bg-gradient-to-br from-pink-500 to-purple-600 text-white",
  },
  {
    category: "publisher",
    name: "inkhel",
    platform: "News & Sports Portal",
    email: "inkhel@agency.test",
    password: "demo1234",
    icon: Globe,
    color: "bg-blue-600 text-white",
  },
  {
    category: "publisher",
    name: "Zonet",
    platform: "Local TV Channel",
    email: "zonet@agency.test",
    password: "demo1234",
    icon: Tv,
    color: "bg-red-600 text-white",
  },
  {
    category: "publisher",
    name: "LPS",
    platform: "Local TV Channel",
    email: "lps@agency.test",
    password: "demo1234",
    icon: Tv,
    color: "bg-orange-600 text-white",
  },
  {
    category: "publisher",
    name: "Vanglaini",
    platform: "Newspaper",
    email: "vanglaini@agency.test",
    password: "demo1234",
    icon: Newspaper,
    color: "bg-emerald-600 text-white",
  },
  {
    category: "publisher",
    name: "ZiraPC",
    platform: "YouTube Tech",
    email: "zirapc@agency.test",
    password: "demo1234",
    icon: Video,
    color: "bg-red-600 text-white",
  },
  {
    category: "publisher",
    name: "Aizawl Post",
    platform: "Newspaper",
    email: "aizawlpost@agency.test",
    password: "demo1234",
    icon: Newspaper,
    color: "bg-teal-600 text-white",
  },
  {
    category: "publisher",
    name: "Mizo Vibes Media",
    platform: "Instagram (185k)",
    email: "demo.influencer@agency.test",
    password: "demo1234",
    icon: Camera,
    color: "bg-purple-600 text-white",
  },
  {
    category: "publisher",
    name: "Mizoram Tech Channel",
    platform: "YouTube (84k)",
    email: "demo.youtube@agency.test",
    password: "demo1234",
    icon: Video,
    color: "bg-red-500 text-white",
  },
  {
    category: "publisher",
    name: "Mizoram News Daily",
    platform: "Website (950k/mo)",
    email: "demo.news@agency.test",
    password: "demo1234",
    icon: Globe,
    color: "bg-sky-600 text-white",
  },
  {
    category: "publisher",
    name: "Mizoram Herald",
    platform: "Newspaper",
    email: "demo.paper@agency.test",
    password: "demo1234",
    icon: Newspaper,
    color: "bg-slate-700 text-white",
  },

  // --- ADVERTISERS ---
  {
    category: "advertiser",
    name: "Adidas Mizoram",
    platform: "Sports & Apparel",
    email: "adidas@agency.test",
    password: "demo1234",
    icon: ShoppingBag,
    color: "bg-indigo-600 text-white",
  },
  {
    category: "advertiser",
    name: "Music Inn",
    platform: "Instruments & Audio",
    email: "musicinn@agency.test",
    password: "demo1234",
    icon: UserCheck,
    color: "bg-violet-600 text-white",
  },
  {
    category: "advertiser",
    name: "Kimkim Sofa",
    platform: "Furniture & Decor",
    email: "kimkim@agency.test",
    password: "demo1234",
    icon: ShoppingBag,
    color: "bg-amber-600 text-white",
  },
  {
    category: "advertiser",
    name: "Orient Goldsmith",
    platform: "Jewelry & Gold",
    email: "orient@agency.test",
    password: "demo1234",
    icon: UserCheck,
    color: "bg-yellow-600 text-white",
  },
  {
    category: "advertiser",
    name: "Lucky Clothing Store",
    platform: "Retail & Fashion",
    email: "demo.advertiser@agency.test",
    password: "demo1234",
    icon: UserCheck,
    color: "bg-rose-600 text-white",
  },

  // --- ADMIN ---
  {
    category: "admin",
    name: "Agency Admin",
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
  const [activeTab, setActiveTab] = useState<"all" | "publisher" | "advertiser" | "admin">("all");

  const filteredAccounts = DEMO_ACCOUNTS.filter(
    (acc) => activeTab === "all" || acc.category === activeTab,
  );

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

  async function quickLogin(acc: DemoAccount) {
    setEmail(acc.email);
    setPassword(acc.password);
    await performLogin(acc.email, acc.password);
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center px-4 py-10">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-600/30">
        <Megaphone className="h-6 w-6" />
      </div>
      <h1 className="text-2xl font-bold text-ink-900">Welcome back</h1>
      <p className="mt-1 text-sm text-ink-500">Log in to manage campaigns, media kits or the marketplace.</p>

      {/* Quick Test Accounts Switcher */}
      <Card className="mt-6 w-full border-brand-200 bg-brand-50/40">
        <CardBody className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand-700">
              <Sparkles className="h-4 w-4" /> Quick Test Accounts (One-Click Login)
            </div>
            <span className="text-[11px] font-semibold text-ink-500">{DEMO_ACCOUNTS.length} accounts</span>
          </div>

          {/* Filter Pills */}
          <div className="mt-3 flex flex-wrap gap-1.5 border-b border-brand-200/60 pb-2">
            {[
              { id: "all", label: "All Accounts", count: DEMO_ACCOUNTS.length },
              { id: "publisher", label: "Publishers", count: DEMO_ACCOUNTS.filter((a) => a.category === "publisher").length },
              { id: "advertiser", label: "Advertisers", count: DEMO_ACCOUNTS.filter((a) => a.category === "advertiser").length },
              { id: "admin", label: "Admin", count: 1 },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                  activeTab === tab.id
                    ? "bg-brand-600 text-white shadow-sm"
                    : "bg-white text-ink-600 hover:bg-brand-100/50 hover:text-brand-800"
                }`}
              >
                {tab.label} ({tab.count})
              </button>
            ))}
          </div>

          {/* Account Grid */}
          <div className="mt-3 grid gap-2 max-h-72 overflow-y-auto pr-1 sm:grid-cols-2">
            {filteredAccounts.map((acc) => {
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
                    <div className="flex items-center justify-between gap-1">
                      <p className="truncate text-xs font-bold text-ink-900">{acc.name}</p>
                      <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                        acc.category === "admin"
                          ? "bg-ink-900 text-white"
                          : acc.category === "publisher"
                            ? "bg-purple-100 text-purple-700"
                            : "bg-amber-100 text-amber-700"
                      }`}>
                        {acc.category}
                      </span>
                    </div>
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
