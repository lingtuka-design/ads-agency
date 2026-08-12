import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarCheck } from "lucide-react";
import { api } from "../../lib/api";
import { formatDateTime, formatMoney } from "../../lib/utils";
import { Badge, Card, CardHeader, EmptyState, PageLoader, StatusBadge } from "../../components/ui";

interface BookingItem {
  id: string;
  status: string;
  amount: number;
  package_title: string;
  campaign_name: string;
  advertiser_name: string;
  created_at: string;
  has_creative: number;
  pub_dates: string | null;
  pending_dates: number;
}

export function PubBookingsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["pub", "bookings"],
    queryFn: () => api.get<{ items: BookingItem[]; total: number }>("/api/publishers/me/bookings"),
  });

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">Bookings</h1>
        <p className="mt-1 text-sm text-ink-500">Campaigns booked on your inventory — approve, schedule, publish and provide proof.</p>
      </div>
      <Card>
        <CardHeader title="All bookings" subtitle={`${data?.total ?? 0} total`} />
        {!data?.items.length ? (
          <EmptyState
            icon={<CalendarCheck className="h-6 w-6" />}
            title="No bookings yet"
            description="Your packages are live on the marketplace. When advertisers book, they show up here."
            action={<Link to="/publisher/packages"><span className="text-sm font-semibold text-brand-600">View my packages →</span></Link>}
          />
        ) : (
          <div className="divide-y divide-ink-100">
            {data.items.map((b) => (
              <Link key={b.id} to="/publisher/bookings/$id" params={{ id: b.id }} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-ink-50">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-ink-900">{b.package_title}</p>
                    {b.has_creative ? <Badge tone="green">Creative ready</Badge> : <Badge tone="amber">Creative pending</Badge>}
                    {(b.pending_dates ?? 0) > 0 && <Badge tone="amber">{b.pending_dates} date(s) awaiting approval</Badge>}
                  </div>
                  <p className="mt-0.5 text-xs text-ink-400">{b.advertiser_name} · {b.campaign_name} · {formatDateTime(b.created_at)}</p>
                  {b.pub_dates && (
                    <p className="mt-1 text-xs text-brand-700">
                      <span className="font-semibold">Requested dates:</span> {b.pub_dates}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-ink-900">{formatMoney(b.amount)}</span>
                  <StatusBadge status={b.status} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
