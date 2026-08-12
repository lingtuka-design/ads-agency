import { Link, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, CreditCard, XCircle, Upload } from "lucide-react";
import { api, uploadFile } from "../../lib/api";
import { apiErrorMessage, formatMoney } from "../../lib/utils";
import { Button, Card, CardBody, CardHeader, Dialog, EmptyState, PageLoader, StatusBadge, Badge } from "../../components/ui";
import { CampaignTimeline } from "../../components/CampaignTimeline";
import { Thread } from "../../components/Thread";

interface BookingDetail {
  id: string;
  status: string;
  amount: number;
  unit_price: number;
  currency: string;
  quantity: number;
  scheduled_start: string | null;
  scheduled_end: string | null;
  instructions: string | null;
  finance: string | null;
  package_title: string;
  platform: string;
  publisher_name: string;
  publisher_slug: string;
  campaign_id: string;
  campaign_name: string;
}

export function AdvBookingDetailPage() {
  const { id } = useParams({ from: "/advertiser/bookings/$id" });
  const qc = useQueryClient();
  const [error, setError] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["booking", id],
    queryFn: async () => {
      const res = await api.get<{ booking: BookingDetail; creative: unknown; payment: unknown }>("/api/bookings/" + id);
      return res;
    },
  });

  const cancel = useMutation({
    mutationFn: () => api.post(`/api/bookings/${id}/cancel`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["booking", id] }),
    onError: (e: unknown) => setError(apiErrorMessage(e)),
  });

  const upload = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Choose a file first.");
      const up = await uploadFile(file);
      await api.post(`/api/creatives/booking/${id}/upload`, { file_url: up.url, file_name: up.file_name, file_size: file.size, mime_type: file.type });
    },
    onSuccess: () => { setUploadOpen(false); setFile(null); qc.invalidateQueries(); },
    onError: (e: unknown) => setError(apiErrorMessage(e)),
  });

  if (isLoading) return <PageLoader />;
  if (!data?.booking) return <EmptyState title="Booking not found" />;
  const b = data.booking;
  const finance = b.finance ? JSON.parse(b.finance) : null;

  return (
    <div className="space-y-6">
      <Link to="/advertiser/bookings" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-brand-600">
        <ArrowLeft className="h-4 w-4" /> My Bookings
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">{b.package_title}</h1>
          <p className="mt-1 text-sm text-ink-500">{b.publisher_name} · {b.campaign_name}</p>
          <div className="mt-2 flex gap-2"><StatusBadge status={b.status} /><Badge tone="blue">{b.platform}</Badge></div>
        </div>
        <div className="flex gap-2">
          {["PAID", "DRAFT", "PENDING_PAYMENT"].includes(b.status) && (
            <Button variant="danger" size="sm" icon={<XCircle className="h-4 w-4" />} onClick={() => setCancelOpen(true)}>
              Cancel Booking
            </Button>
          )}
          {!["PAID", "COMPLETED", "CANCELLED", "REFUNDED"].includes(b.status) && (
            <Button size="sm" icon={<CreditCard className="h-4 w-4" />} onClick={() => { setUploadOpen(true); }}>
              Upload Creative
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card>
          <CardHeader title="Campaign timeline" />
          <CardBody><CampaignTimeline status={b.status} /></CardBody>
        </Card>

        <Card>
          <CardHeader title="Financial snapshot" subtitle="Recorded permanently at booking time" />
          <CardBody className="space-y-2.5 text-sm">
            {finance && (
              <>
                <div className="flex justify-between"><span className="text-ink-400">Campaign value</span><span className="font-semibold">{formatMoney(finance.grossAmount)}</span></div>
                <div className="flex justify-between"><span className="text-ink-400">Commission ({finance.commissionPercent}%)</span><span className="font-semibold text-brand-600">− {formatMoney(finance.commissionAmount)}</span></div>
                <div className="flex justify-between"><span className="text-ink-400">Publisher earnings</span><span className="font-semibold text-emerald-600">{formatMoney(finance.publisherAmount)}</span></div>
                <div className="flex justify-between border-t border-ink-100 pt-2.5"><span className="text-ink-400">You paid</span><span className="font-bold">{formatMoney(b.amount)}</span></div>
              </>
            )}
            {b.instructions && (
              <p className="mt-3 rounded-xl bg-ink-50 p-3 text-xs text-ink-600">Instructions: {b.instructions}</p>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Conversation" subtitle="Directly with the agency & publisher" />
          <CardBody className="p-3">
            <Thread threadType="campaign" threadId={b.id} />
          </CardBody>
        </Card>
      </div>

      <Dialog open={cancelOpen} onClose={() => setCancelOpen(false)} title="Cancel this booking?">
        <p className="text-sm text-ink-600">
          This releases the advertising slot back to the publisher. If you already paid, the agency will process a refund per its refund policy.
        </p>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setCancelOpen(false)}>Keep booking</Button>
          <Button variant="danger" loading={cancel.isPending} onClick={() => cancel.mutate()}>Cancel booking</Button>
        </div>
      </Dialog>

      <Dialog open={uploadOpen} onClose={() => setUploadOpen(false)} title="Upload creative">
        <div className="space-y-4">
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-ink-300 px-4 py-8 text-sm text-ink-500 hover:border-brand-400 hover:bg-brand-50/40">
            <Upload className="h-6 w-6" />
            {file ? file.name : "JPG, PNG, WEBP, PDF, MP4 (max 100MB)"}
            <input type="file" className="hidden" accept=".jpg,.jpeg,.png,.webp,.pdf,.mp4,.mov" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setUploadOpen(false)}>Cancel</Button>
            <Button loading={upload.isPending} disabled={!file} onClick={() => upload.mutate()}>Upload</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
