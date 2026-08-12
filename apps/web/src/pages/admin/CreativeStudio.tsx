import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Images, UserCog, Send } from "lucide-react";
import { api } from "../../lib/api";
import { apiErrorMessage, formatDate } from "../../lib/utils";
import { Button, Card, Dialog, EmptyState, Field, Input, PageLoader, Select, StatusBadge, Table, Td, Textarea } from "../../components/ui";

interface Job {
  id: string;
  advertiser_id: string;
  assigned_to: string | null;
  status: string;
  brief: string | null;
  business_name: string | null;
  product_service: string | null;
  format: string | null;
  budget: number | null;
  deadline: string | null;
  design_url: string | null;
  created_at: string;
  advertiser_name: string | null;
  assignee_name: string | null;
}

const JOB_STATUSES = ["NEW_REQUEST", "ASSIGNED", "DESIGNING", "REVIEW", "REVISION_REQUESTED", "FINAL_APPROVAL", "APPROVED", "DELIVERED", "CANCELLED"];

export function AdmCreativeStudioPage() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Job | null>(null);
  const [status, setStatus] = useState("");
  const [assignee, setAssignee] = useState("");
  const [designUrl, setDesignUrl] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "creative-jobs"],
    queryFn: () => api.get<Job[]>("/api/creatives/jobs"),
  });

  const { data: staff } = useQuery({
    queryKey: ["admin", "staff"],
    queryFn: () => api.get<{ user_id: string; name: string; email: string; staff_role: string }[]>("/api/admin/staff"),
  });

  const update = useMutation({
    mutationFn: () =>
      api.post(`/api/creatives/jobs/${selected!.id}/status`, {
        status,
        design_url: designUrl || null,
        note: note || null,
      }),
    onSuccess: () => {
      setSelected(null);
      setStatus("");
      setDesignUrl("");
      setNote("");
      qc.invalidateQueries({ queryKey: ["admin", "creative-jobs"] });
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  const assign = useMutation({
    mutationFn: ({ jobId }: { jobId: string }) =>
      api.post(`/api/admin/creative-jobs/${jobId}/assign`, { assigned_to: assignee || null }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "creative-jobs"] }),
    onError: (e) => setError(apiErrorMessage(e)),
  });

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">Creative Studio</h1>
        <p className="mt-1 text-sm text-ink-500">Design requests from advertisers — assign designers, track revisions and deliver approved artwork.</p>
      </div>

      <Card>
        <Table headers={["Request", "Advertiser", "Format", "Due", "Designer", "Status", "Actions"]}>
          {(data ?? []).map((j) => (
            <tr key={j.id} className="hover:bg-ink-50/60">
              <Td>
                <p className="font-medium text-ink-900">{j.business_name ?? "Design request"}</p>
                <p className="text-xs text-ink-400">{j.product_service ?? "—"}</p>
              </Td>
              <Td className="text-sm">{j.advertiser_name}</Td>
              <Td className="text-xs text-ink-500">{j.format ?? "—"}</Td>
              <Td className="text-xs text-ink-500">{j.deadline ? formatDate(j.deadline) : "—"}</Td>
              <Td className="text-xs">{j.assignee_name ?? <span className="text-amber-600">Unassigned</span>}</Td>
              <Td><StatusBadge status={j.status} /></Td>
              <Td>
                <div className="flex gap-1.5">
                  {!j.assigned_to && (
                    <Select value={assignee} onChange={(e) => setAssignee(e.target.value)} className="h-8 w-36 text-xs">
                      <option value="">Assign…</option>
                      {(staff ?? []).filter((s) => ["CREATIVE_MANAGER", "SUPER_ADMIN"].includes(s.staff_role)).map((s) => (
                        <option key={s.user_id} value={s.user_id}>{s.name}</option>
                      ))}
                    </Select>
                  )}
                  {!j.assigned_to && assignee && (
                    <Button size="sm" variant="outline" icon={<UserCog className="h-4 w-4" />} onClick={() => assign.mutate({ jobId: j.id })}>Assign</Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => { setSelected(j); setStatus(j.status); setDesignUrl(j.design_url ?? ""); }}>
                    Manage
                  </Button>
                </div>
              </Td>
            </tr>
          ))}
        </Table>
        {!data?.length && <EmptyState icon={<Images className="h-6 w-6" />} title="No design requests yet" description="Advertiser design requests appear here." />}
      </Card>

      <Dialog open={!!selected} onClose={() => setSelected(null)} title={`Design request — ${selected?.business_name ?? ""}`} wide>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Status">
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              {JOB_STATUSES.map((s) => <option key={s}>{s}</option>)}
            </Select>
          </Field>
          <Field label="Design URL (deliverable)">
            <Input value={designUrl} onChange={(e) => setDesignUrl(e.target.value)} placeholder="https://… final design" />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Note to advertiser">
              <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
          </div>
          {selected?.design_url && (
            <div className="sm:col-span-2 rounded-xl bg-ink-50 p-3 text-xs">
              <a href={selected.design_url} target="_blank" rel="noreferrer" className="font-semibold text-brand-700 hover:underline">Current design →</a>
            </div>
          )}
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setSelected(null)}>Cancel</Button>
          <Button loading={update.isPending} icon={<Send className="h-4 w-4" />} onClick={() => update.mutate()}>Update request</Button>
        </div>
      </Dialog>
    </div>
  );
}
