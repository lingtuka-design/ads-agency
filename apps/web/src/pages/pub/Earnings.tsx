import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Wallet, TrendingUp } from "lucide-react";
import { api } from "../../lib/api";
import { formatMoney, formatDate } from "../../lib/utils";
import { Badge, Card, CardBody, CardHeader, EmptyState, PageLoader, StatCard } from "../../components/ui";

interface Settlement {
  id: string;
  status: string;
  amount: number;
  method: string | null;
  payout_ref: string | null;
  paid_at: string | null;
  created_at: string;
  notes: string | null;
  item_count: number;
}

export function PubEarningsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["pub", "earnings"],
    queryFn: () => api.get<{ totals: { earned: number; pending: number; paid: number }; settlements: Settlement[] }>("/api/publishers/me/earnings"),
  });

  if (isLoading) return <PageLoader />;

  const t = data?.totals ?? { earned: 0, pending: 0, paid: 0 };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">Earnings & Settlements</h1>
        <p className="mt-1 text-sm text-ink-500">The agency collects from advertisers, deducts commission, and settles you.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total earnings" value={formatMoney(t.earned)} sub="gross publisher amount" icon={<TrendingUp className="h-5 w-5" />} tone="green" />
        <StatCard label="Pending settlement" value={formatMoney(t.pending)} sub="to be settled by agency" icon={<Wallet className="h-5 w-5" />} tone="amber" />
        <StatCard label="Paid out" value={formatMoney(t.paid)} sub="completed settlements" icon={<Wallet className="h-5 w-5" />} />
      </div>

      <Card>
        <CardHeader title="Settlement history" subtitle="Every payout with reference" />
        {!data?.settlements.length ? (
          <EmptyState
            icon={<Wallet className="h-6 w-6" />}
            title="No settlements yet"
            description="Once campaigns are paid and verified, the agency creates settlements for you."
          />
        ) : (
          <div className="divide-y divide-ink-100">
            {data.settlements.map((s) => (
              <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div>
                  <p className="text-sm font-semibold text-ink-900">{formatMoney(s.amount)}</p>
                  <p className="text-xs text-ink-400">
                    {formatDate(s.created_at)} · {s.method ?? "Bank transfer"} {s.item_count > 0 && `· ${s.item_count} booking(s)`}
                  </p>
                  {s.notes && <p className="mt-0.5 text-xs text-ink-500">{s.notes}</p>}
                </div>
                <div className="flex items-center gap-3">
                  {s.payout_ref && <Badge tone="slate">{s.payout_ref}</Badge>}
                  <Badge tone={s.status === "PAID" ? "green" : s.status === "FAILED" || s.status === "CANCELLED" ? "red" : "amber"}>{s.status}</Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title="How settlements work" />
        <CardBody className="space-y-1.5 text-sm text-ink-500">
          <p>1. Advertiser pays the agency — payment is verified server-side.</p>
          <p>2. Agency commission is deducted (recorded permanently at booking time).</p>
          <p>3. The agency creates a settlement for your earnings.</p>
          <p>4. After review, the agency pays you and records the payout reference.</p>
          <p className="pt-2">
            <Link to="/publisher/profile" className="font-semibold text-brand-600 hover:underline">Manage your payout details →</Link>
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
