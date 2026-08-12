import { Link, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { api } from "../../lib/api";
import { apiErrorMessage, formatDateTime, formatMoney, titleCase } from "../../lib/utils";
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, Input, PageLoader, Select, StatusBadge } from "../../components/ui";
import { CampaignTimeline } from "../../components/CampaignTimeline";
import { Thread } from "../../components/Thread";

interface BookingDetail {
  id: string;
  status: string;
  amount: number;
  unit_price: number;
  quantity: number;
  package_title: string;
  platform: string;
  publisher_name: string;
  campaign_name: string;
  advertiser_user_name: string;
  instructions: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  finance: string | null;
}

interface HistoryRow {
  id: string;
  from_status: string | null;
  to_status: string;
  actor_name: string | null;
  note: string | null;
  created_at: string;
}

const ALL_STATUSES = ["DRAFT", "PENDING_PAYMENT", "PAID", "UNDER_REVIEW", "CREATIVE_REQUIRED", "CREATIVE_APPROVED", "SENT_TO_PUBLISHER", "PUBLISHER_APPROVED", "SCHEDULED", "LIVE", "PROOF_SUBMITTED", "COMPLETED", "CANCELLED", "REFUNDED", "DISPUTED"];

export function AdmBookingDetailPage() {
  const { id } = useParams({ from: "/admin/bookings/$id" });
  const qc = useQueryClient();
  const [target, setTarget] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "booking", id],
    queryFn: async () => {
      const res = await api.get<{ booking: BookingDetail; history: HistoryRow[] }>("/api/bookings/" + id);
      return res;
    },
  });

  const transition = useMutation({
    mutationFn: () => api.post(`/api/bookings/${id}/transition`, { to: target, note: note || null }),
    onSuccess: () => {
      setTarget("");
      setNote("");
      qc.invalidateQueries({ queryKey: ["admin", "booking", id] });
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  if (isLoading) return <PageLoader />;
  if (!data?.booking) return <EmptyState title="Booking not found" />;
  const b = data.booking;
  const finance = b.finance ? JSON.parse(b.finance) : null;

  return (
    <div className="space-y-6">
      <Link to="/admin/bookings" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-brand-600">
        <ArrowLeft className="h-4 w-4" /> Bookings
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">{b.package_title}</h1>
          <p className="mt-1 text-sm text-ink-500">{b.publisher_name} · {b.campaign_name} · by {b.advertiser_user_name}</p>
          <div className="mt-2 flex gap-2"><StatusBadge status={b.status} /><Badge tone="blue">{b.platform}</Badge></div>
        </div>
        <div className="text-right">
          <p className="text-xs text-ink-400">Booking value</p>
          <p className="text-2xl font-bold text-ink-900">{formatMoney(b.amount)}</p>
          {finance && <p className="text-xs text-ink-400">Commission {finance.commissionPercent}% · {formatMoney(finance.commissionAmount)}</p>}
        </div>
      </div>

      <Card>
        <CardHeader title="State machine — transition booking" subtitle="Only valid transitions are allowed server-side" />
        <CardBody>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-40">
              <label className="mb-1.5 block text-sm font-medium text-ink-700">Move to</label>
              <Select value={target} onChange={(e) => setTarget(e.target.value)}>
                <option value="">Select target status…</option>
                {ALL_STATUSES.filter((s) => s !== b.status).map((s) => <option key={s}>{s}</option>)}
              </Select>
            </div>
            <div className="flex-1 min-w-40">
              <label className="mb-1.5 block text-sm font-medium text-ink-700">Note</label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note" />
            </div>
            <Button loading={transition.isPending} disabled={!target} onClick={() => transition.mutate()}>Apply transition</Button>
          </div>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </CardBody>
      </Card>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card>
          <CardHeader title="Timeline" />
          <CardBody><CampaignTimeline status={b.status} /></CardBody>
        </Card>
        <Card>
          <CardHeader title="History" subtitle="Immutable activity record" />
          <div className="divide-y divide-ink-100">
            {data.history.map((h) => (
              <div key={h.id} className="px-5 py-3 text-xs">
                <p className="font-medium text-ink-800">
                  {h.from_status ? titleCase(h.from_status) : "—"} → {titleCase(h.to_status)}
                </p>
                <p className="mt-0.5 text-ink-400">
                  {h.actor_name ?? "system"} · {formatDateTime(h.created_at)}
                </p>
                {h.note && <p className="mt-0.5 text-ink-500">{h.note}</p>}
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <CardHeader title="Conversation" />
          <CardBody className="p-3"><Thread threadType="campaign" threadId={b.id} /></CardBody>
        </Card>
      </div>
    </div>
  );
}
