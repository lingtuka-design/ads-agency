import { Link, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Upload, FileText, Scale } from "lucide-react";
import { api, uploadFile } from "../../lib/api";
import { apiErrorMessage, formatMoney } from "../../lib/utils";
import { Button, Card, CardBody, CardHeader, Dialog, EmptyState, PageLoader, StatusBadge } from "../../components/ui";
import { CampaignTimeline } from "../../components/CampaignTimeline";
import { Thread } from "../../components/Thread";

interface BookingDetail {
  id: string;
  status: string;
  amount: number;
  package_title: string;
  platform: string;
  campaign_name: string;
  campaign_id: string;
  scheduled_start: string | null;
  scheduled_end: string | null;
  instructions: string | null;
}

const PUBLISHER_ACTIONS: { from: string[]; to: string; label: string; tone: "success" | "outline" }[] = [
  { from: ["SENT_TO_PUBLISHER"], to: "PUBLISHER_APPROVED", label: "Approve Campaign", tone: "success" },
  { from: ["PUBLISHER_APPROVED", "SENT_TO_PUBLISHER"], to: "SCHEDULED", label: "Mark Scheduled", tone: "outline" },
  { from: ["SCHEDULED"], to: "LIVE", label: "Mark Published (LIVE)", tone: "outline" },
  { from: ["LIVE"], to: "PROOF_SUBMITTED", label: "Submit Proof", tone: "outline" },
  { from: ["PROOF_SUBMITTED", "LIVE"], to: "COMPLETED", label: "Mark Completed", tone: "success" },
];

export function PubBookingDetailPage() {
  const { id } = useParams({ from: "/publisher/bookings/$id" });
  const qc = useQueryClient();
  const [error, setError] = useState("");
  const [proofOpen, setProofOpen] = useState(false);
  const [proofFile, setProofFile] = useState<File | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["booking", id],
    queryFn: async () => {
      const res = await api.get<{ booking: BookingDetail }>("/api/bookings/" + id);
      return res;
    },
  });

  const transition = useMutation({
    mutationFn: (to: string) => api.post(`/api/bookings/${id}/transition`, { to, note: `${to} by publisher` }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["booking", id] }),
    onError: (e) => setError(apiErrorMessage(e)),
  });

  const submitProof = useMutation({
    mutationFn: async () => {
      if (!proofFile) throw new Error("Choose a proof file.");
      const up = await uploadFile(proofFile);
      await api.post(`/api/bookings/${id}/transition`, {
        to: "PROOF_SUBMITTED",
        note: `Proof uploaded: ${up.file_name} (${up.url})`,
      });
    },
    onSuccess: () => { setProofOpen(false); setProofFile(null); qc.invalidateQueries({ queryKey: ["booking", id] }); },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  const raiseDispute = useMutation({
    mutationFn: () => api.post("/api/disputes", {
      booking_id: id,
      reason: "CAMPAIGN_NOT_COMPLETED",
      description: "Publisher reporting an issue with this campaign.",
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["booking", id] }),
    onError: (e) => setError(apiErrorMessage(e)),
  });

  if (isLoading) return <PageLoader />;
  if (!data?.booking) return <EmptyState title="Booking not found" />;
  const b = data.booking;
  const actions = PUBLISHER_ACTIONS.filter((a) => a.from.includes(b.status));

  return (
    <div className="space-y-6">
      <Link to="/publisher/bookings" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-brand-600">
        <ArrowLeft className="h-4 w-4" /> Bookings
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">{b.package_title}</h1>
          <p className="mt-1 text-sm text-ink-500">{b.campaign_name} · {b.platform}</p>
          <div className="mt-2"><StatusBadge status={b.status} /></div>
        </div>
        <div className="flex flex-wrap gap-2">
          {actions.map((a) => (
            <Button key={a.to} variant={a.tone} size="sm" loading={transition.isPending && transition.variables === a.to} onClick={() => transition.mutate(a.to)}>
              {a.label}
            </Button>
          ))}
          {["LIVE", "PUBLISHER_APPROVED", "SCHEDULED"].includes(b.status) && (
            <Button variant="outline" size="sm" icon={<Upload className="h-4 w-4" />} onClick={() => setProofOpen(true)}>Upload Proof</Button>
          )}
          {["PAID", "UNDER_REVIEW", "CREATIVE_REQUIRED", "CREATIVE_APPROVED", "SENT_TO_PUBLISHER", "PUBLISHER_APPROVED", "SCHEDULED", "LIVE", "PROOF_SUBMITTED"].includes(b.status) && (
            <Button variant="danger" size="sm" icon={<Scale className="h-4 w-4" />} onClick={() => raiseDispute.mutate()}>Raise Dispute</Button>
          )}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card>
          <CardHeader title="Campaign timeline" />
          <CardBody><CampaignTimeline status={b.status} /></CardBody>
        </Card>
        <Card>
          <CardHeader title="Details" />
          <CardBody className="space-y-2.5 text-sm">
            {[
              ["Amount", formatMoney(b.amount)],
              ["Scheduled", b.scheduled_start ? `${b.scheduled_start.slice(0, 10)} → ${b.scheduled_end?.slice(0, 10)}` : "Not scheduled yet"],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between"><span className="text-ink-400">{k}</span><span className="font-medium">{v}</span></div>
            ))}
            {b.instructions && <p className="rounded-xl bg-ink-50 p-3 text-xs text-ink-600">Instructions: {b.instructions}</p>}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Conversation" />
          <CardBody className="p-3"><Thread threadType="campaign" threadId={b.id} /></CardBody>
        </Card>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Dialog open={proofOpen} onClose={() => setProofOpen(false)} title="Upload proof of publication">
        <div className="space-y-4">
          <p className="text-sm text-ink-500">Screenshots, post URLs, YouTube links or video captures proving the advertisement was published.</p>
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-ink-300 px-4 py-8 text-sm text-ink-500 hover:border-brand-400 hover:bg-brand-50/40">
            <FileText className="h-6 w-6" />
            {proofFile ? proofFile.name : "Screenshot, image or video proof"}
            <input type="file" className="hidden" accept=".jpg,.jpeg,.png,.webp,.pdf,.mp4,.mov" onChange={(e) => setProofFile(e.target.files?.[0] ?? null)} />
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setProofOpen(false)}>Cancel</Button>
            <Button loading={submitProof.isPending} disabled={!proofFile} onClick={() => submitProof.mutate()}>
              Submit proof
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
