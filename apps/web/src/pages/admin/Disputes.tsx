import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Scale, CheckCircle2 } from "lucide-react";
import { api } from "../../lib/api";
import { apiErrorMessage, formatDateTime } from "../../lib/utils";
import { Button, Card, Dialog, EmptyState, Field, PageLoader, Select, StatusBadge, Table, Td, Textarea } from "../../components/ui";

interface Dispute {
  id: string;
  booking_id: string;
  raised_by: string;
  reason: string;
  description: string | null;
  status: string;
  resolution: string | null;
  created_at: string;
  campaign_id: string;
  package_title: string;
  publisher_name: string;
  raised_by_name: string;
}

const REASONS: Record<string, string> = {
  ADVERTISEMENT_NOT_PUBLISHED: "Advertisement was not published",
  WRONG_CREATIVE_PUBLISHED: "Wrong creative published",
  LATE_PUBLICATION: "Late publication",
  INCORRECT_PLACEMENT: "Incorrect placement",
  CAMPAIGN_NOT_COMPLETED: "Campaign not completed",
  PUBLISHER_CANCELLED: "Publisher cancelled",
  ADVERTISER_SUBMITTED_INCORRECT_MATERIAL: "Advertiser submitted incorrect material",
  PAYMENT_ISSUE: "Payment issue",
  CREATIVE_ISSUE: "Creative issue",
  OTHER: "Other",
};

export function AdmDisputesPage() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Dispute | null>(null);
  const [status, setStatus] = useState("UNDER_REVIEW");
  const [action, setAction] = useState("CLOSE");
  const [resolution, setResolution] = useState("");
  const [error, setError] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "disputes"],
    queryFn: () => api.get<Dispute[]>("/api/disputes"),
  });

  const resolve = useMutation({
    mutationFn: () =>
      api.post(`/api/disputes/${selected!.id}/resolve`, {
        status,
        resolution: resolution || null,
        action,
      }),
    onSuccess: () => {
      setSelected(null);
      setResolution("");
      qc.invalidateQueries({ queryKey: ["admin", "disputes"] });
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">Disputes</h1>
        <p className="mt-1 text-sm text-ink-500">Review evidence, communicate with both parties, and resolve fairly. Every action is logged.</p>
      </div>

      <Card>
        <Table headers={["Package", "Raised by", "Reason", "Status", "Created", "Actions"]}>
          {(data ?? []).map((d) => (
            <tr key={d.id} className="hover:bg-ink-50/60">
              <Td>
                <p className="font-medium text-ink-900">{d.package_title}</p>
                <p className="text-xs text-ink-400">{d.publisher_name}</p>
              </Td>
              <Td className="text-sm">{d.raised_by_name}</Td>
              <Td className="text-xs">{REASONS[d.reason] ?? d.reason}</Td>
              <Td><StatusBadge status={d.status} /></Td>
              <Td className="text-xs text-ink-500">{formatDateTime(d.created_at)}</Td>
              <Td>
                <Button size="sm" variant="outline" onClick={() => { setSelected(d); setStatus(d.status); }}>Resolve</Button>
              </Td>
            </tr>
          ))}
        </Table>
        {!data?.length && <EmptyState icon={<Scale className="h-6 w-6" />} title="No disputes" description="Disputes raised on bookings appear here." />}
      </Card>

      <Dialog open={!!selected} onClose={() => setSelected(null)} title="Resolve dispute" wide>
        <div className="space-y-4">
          <div className="rounded-xl bg-ink-50 p-4 text-sm">
            <p className="font-semibold text-ink-900">{selected?.package_title}</p>
            <p className="mt-1 text-ink-500">
              {REASONS[selected?.reason ?? ""] ?? selected?.reason} — {selected?.description} · raised by {selected?.raised_by_name}
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Status">
              <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                {["OPEN", "UNDER_REVIEW", "RESOLVED", "CLOSED"].map((s) => <option key={s}>{s}</option>)}
              </Select>
            </Field>
            <Field label="Action">
              <Select value={action} onChange={(e) => setAction(e.target.value)}>
                <option value="CLOSE">Close dispute (no refund)</option>
                <option value="REJECT">Reject claim</option>
                <option value="REFUND_FULL">Full refund to advertiser</option>
                <option value="REFUND_PARTIAL">Partial refund</option>
                <option value="RESCHEDULE">Reschedule campaign</option>
              </Select>
            </Field>
            <div className="sm:col-span-2">
              <Field label="Resolution notes" required>
                <Textarea rows={3} value={resolution} onChange={(e) => setResolution(e.target.value)} placeholder="Explain the decision to both parties…" />
              </Field>
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setSelected(null)}>Cancel</Button>
            <Button loading={resolve.isPending} icon={<CheckCircle2 className="h-4 w-4" />} onClick={() => resolve.mutate()}>Apply resolution</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
