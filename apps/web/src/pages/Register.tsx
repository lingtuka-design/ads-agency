import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { Megaphone, UserPlus, Store } from "lucide-react";
import { api } from "../lib/api";
import { apiErrorMessage } from "../lib/utils";
import { Button, Card, CardBody, Field, Input } from "../components/ui";
import { useAuth } from "../lib/auth";
import { cn } from "../lib/utils";

export function RegisterPage() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const search = useSearch({ from: "/register" }) as Record<string, unknown>;
  const initialRole = search.role === "publisher" ? "publisher" : "advertiser";
  const [role, setRole] = useState<"advertiser" | "publisher">(initialRole);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [industry, setIndustry] = useState("");
  const [location, setLocation] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.post<{ user: { role: string } }>("/api/auth/register", {
        name,
        email,
        password,
        phone: phone || null,
        role,
        companyName: role === "advertiser" ? companyName || name : null,
        industry: role === "advertiser" ? industry || null : null,
        location: location || null,
        publisherName: role === "publisher" ? name : null,
      });
      await refresh();
      navigate({ to: res.user.role === "publisher" ? "/publisher/dashboard" : "/advertiser/dashboard" });
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-14">
      <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-600/30">
        <Megaphone className="h-6 w-6" />
      </div>
      <h1 className="text-2xl font-bold text-ink-900">Create your account</h1>
      <p className="mt-1 text-center text-sm text-ink-500">Join the advertising marketplace — advertisers book, publishers earn.</p>

      <div className="mt-6 grid w-full grid-cols-2 gap-3">
        {([
          { id: "advertiser", label: "I'm an Advertiser", sub: "Book campaigns & creatives", icon: <UserPlus className="h-5 w-5" /> },
          { id: "publisher", label: "I'm a Publisher", sub: "Sell my audience reach", icon: <Store className="h-5 w-5" /> },
        ] as const).map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setRole(r.id)}
            className={cn(
              "rounded-2xl border-2 p-4 text-left transition-all",
              role === r.id ? "border-brand-500 bg-brand-50 shadow-sm" : "border-ink-200 bg-white hover:border-ink-300",
            )}
          >
            <span className={cn("mb-2 flex h-9 w-9 items-center justify-center rounded-xl", role === r.id ? "bg-brand-600 text-white" : "bg-ink-100 text-ink-500")}>
              {r.icon}
            </span>
            <p className="text-sm font-semibold text-ink-900">{r.label}</p>
            <p className="text-xs text-ink-500">{r.sub}</p>
          </button>
        ))}
      </div>

      <Card className="mt-5 w-full">
        <CardBody className="pt-6">
          <form onSubmit={submit} className="space-y-4">
            <Field label={role === "publisher" ? "Publisher / page name" : "Your name"} required>
              <Input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
            </Field>
            <Field label="Email" required>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </Field>
            <Field label="Password" required hint="Minimum 8 characters">
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
            </Field>
            <Field label="Phone (optional)">
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </Field>
            {role === "advertiser" && (
              <>
                <Field label="Company / organization (optional)">
                  <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="e.g. Lucky Clothing Store" />
                </Field>
                <Field label="Industry (optional)">
                  <Input value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="Retail, School, Government…" />
                </Field>
              </>
            )}
            <Field label="Location (optional)">
              <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Aizawl, Mizoram" />
            </Field>
            {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <Button type="submit" className="w-full" loading={loading}>
              {role === "publisher" ? "Create Publisher Account" : "Create Advertiser Account"}
            </Button>
          </form>
          <p className="mt-5 text-center text-sm text-ink-500">
            Already registered? <Link to="/login" className="font-semibold text-brand-600 hover:text-brand-700">Log in</Link>
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
