import { useParams, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, RotateCcw } from "lucide-react";
import { api } from "../../lib/api";
import { apiErrorMessage, formatDate } from "../../lib/utils";
import { Button, Card, CardBody, CardHeader, EmptyState, PageLoader, StatusBadge } from "../../components/ui";
import { Thread } from "../../components/Thread";

interface Job {
  id: string;
  status: string;
  business_name: string | null;
  product_service: string | null;
  objective: string | null;
  target_audience: string | null;
  preferred_style: string | null;
  preferred_colors: string | null;
  required_text: string | null;
  format: string | null;
  budget: number | null;
  deadline: string | null;
  brief: string | null;
  attachments: string | null;
  drive_links: string | null;
  design_url: string | null;
  created_at: string;
}

export function AdvCreativeJobPage() {
  const { id } = useParams({ from: "/advertiser/creative-studio/$id" });
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["creative-job", id],
    queryFn: async () => {
      const jobs = await api.get<Job[]>("/api/creatives/jobs");
      return jobs.find((j) => j.id === id) ?? null;
    },
  });

  const update = useMutation({
    mutationFn: (status: string) => api.post(`/api/creatives/jobs/${id}/status`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["creative-job", id] }),
    onError: (e) => alert(apiErrorMessage(e)),
  });

  if (isLoading) return <PageLoader />;
  if (!data) return <EmptyState title="Request not found" />;
  const j = data;
  const attachments = j.attachments ? JSON.parse(j.attachments) : [];
  const driveLinks = j.drive_links ? JSON.parse(j.drive_links) : [];

  return (
    <div className="space-y-6">
      <Link to="/advertiser/creative-studio" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-brand-600">
        <ArrowLeft className="h-4 w-4" /> Creative Studio
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">{j.business_name ?? "Design request"}</h1>
          <p className="mt-1 text-sm text-ink-500">{j.format ?? "—"} {j.deadline ? `· due ${formatDate(j.deadline)}` : ""}</p>
          <div className="mt-2"><StatusBadge status={j.status} /></div>
        </div>
        <div className="flex gap-2">
          {["NEW_REQUEST", "ASSIGNED", "DESIGNING", "REVIEW", "REVISION_REQUESTED", "FINAL_APPROVAL"].includes(j.status) && (
            <Button variant="outline" icon={<RotateCcw className="h-4 w-4" />} onClick={() => update.mutate("REVISION_REQUESTED")}>
              Request Changes
            </Button>
          )}
          {["NEW_REQUEST", "ASSIGNED", "DESIGNING", "REVIEW", "REVISION_REQUESTED", "FINAL_APPROVAL"].includes(j.status) && (
            <Button icon={<CheckCircle2 className="h-4 w-4" />} onClick={() => update.mutate("APPROVED")}>
              Approve Design
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Brief" />
          <div className="space-y-2.5 px-5 py-4 text-sm">
            {[
              ["Product / service", j.product_service],
              ["Objective", j.objective],
              ["Target audience", j.target_audience],
              ["Style", j.preferred_style],
              ["Colors", j.preferred_colors],
              ["Required text", j.required_text],
              ["Budget", j.budget != null ? `₹${j.budget}` : null],
            ].filter(([, v]) => v).map(([k, v]) => (
              <div key={k as string} className="flex gap-3">
                <span className="w-32 shrink-0 text-ink-400">{k}</span>
                <span className="text-ink-800">{v}</span>
              </div>
            ))}
            {j.brief && <p className="rounded-xl bg-ink-50 p-3 text-xs leading-relaxed text-ink-600">{j.brief}</p>}
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {attachments.map((a: { url: string; name: string }, i: number) => (
                  <a key={i} href={a.url} target="_blank" rel="noreferrer" className="rounded-lg bg-ink-100 px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-ink-200">
                    {a.name}
                  </a>
                ))}
              </div>
            )}
            {driveLinks.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {driveLinks.map((l: string, i: number) => (
                  <a key={i} href={l} target="_blank" rel="noreferrer" className="rounded-lg bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-700 hover:bg-sky-100">
                    Drive link {i + 1}
                  </a>
                ))}
              </div>
            )}
          </div>
        </Card>
        <Card>
          <CardHeader title="Design workspace" subtitle="Communicate with the agency designer here" />
          <CardBody className="p-3">
            <Thread threadType="creative_job" threadId={j.id} />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
