import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CalendarCheck } from "lucide-react";
import { api } from "../../lib/api";
import { apiErrorMessage, formatDate, formatMoney } from "../../lib/utils";
import { Button, Card, Dialog, EmptyState, Input, PageLoader, Pagination, Select, StatusBadge, Table, Td } from "../../components/ui";

interface BookingRow {
  id: string;
  status: string;
  amount: number;
  currency: string;
  quantity: number;
  created_at: string;
  scheduled_start: string | null;
  scheduled_end: string | null;
  package_title: string;
  platform: string;
  publisher_name: string;
  publisher_slug: string;
  campaign_name: string;
  advertiser_user_name: string;
}

const STATUSES = ["DRAFT", "PENDING_PAYMENT", "PAID", "UNDER_REVIEW", "CREATIVE_REQUIRED", "CREATIVE_APPROVED", "SENT_TO_PUBLISHER", "PUBLISHER_APPROVED", "SCHEDULED", "LIVE", "PROOF_SUBMITTED", "COMPLETED", "CANCELLED", "REFUNDED", "DISPUTED"];

export function AdmBookingsPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [manualRef, setManualRef] = useState("");
  const [captureOpen, setCaptureOpen] = useState(false);
  const [error, setError] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "bookings", { status, page }],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), pageSize: "20" });
      if (status) params.set("status", status);
      return api.get<{ items: BookingRow[]; total: number }>("/api/bookings?" + params);
    },
  });

  const capture = useMutation({
    mutationFn: () => api.post("/api/payments/admin-capture", { ref: manualRef }),
    onSuccess: () => {
      setCaptureOpen(false);
      setManualRef("");
      qc.invalidateQueries();
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Bookings</h1>
          <p className="mt-1 text-sm text-ink-500">Every booking across the marketplace, with its state-machine status.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setCaptureOpen(true)}>Admin payment capture</Button>
      </div>

      <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="sm:w-56">
        <option value="">All statuses</option>
        {STATUSES.map((s) => <option key={s}>{s}</option>)}
      </Select>

      {isLoading ? <PageLoader /> : !data?.items.length ? (
        <Card><EmptyState icon={<CalendarCheck className="h-6 w-6" />} title="No bookings" description="Bookings appear here when advertisers reserve packages." /></Card>
      ) : (
        <Card>
          <Table headers={["Package", "Advertiser", "Publisher", "Amount", "Dates", "Status"]}>
            {data.items.map((b) => (
              <tr key={b.id} className="hover:bg-ink-50/60">
                <Td>
                  <Link to="/admin/bookings/$id" params={{ id: b.id }} className="font-medium text-brand-700 hover:underline">{b.package_title}</Link>
                  <p className="text-xs text-ink-400">{b.platform} · {b.campaign_name}</p>
                </Td>
                <Td className="text-sm">{b.advertiser_user_name}</Td>
                <Td className="text-sm text-ink-600">{b.publisher_name}</Td>
                <Td className="font-semibold">{formatMoney(b.amount)}</Td>
                <Td className="text-xs text-ink-500">{formatDate(b.created_at)}</Td>
                <Td><StatusBadge status={b.status} /></Td>
              </tr>
            ))}
          </Table>
          <Pagination page={page} pageSize={20} total={data?.total ?? 0} onChange={setPage} />
        </Card>
      )}

      <Dialog open={captureOpen} onClose={() => setCaptureOpen(false)} title="Admin payment capture">
        <p className="text-sm text-ink-500">Use when a payment was received outside the gateway (manual mode / failover). Enter the payment reference.</p>
        <div className="mt-4 space-y-3">
          <Input value={manualRef} onChange={(e) => setManualRef(e.target.value)} placeholder="e.g. MAN_XXXXXXXXXXXX" />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCaptureOpen(false)}>Cancel</Button>
            <Button loading={capture.isPending} disabled={!manualRef} onClick={() => capture.mutate()}>Confirm payment</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
