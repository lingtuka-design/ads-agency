import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { api } from "../../lib/api";
import { Button, Card, CardBody, CardHeader, PageLoader } from "../../components/ui";

const REPORTS = [
  { id: "revenue", label: "Revenue & commission", desc: "Payments with commission and publisher amounts" },
  { id: "bookings", label: "Booking history", desc: "All bookings across the marketplace" },
  { id: "publishers", label: "Publisher performance", desc: "Bookings and revenue per publisher" },
  { id: "settlements", label: "Settlements", desc: "Payouts with references and statuses" },
  { id: "advertisers", label: "Advertiser spending", desc: "Total spend per advertiser" },
];

export function AdmReportsPage() {
  const { data: analytics } = useQuery({
    queryKey: ["admin", "analytics"],
    queryFn: () =>
      api.get<{
        platforms: { platform: string; n: number; revenue: number }[];
        avg_booking: number;
        advertisers: { month: string; n: number }[];
        publishers: { month: string; n: number }[];
      }>("/api/admin/analytics"),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">Reports & Analytics</h1>
        <p className="mt-1 text-sm text-ink-500">Export CSV reports and review platform-level analytics.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {REPORTS.map((r) => (
          <Card key={r.id} className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-ink-900">{r.label}</p>
                <p className="mt-1 text-sm text-ink-500">{r.desc}</p>
              </div>
              <a href={`/api/admin/reports/${r.id}.csv`} download>
                <Button size="sm" variant="outline" icon={<Download className="h-4 w-4" />}>CSV</Button>
              </a>
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader title="Marketplace analytics" />
        <CardBody>
          {!analytics ? <PageLoader /> : (
            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                <h3 className="mb-3 text-sm font-semibold text-ink-900">Revenue by platform</h3>
                <div className="space-y-2">
                  {(analytics.platforms ?? []).map((p) => (
                    <div key={p.platform} className="flex items-center justify-between rounded-xl bg-ink-50 px-4 py-2.5 text-sm">
                      <span className="font-medium text-ink-700">{p.platform}</span>
                      <span className="text-ink-500">{p.n} booking(s) · <span className="font-bold text-ink-900">₹{p.revenue.toLocaleString("en-IN")}</span></span>
                    </div>
                  ))}
                  {!analytics.platforms?.length && <p className="text-sm text-ink-400">No platform data yet.</p>}
                </div>
              </div>
              <div>
                <h3 className="mb-3 text-sm font-semibold text-ink-900">Growth</h3>
                <div className="space-y-4">
                  <div>
                    <p className="mb-1.5 text-xs text-ink-400">Advertisers joining (last 12 months)</p>
                    <div className="flex items-end gap-1">
                      {(analytics.advertisers ?? []).slice().reverse().map((m) => (
                        <div key={m.month} className="flex-1 rounded-t bg-brand-500" style={{ height: `${Math.max(4, m.n * 12)}px` }} title={`${m.month}: ${m.n}`} />
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="mb-1.5 text-xs text-ink-400">Publishers joining (last 12 months)</p>
                    <div className="flex items-end gap-1">
                      {(analytics.publishers ?? []).slice().reverse().map((m) => (
                        <div key={m.month} className="flex-1 rounded-t bg-emerald-500" style={{ height: `${Math.max(4, m.n * 12)}px` }} title={`${m.month}: ${m.n}`} />
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-ink-400">
                    Average booking value: <span className="font-bold text-ink-900">₹{Math.round(analytics.avg_booking).toLocaleString("en-IN")}</span>
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
