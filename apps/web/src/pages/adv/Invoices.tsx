import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, Eye } from "lucide-react";
import { api } from "../../lib/api";
import { formatDate, formatMoney } from "../../lib/utils";
import { Badge, Button, Card, CardHeader, Dialog, EmptyState, PageLoader } from "../../components/ui";

interface Invoice {
  id: string;
  number: string;
  amount: number;
  tax: number;
  total: number;
  currency: string;
  status: string;
  created_at: string;
  package_title: string;
  publisher_name: string;
}

interface InvoiceDetail {
  invoice: {
    id: string;
    number: string;
    amount: number;
    tax: number;
    total: number;
    currency: string;
    status: string;
    created_at: string;
    package_title: string;
    platform: string;
    publisher_name: string;
    campaign_name: string;
    advertiser_name: string;
    advertiser_email: string;
    booking_amount: number;
    finance: string | null;
  };
}

export function AdvInvoicesPage() {
  const [viewId, setViewId] = useState<string | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["adv", "invoices"],
    queryFn: () => api.get<Invoice[]>("/api/invoices"),
  });
  const { data: detail } = useQuery({
    queryKey: ["invoice", viewId],
    queryFn: () => api.get<InvoiceDetail>("/api/invoices/" + viewId),
    enabled: !!viewId,
  });

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">Invoices</h1>
        <p className="mt-1 text-sm text-ink-500">Professional invoices generated automatically on every successful payment.</p>
      </div>
      <Card>
        <CardHeader title="Your invoices" subtitle={`${data?.length ?? 0} invoice(s)`} />
        {!data?.length ? (
          <EmptyState
            icon={<FileText className="h-6 w-6" />}
            title="No invoices yet"
            description="Complete a payment and your invoice will appear here — permanently."
          />
        ) : (
          <div className="divide-y divide-ink-100">
            {data.map((i) => (
              <div key={i.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div>
                  <p className="flex items-center gap-2 text-sm font-semibold text-ink-900">
                    {i.number} <Badge tone={i.status === "ISSUED" ? "green" : "slate"}>{i.status}</Badge>
                  </p>
                  <p className="text-xs text-ink-400">{i.package_title} · {i.publisher_name} · {formatDate(i.created_at)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-ink-900">{formatMoney(i.total)}</span>
                  <Button size="sm" variant="outline" icon={<Eye className="h-4 w-4" />} onClick={() => setViewId(i.id)}>View</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Dialog open={!!viewId} onClose={() => setViewId(null)} title={detail?.invoice.number ?? "Invoice"} wide>
        {detail && (
          <div className="space-y-4">
            <div className="flex items-start justify-between rounded-xl bg-ink-900 p-5 text-white">
              <div>
                <p className="text-xs uppercase tracking-widest text-ink-400">AdAgencyHub</p>
                <p className="mt-1 text-lg font-bold">{detail.invoice.number}</p>
              </div>
              <p className="text-xs text-ink-400">Issued {formatDate(detail.invoice.created_at)}</p>
            </div>
            <div className="grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase text-ink-400">Billed to</p>
                <p className="mt-1 font-medium text-ink-900">{detail.invoice.advertiser_name}</p>
                <p className="text-ink-500">{detail.invoice.advertiser_email}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-ink-400">Campaign</p>
                <p className="mt-1 font-medium text-ink-900">{detail.invoice.campaign_name}</p>
                <p className="text-ink-500">{detail.invoice.package_title} · {detail.invoice.publisher_name} · {detail.invoice.platform}</p>
              </div>
            </div>
            <div className="overflow-hidden rounded-xl border border-ink-200">
              <table className="w-full text-sm">
                <thead className="bg-ink-50">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-ink-400">Item</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase text-ink-400">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-ink-100">
                    <td className="px-4 py-3">Advertising package</td>
                    <td className="px-4 py-3 text-right font-medium">{formatMoney(detail.invoice.amount)}</td>
                  </tr>
                  <tr className="border-t border-ink-100">
                    <td className="px-4 py-3">Tax</td>
                    <td className="px-4 py-3 text-right font-medium">{formatMoney(detail.invoice.tax)}</td>
                  </tr>
                  <tr className="border-t border-ink-100 bg-ink-50">
                    <td className="px-4 py-3 font-bold">Total</td>
                    <td className="px-4 py-3 text-right font-bold">{formatMoney(detail.invoice.total)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-center text-xs text-ink-400">
              Payment status: {detail.invoice.status} · Paid to the agency, which settles the publisher after verification.
            </p>
          </div>
        )}
      </Dialog>
    </div>
  );
}
