import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { Megaphone, LogIn } from "lucide-react";
import { api } from "../lib/api";
import { apiErrorMessage } from "../lib/utils";
import { Button, Card, CardBody, Field, Input } from "../components/ui";
import { useAuth } from "../lib/auth";

export function LoginPage() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const search = useSearch({ from: "/login" }) as Record<string, unknown>;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.post<{ user: { role: string; must_change_password: boolean } }>("/api/auth/login", { email, password });
      await refresh();
      if (res.user.must_change_password) {
        navigate({ to: "/register" });
        return;
      }
      const target = (search.redirect as string) ?? (res.user.role === "admin" ? "/admin" : res.user.role === "publisher" ? "/publisher/dashboard" : "/advertiser/dashboard");
      navigate({ to: target as never });
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-16">
      <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-600/30">
        <Megaphone className="h-6 w-6" />
      </div>
      <h1 className="text-2xl font-bold text-ink-900">Welcome back</h1>
      <p className="mt-1 text-sm text-ink-500">Log in to manage campaigns, media kits or the marketplace.</p>
      <Card className="mt-8 w-full">
        <CardBody className="pt-6">
          <form onSubmit={submit} className="space-y-4">
            <Field label="Email or username" required>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" required />
            </Field>
            <Field label="Password" required>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" required />
            </Field>
            {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <Button type="submit" className="w-full" loading={loading} icon={<LogIn className="h-4 w-4" />}>
              Log in
            </Button>
          </form>
          <p className="mt-5 text-center text-sm text-ink-500">
            New here? <Link to="/register" className="font-semibold text-brand-600 hover:text-brand-700">Create an account</Link>
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
