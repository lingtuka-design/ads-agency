import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Package, CalendarCheck, Wallet, TrendingUp, ArrowRight, UserCog } from "lucide-react";
import { api } from "../../lib/api";
import { formatMoney, formatNumber, titleCase } from "../../lib/utils";
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, PageLoader, StatCard, StatusBadge } from "../../components/ui";

interface PublisherMe {
  publisher: {
    id: string;
    name: string;
    slug: string;
    status: string;
    trust_level: string;
    verified: number;
    featured: number;
    logo_url: string | null;
    description: string | null;
  };
  stats: {
    platform: string;
    followers: number;
    subscribers: number | null;
    engagement_rate: number | null;
    avg_reach: number | null;
    primary_age_group: string | null;
    audience_location: string | null;
  } | null;
}

interface BookingItem {
  id: string;
  status: string;
  amount: number;
  package_title: string;
  campaign_name: string;
  advertiser_name: string;
  created_at: string;
}

export function PubDashboardPage() {
  const { data: me, isLoading } = useQuery({
    queryKey: ["pub", "me"],
    queryFn: () => api.get<PublisherMe>("/api/publishers/me"),
  });
  const { data: earnings } = useQuery({
    queryKey: ["pub", "earnings"],
    queryFn: () => api.get<{ totals: { earned: number; pending: number; paid: number } }>("/api/publishers/me/earnings"),
    enabled: !!me,
  });
  const { data: bookings } = useQuery({
    queryKey: ["pub", "bookings"],
    queryFn: () => api.get<{ items: BookingItem[]; total: number }>("/api/publishers/me/bookings"),
    enabled: !!me,
  });
  const { data: packages } = useQuery({
    queryKey: ["pub", "packages"],
    queryFn: () => api.get<unknown[]>("/api/publishers/me/packages"),
    enabled: !!me,
  });

  if (isLoading) return <PageLoader />;
  const p = me?.publisher;

  if (p && !["APPROVED", "ACTIVE"].includes(p.status)) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-ink-900">Publisher Dashboard</h1>
        <Card>
          <CardBody className="space-y-4">
            <Badge tone={p.status === "PENDING" ? "amber" : p.status === "REJECTED" ? "red" : "slate"}>{titleCase(p.status)}</Badge>
            <h2 className="text-lg font-bold text-ink-900">
              {p.status === "PENDING" ? "Your application is under review" : p.status === "REJECTED" ? "Your application was not approved" : "Account on hold"}
            </h2>
            <p className="text-sm text-ink-500">
              {p.status === "PENDING"
                ? "The agency reviews every publisher before activation. Complete your media kit so we can verify you faster."
                : "Contact the agency to resolve this."}
            </p>
            <Link to="/publisher/profile"><Button icon={<UserCog className="h-4 w-4" />}>Complete media kit</Button></Link>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Publisher Dashboard</h1>
          <p className="mt-1 text-sm text-ink-500">{p?.name} · {p?.status} · {p?.trust_level}</p>
        </div>
        <Link to="/publisher/profile"><Button variant="outline" icon={<UserCog className="h-4 w-4" />}>Edit Media Kit</Button></Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total earnings" value={formatMoney(earnings?.totals.earned ?? 0)} sub="from all campaigns" icon={<Wallet className="h-5 w-5" />} tone="green" />
        <StatCard label="Pending settlement" value={formatMoney(earnings?.totals.pending ?? 0)} sub="awaiting payout" icon={<Wallet className="h-5 w-5" />} tone="amber" />
        <StatCard label="Packages" value={packages?.length ?? 0} sub="advertising inventory" icon={<Package className="h-5 w-5" />} tone="blue" />
        <StatCard label="Bookings" value={bookings?.total ?? 0} sub="all time" icon={<CalendarCheck className="h-5 w-5" />} />
      </div>

      {me?.stats && (
        <Card>
          <CardHeader title="Your audience" subtitle="Your sales pitch to advertisers" action={<Link to="/publisher/profile" className="text-xs font-semibold text-brand-600">Update stats</Link>} />
          <CardBody className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-7">
            {[
              ["Followers", formatNumber(me.stats.followers)],
              ["Reach", me.stats.avg_reach != null ? formatNumber(me.stats.avg_reach) : "—"],
              ["Engagement", me.stats.engagement_rate != null ? `${me.stats.engagement_rate}%` : "—"],
              ["Audience", me.stats.primary_age_group ?? "—"],
              ["Location", me.stats.audience_location ?? "—"],
              ["Platform", me.stats.platform],
              ["Subscribers", me.stats.subscribers != null ? formatNumber(me.stats.subscribers) : "—"],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl bg-ink-50 p-3 text-center">
                <p className="text-base font-bold text-ink-900">{v}</p>
                <p className="text-[10px] uppercase tracking-wide text-ink-400">{k}</p>
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Recent bookings" action={<Link to="/publisher/bookings" className="text-xs font-semibold text-brand-600">View all</Link>} />
          {!bookings?.items.length ? (
            <EmptyState
              icon={<CalendarCheck className="h-6 w-6" />}
              title="No bookings yet"
              description="Once advertisers book your packages, they appear here."
              action={<Link to="/publisher/packages"><Button size="sm">Create a package</Button></Link>}
            />
          ) : (
            <div className="divide-y divide-ink-100">
              {bookings.items.slice(0, 5).map((b) => (
                <Link key={b.id} to="/publisher/bookings/$id" params={{ id: b.id }} className="flex items-center justify-between gap-3 px-5 py-3.5 transition-colors hover:bg-ink-50">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink-900">{b.package_title}</p>
                    <p className="text-xs text-ink-400">{b.advertiser_name} · {b.campaign_name}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold">{formatMoney(b.amount)}</span>
                    <StatusBadge status={b.status} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="Quick actions" />
          <CardBody className="space-y-2.5">
            {[
              { icon: <Package className="h-4 w-4" />, to: "/publisher/packages", label: "Manage advertising packages & inventory" },
              { icon: <TrendingUp className="h-4 w-4" />, to: "/publisher/earnings", label: "View earnings & settlements" },
              { icon: <UserCog className="h-4 w-4" />, to: "/publisher/profile", label: "Update media kit & audience stats" },
            ].map((a) => (
              <Link key={a.label} to={a.to} className="flex items-center justify-between rounded-xl border border-ink-200 px-3.5 py-3 text-sm font-medium text-ink-700 transition-colors hover:border-brand-300 hover:bg-brand-50/40">
                <span className="flex items-center gap-2.5">{a.icon}{a.label}</span>
                <ArrowRight className="h-4 w-4 text-ink-300" />
              </Link>
            ))}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
