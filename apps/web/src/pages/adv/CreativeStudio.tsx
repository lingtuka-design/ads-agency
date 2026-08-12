import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Palette, Plus, Upload } from "lucide-react";
import { api, uploadFile } from "../../lib/api";
import { apiErrorMessage, formatDate } from "../../lib/utils";
import { Button, Card, Dialog, EmptyState, Field, Input, PageLoader, Select, StatusBadge, Textarea } from "../../components/ui";

interface Job {
  id: string;
  status: string;
  business_name: string | null;
  product_service: string | null;
  format: string | null;
  budget: number | null;
  deadline: string | null;
  created_at: string;
  assigned_to: string | null;
  advertiser_name: string | null;
}

export function AdvCreativeStudioPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [driveLinks, setDriveLinks] = useState("");
  const [form, setForm] = useState({
    business_name: "", product_service: "", objective: "", target_audience: "",
    preferred_style: "", preferred_colors: "", required_text: "", format: "SOCIAL_FLYER",
    budget: "", deadline: "", brief: "",
  });

  const { data: jobs, isLoading } = useQuery({
    queryKey: ["adv", "creative-jobs"],
    queryFn: () => api.get<Job[]>("/api/creatives/jobs"),
  });

  const create = useMutation({
    mutationFn: async () => {
      const attachments = [];
      for (const f of files) {
        const up = await uploadFile(f);
        attachments.push({ url: up.url, name: up.file_name });
      }
      await api.post("/api/creatives/jobs", {
        ...form,
        budget: form.budget ? parseFloat(form.budget) : null,
        deadline: form.deadline || null,
        attachments: attachments.length ? attachments : null,
        drive_links: driveLinks.split("\n").map((s) => s.trim()).filter(Boolean).length ? driveLinks.split("\n").map((s) => s.trim()).filter(Boolean) : null,
      });
    },
    onSuccess: () => {
      setOpen(false);
      setFiles([]);
      setForm({ business_name: "", product_service: "", objective: "", target_audience: "", preferred_style: "", preferred_colors: "", required_text: "", format: "SOCIAL_FLYER", budget: "", deadline: "", brief: "" });
      qc.invalidateQueries({ queryKey: ["adv", "creative-jobs"] });
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Creative Studio</h1>
          <p className="mt-1 text-sm text-ink-500">Don't have an advertisement? The agency creates it for you — flyers, posters, videos and more.</p>
        </div>
        <Button icon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>Request a Design</Button>
      </div>

      {!jobs?.length ? (
        <Card>
          <EmptyState
            icon={<Palette className="h-6 w-6" />}
            title="No design requests yet"
            description="Tell the agency about your business and they'll design your advertisement — inside the platform, with revisions and approvals."
            action={<Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>Request a Design</Button>}
          />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {jobs.map((j) => (
            <Link key={j.id} to="/advertiser/creative-studio/$id" params={{ id: j.id }}>
              <Card className="p-5 transition-all hover:-translate-y-0.5 hover:shadow-lg">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-ink-900">{j.business_name ?? "Design request"}</h3>
                    <p className="mt-1 text-xs text-ink-400">
                      {j.product_service ?? "—"} · {j.format ?? "—"} {j.deadline ? `· due ${formatDate(j.deadline)}` : ""}
                    </p>
                  </div>
                  <StatusBadge status={j.status} />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} title="Request a design" wide>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Business / company name" required>
            <Input value={form.business_name} onChange={(e) => setForm({ ...form, business_name: e.target.value })} />
          </Field>
          <Field label="Product / service">
            <Input value={form.product_service} onChange={(e) => setForm({ ...form, product_service: e.target.value })} />
          </Field>
          <Field label="Campaign objective">
            <Input value={form.objective} onChange={(e) => setForm({ ...form, objective: e.target.value })} placeholder="e.g. Launch promotion" />
          </Field>
          <Field label="Target audience">
            <Input value={form.target_audience} onChange={(e) => setForm({ ...form, target_audience: e.target.value })} placeholder="e.g. Youth 18-30 in Mizoram" />
          </Field>
          <Field label="Preferred style">
            <Input value={form.preferred_style} onChange={(e) => setForm({ ...form, preferred_style: e.target.value })} placeholder="e.g. Modern, colorful" />
          </Field>
          <Field label="Preferred colors">
            <Input value={form.preferred_colors} onChange={(e) => setForm({ ...form, preferred_colors: e.target.value })} placeholder="e.g. Blue & white" />
          </Field>
          <Field label="Required format" required>
            <Select value={form.format} onChange={(e) => setForm({ ...form, format: e.target.value })}>
              {["SOCIAL_FLYER", "POSTER", "BANNER", "VIDEO", "REEL", "YOUTUBE_AD", "MOTION_GRAPHIC", "CAMPAIGN_CREATIVE", "OTHER"].map((f) => <option key={f}>{f}</option>)}
            </Select>
          </Field>
          <Field label="Budget (₹)">
            <Input type="number" min="0" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} />
          </Field>
          <Field label="Deadline">
            <Input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
          </Field>
          <Field label="Required text">
            <Input value={form.required_text} onChange={(e) => setForm({ ...form, required_text: e.target.value })} placeholder="Text to appear on the design" />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Brief & additional instructions">
              <Textarea rows={3} value={form.brief} onChange={(e) => setForm({ ...form, brief: e.target.value })} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Reference images / logo / product photos" hint="Multiple files allowed">
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-ink-300 px-4 py-5 text-sm text-ink-500 hover:border-brand-400 hover:bg-brand-50/40">
                <Upload className="h-5 w-5" />
                {files.length ? files.map((f) => f.name).join(", ") : "Upload reference images…"}
                <input type="file" className="hidden" multiple accept=".jpg,.jpeg,.png,.webp,.pdf" onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
              </label>
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Google Drive / cloud links for videos" hint="One per line">
              <Textarea rows={2} value={driveLinks} onChange={(e) => setDriveLinks(e.target.value)} placeholder="https://drive.google.com/…" />
            </Field>
          </div>
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button loading={create.isPending} onClick={() => create.mutate()}>Submit request</Button>
        </div>
      </Dialog>
    </div>
  );
}
