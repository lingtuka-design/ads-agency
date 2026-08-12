import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarCheck } from "lucide-react";
import { api } from "../../lib/api";
import { formatDateTime, formatMoney } from "../../lib/utils";
import { Card, EmptyState, PageLoader, StatusBadge, Badge } from "../../components/ui";

interface Booking {
  id: string;
  status: string;
  amount: number;
  currency: string;
  quantity: number;
  created_at: string;
  package_title: string;
  platform: string;
  publisher_name: string;
  publisher_slug: string;
  campaign_name: string;
  start_date: string;
  end_date: string;
}

export function AdvBookingsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["adv", "bookings"],
    queryFn: () => api.get<{ items: Booking[] }>("/api/bookings"),
  });

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">My Bookings</h1>
        <p className="mt-1 text-sm text-ink-500">All your advertising bookings and their live status.</p>
      </div>
      {!data?.items.length ? (
        <Card>
          <EmptyState
            icon={<CalendarCheck className="h-6 w-6" />}
            title="No bookings yet"
            description="Browse the marketplace and book your first advertising package."
            action={<Link to="/advertiser/publishers" className="text-sm font-semibold text-brand-600">Find Publishers →</Link>}
          />
        </Card>
      ) : (
        <Card className="divide-y divide-ink-100">
          {data.items.map((b) => (
            <Link key={b.id} to="/advertiser/bookings/$id" params={{ id: b.id }} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-ink-50">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-ink-900">{b.package_title}</p>
                  <Badge tone="blue">{b.platform}</Badge>
                </div>
                <p className="mt-0.5 text-xs text-ink-400">
                  {b.publisher_name} · {b.campaign_name} · {formatDateTime(b.created_at)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-bold text-ink-900">{formatMoney(b.amount)}</span>
                <StatusBadge status={b.status} />
              </div>
            </Link>
          ))}
        </Card>
      )}
    </div>
  );
}
