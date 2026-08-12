import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, CartesianGrid } from "recharts";
import { Users, Store, CalendarCheck, Wallet, TrendingUp, Scale, Images } from "lucide-react";
import { api } from "../../lib/api";
import { formatMoney } from "../../lib/utils";
import { Card, CardBody, CardHeader, PageLoader, Select, StatCard } from "../../components/ui";

interface Overview {
  counts: {
    advertisers: number;
    publishers: number;
    campaigns: number;
    active_campaigns: number;
    pending_bookings: number;
    completed_campaigns: number;
    creative_requests: number;
    open_disputes: number;
    failed_payments: number;
  };
  revenue: {
    revenue: number;
    revenue_total: number;
    commission: number;
    publisher_payable: number;
  };
  booking_volume: { n: number; gross: number };
  settlements: { pending: number; paid: number };
  disputes: number;
  monthly: { month: string; bookings: number; revenue: number }[];
  top_publishers: { name: string; bookings: number; revenue: number }[];
}

export function AdmOverviewPage() {
  const [period, setPeriod] = useState("month");
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "overview", period],
    queryFn: () => api.get<Overview>("/api/admin/overview?period=" + period),
  });

  if (isLoading || !data) return <PageLoader />;

  const c = data.counts ?? {};
  const r = data.revenue ?? {};

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Agency Overview</h1>
          <p className="mt-1 text-sm text-ink-500">Real-time KPIs across the whole marketplace.</p>
        </div>
        <Select value={period} onChange={(e) => setPeriod(e.target.value)} className="w-36">
          <option value="day">Today</option>
          <option value="week">This week</option>
          <option value="month">This month</option>
          <option value="year">This year</option>
        </Select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Revenue (period)" value={formatMoney(r.revenue)} sub={`all time: ${formatMoney(r.revenue_total)}`} icon={<TrendingUp className="h-5 w-5" />} />
        <StatCard label="Agency commission" value={formatMoney(r.commission)} sub="deducted from campaigns" icon={<Wallet className="h-5 w-5" />} tone="green" />
        <StatCard label="Publisher payable" value={formatMoney(r.publisher_payable)} sub="before settlements" icon={<Wallet className="h-5 w-5" />} tone="amber" />
        <StatCard label="Active campaigns" value={c.active_campaigns ?? 0} sub={`${c.pending_bookings ?? 0} pending bookings`} icon={<CalendarCheck className="h-5 w-5" />} tone="blue" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Advertisers" value={c.advertisers ?? 0} icon={<Users className="h-5 w-5" />} />
        <StatCard label="Publishers" value={c.publishers ?? 0} icon={<Store className="h-5 w-5" />} />
        <StatCard label="Open disputes" value={c.open_disputes ?? 0} icon={<Scale className="h-5 w-5" />} tone="pink" />
        <StatCard label="Creative requests" value={c.creative_requests ?? 0} icon={<Images className="h-5 w-5" />} tone="violet" />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Revenue & bookings — last 12 months" />
          <CardBody className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.monthly}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Area type="monotone" dataKey="revenue" stroke="#6366f1" fill="url(#rev)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Top publishers by revenue" />
          <CardBody className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.top_publishers}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="revenue" fill="#4f46e5" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader title="Settlements" />
          <CardBody className="flex items-center justify-around text-center">
            <div><p className="text-2xl font-bold text-amber-600">{formatMoney(data.settlements?.pending ?? 0)}</p><p className="text-xs text-ink-400">Pending</p></div>
            <div><p className="text-2xl font-bold text-emerald-600">{formatMoney(data.settlements?.paid ?? 0)}</p><p className="text-xs text-ink-400">Paid</p></div>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Booking volume (period)" />
          <CardBody className="text-center">
            <p className="text-3xl font-bold text-ink-900">{data.booking_volume?.n ?? 0}</p>
            <p className="text-xs text-ink-400">bookings · {formatMoney(data.booking_volume?.gross ?? 0)} gross</p>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Needs attention" />
          <CardBody className="space-y-2 text-sm">
            <p className="flex items-center justify-between"><span className="text-ink-500">Failed payments</span><span className="font-bold text-red-600">{c.failed_payments ?? 0}</span></p>
            <p className="flex items-center justify-between"><span className="text-ink-500">Open disputes</span><span className="font-bold text-pink-600">{c.open_disputes ?? 0}</span></p>
            <p className="flex items-center justify-between"><span className="text-ink-500">Creative requests</span><span className="font-bold text-violet-600">{c.creative_requests ?? 0}</span></p>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
