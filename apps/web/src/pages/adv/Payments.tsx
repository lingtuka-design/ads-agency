import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CreditCard } from "lucide-react";
import { api } from "../../lib/api";
import { formatDate, formatMoney, titleCase } from "../../lib/utils";
import { Badge, Card, CardHeader, EmptyState, PageLoader } from "../../components/ui";

interface Payment {
  id: string;
  amount: number;
  currency: string;
  status: string;
  method: string | null;
  provider: string | null;
  provider_ref: string | null;
  paid_at: string | null;
  created_at: string;
  booking_id: string;
  package_title: string;
}

export function AdvPaymentsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["adv", "payments"],
    queryFn: () => api.get<{ items: Payment[] }>("/api/payments"),
  });

  if (isLoading) return <PageLoader />;

  const items = data?.items ?? [];
  const total = items.filter((p) => p.status === "SUCCESSFUL").reduce((s, p) => s + p.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Payments</h1>
          <p className="mt-1 text-sm text-ink-500">Total paid: <span className="font-bold text-ink-900">{formatMoney(total)}</span> — every payment goes through the agency.</p>
        </div>
      </div>
      <Card>
        <CardHeader title="Payment history" subtitle="Server-side verified, with full event records" />
        {!items.length ? (
          <EmptyState
            icon={<CreditCard className="h-6 w-6" />}
            title="No payments yet"
            description="Book a package and complete checkout to see your payments here."
          />
        ) : (
          <div className="divide-y divide-ink-100">
            {items.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div>
                  <p className="text-sm font-medium text-ink-900">{p.package_title}</p>
                  <p className="text-xs text-ink-400">
                    {p.provider ?? "manual"} · {p.provider_ref} · {formatDate(p.created_at)} {p.method && `· ${titleCase(p.method)}`}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-ink-900">{formatMoney(p.amount)}</span>
                  <Badge tone={p.status === "SUCCESSFUL" ? "green" : p.status === "FAILED" ? "red" : "amber"}>{titleCase(p.status)}</Badge>
                  {p.booking_id && (
                    <Link to="/advertiser/bookings/$id" params={{ id: p.booking_id }} className="text-xs font-semibold text-brand-600 hover:underline">
                      Booking
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
