import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Compass, Plus, Search } from "lucide-react";
import { api } from "../../lib/api";
import { formatDate, formatMoney } from "../../lib/utils";
import { Card, EmptyState, PageLoader, StatusBadge, Button } from "../../components/ui";

interface CampaignItem {
  id: string;
  name: string;
  status: string;
  total_amount: number;
  currency: string;
  start_date: string;
  end_date: string;
  booking_count: number;
  completed_count: number;
  created_at: string;
}

export function AdvCampaignsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["adv", "campaigns"],
    queryFn: () => api.get<CampaignItem[]>("/api/bookings/campaigns"),
  });

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">My Campaigns</h1>
          <p className="mt-1 text-sm text-ink-500">Every booking becomes a campaign with its own timeline and status.</p>
        </div>
        <Link to="/advertiser/publishers"><Button icon={<Plus className="h-4 w-4" />}>New Campaign</Button></Link>
      </div>

      {!data?.length ? (
        <Card>
          <EmptyState
            icon={<Compass className="h-6 w-6" />}
            title="No campaigns yet"
            description="Your next campaign starts here. Find a publisher, book a package, and the agency handles the rest."
            action={<Link to="/advertiser/publishers"><Button icon={<Search className="h-4 w-4" />}>Find Publishers</Button></Link>}
          />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {data.map((c) => (
            <Link key={c.id} to="/advertiser/campaigns/$id" params={{ id: c.id }}>
              <Card className="p-5 transition-all hover:-translate-y-0.5 hover:shadow-lg">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-ink-900">{c.name}</h3>
                    <p className="mt-1 text-xs text-ink-400">{formatDate(c.start_date)} → {formatDate(c.end_date)}</p>
                  </div>
                  <StatusBadge status={c.status} />
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-ink-100 pt-3">
                  <span className="text-sm text-ink-500">{c.booking_count} booking(s) · {c.completed_count} completed</span>
                  <span className="text-lg font-bold text-ink-900">{formatMoney(c.total_amount)}</span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
