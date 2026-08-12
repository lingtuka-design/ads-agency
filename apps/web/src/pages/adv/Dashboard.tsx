import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Compass, Search, Sparkles, Images, ArrowRight, CreditCard, Wallet, Radio } from "lucide-react";
import { api } from "../../lib/api";
import { formatDate, formatMoney, titleCase } from "../../lib/utils";
import { Badge, Card, CardBody, CardHeader, PageLoader, StatCard, StatusBadge, EmptyState, Button } from "../../components/ui";

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

interface PaymentItem {
  id: string;
  amount: number;
  status: string;
  created_at: string;
  package_title: string;
}

interface LiveBooking {
  id: string;
  status: string;
  package_title: string;
  publisher_name: string;
  platform: string;
  campaign_name: string;
  scheduled_start: string | null;
  scheduled_end: string | null;
}

export function AdvDashboardPage() {
  const { data: campaigns, isLoading } = useQuery({
    queryKey: ["adv", "campaigns"],
    queryFn: () => api.get<CampaignItem[]>("/api/bookings/campaigns"),
  });
  const { data: payments } = useQuery({
    queryKey: ["adv", "payments"],
    queryFn: () => api.get<{ items: PaymentItem[] }>("/api/payments"),
  });
  const { data: liveBookings } = useQuery({
    queryKey: ["adv", "live"],
    queryFn: () => api.get<{ items: LiveBooking[] }>("/api/bookings?status=LIVE&pageSize=20"),
    refetchInterval: 20_000,
  });

  if (isLoading) return <PageLoader />;

  const totalSpent = (payments?.items ?? []).filter((p) => p.status === "SUCCESSFUL").reduce((s, p) => s + p.amount, 0);
  const active = (campaigns ?? []).filter((c) => !["COMPLETED", "CANCELLED"].includes(c.status)).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">Advertiser Dashboard</h1>
        <p className="mt-1 text-sm text-ink-500">Discover publishers, book campaigns and track everything in one place.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Campaigns" value={campaigns?.length ?? 0} sub={`${active} active`} icon={<Compass className="h-5 w-5" />} />
        <StatCard label="Total spend" value={formatMoney(totalSpent)} sub="all time" icon={<CreditCard className="h-5 w-5" />} tone="blue" />
        <StatCard label="Bookings paid" value={(payments?.items ?? []).filter((p) => p.status === "SUCCESSFUL").length} sub="confirmed campaigns" icon={<Wallet className="h-5 w-5" />} tone="green" />
        <StatCard label="Quick action" value={<Link to="/advertiser/assistant"><Button size="sm" icon={<Sparkles className="h-4 w-4" />}>Ask the AI Assistant</Button></Link>} sub="find the perfect publisher" icon={<Sparkles className="h-5 w-5" />} tone="violet" />
      </div>

      {(liveBookings?.items?.length ?? 0) > 0 && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-600" />
            </span>
            <h2 className="text-base font-bold text-emerald-900">Your ads are running right now</h2>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {liveBookings!.items.map((lb) => (
              <Link key={lb.id} to="/advertiser/bookings/$id" params={{ id: lb.id }} className="rounded-xl border border-emerald-200 bg-white p-4 transition-all hover:-translate-y-0.5 hover:shadow-md">
                <div className="flex items-center justify-between gap-2">
                  <Radio className="h-4 w-4 text-emerald-600" />
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">Live</span>
                </div>
                <p className="mt-2 font-semibold text-ink-900">{lb.package_title}</p>
                <p className="text-xs text-ink-500">{lb.publisher_name} · {lb.platform}</p>
                {lb.scheduled_end && <p className="mt-1 text-[11px] text-ink-400">running until {formatDate(lb.scheduled_end)}</p>}
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="My Campaigns"
            subtitle="Latest first"
            action={<Link to="/advertiser/campaigns" className="text-xs font-semibold text-brand-600">View all</Link>}
          />
          {!campaigns?.length ? (
            <EmptyState
              icon={<Search className="h-6 w-6" />}
              title="No campaigns yet"
              description="Your next campaign starts here. Find a publisher and book your first advertising package."
              action={<Link to="/advertiser/publishers"><Button size="sm">Find Publishers</Button></Link>}
            />
          ) : (
            <div className="divide-y divide-ink-100">
              {campaigns.slice(0, 5).map((c) => (
                <Link key={c.id} to="/advertiser/campaigns/$id" params={{ id: c.id }} className="flex items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-ink-50">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink-900">{c.name}</p>
                    <p className="mt-0.5 text-xs text-ink-400">
                      {formatDate(c.start_date)} → {formatDate(c.end_date)} · {c.booking_count} booking(s)
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-ink-900">{formatMoney(c.total_amount)}</span>
                    <StatusBadge status={c.status} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Get started" />
            <CardBody className="space-y-2.5">
              {[
                { icon: <Search className="h-4 w-4" />, to: "/advertiser/publishers", label: "Find publishers & packages" },
                { icon: <Compass className="h-4 w-4" />, to: "/advertiser/campaigns", label: "Start a campaign" },
                { icon: <Images className="h-4 w-4" />, to: "/advertiser/creative-studio", label: "Request a design" },
                { icon: <Sparkles className="h-4 w-4" />, to: "/advertiser/assistant", label: "Talk to the AI assistant" },
              ].map((a) => (
                <Link key={a.label} to={a.to} className="flex items-center justify-between rounded-xl border border-ink-200 px-3.5 py-3 text-sm font-medium text-ink-700 transition-colors hover:border-brand-300 hover:bg-brand-50/40">
                  <span className="flex items-center gap-2.5">{a.icon}{a.label}</span>
                  <ArrowRight className="h-4 w-4 text-ink-300" />
                </Link>
              ))}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Recent payments" />
            {!payments?.items.length ? (
              <CardBody className="text-sm text-ink-400">No payments yet.</CardBody>
            ) : (
              <div className="divide-y divide-ink-100">
                {payments.items.slice(0, 4).map((p) => (
                  <div key={p.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-xs font-medium text-ink-700">{p.package_title}</p>
                      <p className="text-[11px] text-ink-400">{formatDate(p.created_at)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold">{formatMoney(p.amount)}</span>
                      <Badge tone={p.status === "SUCCESSFUL" ? "green" : "amber"}>{titleCase(p.status)}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
