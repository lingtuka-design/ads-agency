import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Pencil, Trash2, Package } from "lucide-react";
import { api } from "../../lib/api";
import { apiErrorMessage, formatMoney } from "../../lib/utils";
import { Badge, Button, Card, Dialog, EmptyState, Field, Input, PageLoader, Select, Textarea } from "../../components/ui";

interface Pkg {
  id: string;
  title: string;
  platform: string;
  description: string | null;
  price: number;
  quantity: number;
  duration_days: number;
  total_slots: number;
  booked_slots: number;
  reserved_slots: number;
  available_slots: number;
  availability_start: string | null;
  availability_end: string | null;
  blackout_dates: string | null;
  is_active: number;
  is_featured: number;
  creative_specs: string | null;
  requirements: string | null;
}

const PLATFORMS = ["INSTAGRAM", "FACEBOOK", "YOUTUBE", "WEBSITE", "NEWSPAPER", "TELEVISION", "RADIO", "DIGITAL_MAGAZINE", "OUTDOOR", "OTHER"];

const emptyForm = {
  title: "", platform: "INSTAGRAM", description: "", price: "", quantity: "1", duration_days: "30",
  total_slots: "5", availability_start: "", availability_end: "", requirements: "",
  creative_specs: '{"dimensions":"1080x1920","formats":["jpg","png","mp4"],"maxSizeMB":10}',
};

export function PubPackagesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Pkg | null>(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading } = useQuery({
    queryKey: ["pub", "packages"],
    queryFn: () => api.get<Pkg[]>("/api/publishers/me/packages"),
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        title: form.title,
        platform: form.platform,
        description: form.description || null,
        price: parseFloat(form.price),
        quantity: parseInt(form.quantity, 10),
        duration_days: parseInt(form.duration_days, 10),
        total_slots: parseInt(form.total_slots, 10),
        availability_start: form.availability_start || null,
        availability_end: form.availability_end || null,
        requirements: form.requirements || null,
        creative_specs: form.creative_specs ? JSON.parse(form.creative_specs) : null,
      };
      if (editing) {
        await api.patch(`/api/publishers/me/packages/${editing.id}`, body);
      } else {
        await api.post("/api/publishers/me/packages", body);
      }
    },
    onSuccess: () => {
      setOpen(false);
      setEditing(null);
      setForm(emptyForm);
      qc.invalidateQueries({ queryKey: ["pub", "packages"] });
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  const toggleActive = useMutation({
    mutationFn: (p: Pkg) => api.patch(`/api/publishers/me/packages/${p.id}`, { is_active: !p.is_active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pub", "packages"] }),
    onError: (e) => setError(apiErrorMessage(e)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.del("/api/publishers/me/packages/" + id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pub", "packages"] }),
    onError: (e) => setError(apiErrorMessage(e)),
  });

  if (isLoading) return <PageLoader />;
  const pkgs = data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">My Packages</h1>
          <p className="mt-1 text-sm text-ink-500">Your advertising inventory. Booked slots never overbook — the system guards every reservation.</p>
        </div>
        <Button icon={<Plus className="h-4 w-4" />} onClick={() => { setEditing(null); setForm(emptyForm); setOpen(true); }}>Create Package</Button>
      </div>

      {!pkgs.length ? (
        <Card>
          <EmptyState
            icon={<Package className="h-6 w-6" />}
            title="You haven't created an advertising package yet"
            description="Define what you sell — stories, posts, banners, slots — with price, quantity and available inventory."
            action={<Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>Create Package</Button>}
          />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {pkgs.map((p) => {
            const soldOut = p.available_slots <= 0;
            return (
              <Card key={p.id} className={`flex flex-col p-5 ${p.is_active === 0 ? "opacity-60" : ""}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone="blue">{p.platform}</Badge>
                    {p.is_active === 0 && <Badge tone="red">Paused</Badge>}
                    {p.is_featured === 1 && <Badge tone="violet">Featured</Badge>}
                  </div>
                  <div className="flex gap-1">
                    <button className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-brand-600" title="Edit" onClick={() => { setEditing(p); setForm({
                      title: p.title, platform: p.platform, description: p.description ?? "", price: String(p.price),
                      quantity: String(p.quantity), duration_days: String(p.duration_days), total_slots: String(p.total_slots),
                      availability_start: p.availability_start ?? "", availability_end: p.availability_end ?? "",
                      requirements: p.requirements ?? "", creative_specs: p.creative_specs ?? "",
                    }); setOpen(true); }}>
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button className="rounded-lg p-1.5 text-ink-400 hover:bg-red-50 hover:text-red-600" title="Delete" onClick={() => remove.mutate(p.id)}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <h3 className="mt-2 font-semibold text-ink-900">{p.title}</h3>
                <p className="mt-1 line-clamp-2 text-xs text-ink-500">{p.description}</p>
                <div className="mt-3 flex items-end justify-between">
                  <div>
                    <p className="text-xl font-bold text-ink-900">{formatMoney(p.price)}</p>
                    <p className="text-[11px] text-ink-400">{p.quantity} units · {p.duration_days} days</p>
                  </div>
                  <span className={`text-xs font-semibold ${soldOut ? "text-red-600" : "text-emerald-600"}`}>
                    {p.available_slots} / {p.total_slots} slots
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-100">
                  <div className="h-full rounded-full bg-brand-500" style={{ width: `${(p.booked_slots / Math.max(1, p.total_slots)) * 100}%` }} />
                </div>
                <div className="mt-3 text-[11px] text-ink-400">
                  Booked {p.booked_slots} · Reserved {p.reserved_slots} {p.availability_start && `· ${p.availability_start.slice(0, 10)} → ${p.availability_end?.slice(0, 10)}`}
                </div>
                <div className="mt-3 flex-1" />
                <Button variant="outline" size="sm" onClick={() => toggleActive.mutate(p)}>
                  {p.is_active === 1 ? "Pause package" : "Activate package"}
                </Button>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} title={editing ? "Edit package" : "Create advertising package"} wide>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Package name" required hint="e.g. 10 Instagram Stories / Month">
              <Input value={form.title} onChange={set("title")} />
            </Field>
          </div>
          <Field label="Platform" required>
            <Select value={form.platform} onChange={set("platform")}>{PLATFORMS.map((p) => <option key={p}>{p}</option>)}</Select>
          </Field>
          <Field label="Price (₹)" required>
            <Input type="number" min="0" value={form.price} onChange={set("price")} />
          </Field>
          <Field label="Quantity (units)" hint="e.g. 10 stories">
            <Input type="number" min="1" value={form.quantity} onChange={set("quantity")} />
          </Field>
          <Field label="Duration (days)" hint="e.g. 30">
            <Input type="number" min="1" value={form.duration_days} onChange={set("duration_days")} />
          </Field>
          <Field label="Total slots (capacity)" required hint="e.g. 5 campaigns per month">
            <Input type="number" min="1" value={form.total_slots} onChange={set("total_slots")} />
          </Field>
          <Field label="Availability window (optional)">
            <div className="flex gap-2">
              <Input type="date" value={form.availability_start} onChange={set("availability_start")} />
              <Input type="date" value={form.availability_end} onChange={set("availability_end")} />
            </div>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Description">
              <Textarea rows={2} value={form.description} onChange={set("description")} placeholder="What advertisers get with this package…" />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Creative specifications (JSON)" hint='e.g. {"dimensions":"1080x1920","formats":["jpg","png","mp4"]}'>
              <Textarea rows={2} value={form.creative_specs} onChange={set("creative_specs")} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Advertising requirements">
              <Textarea rows={2} value={form.requirements} onChange={set("requirements")} placeholder="Submission deadlines, content restrictions…" />
            </Field>
          </div>
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button loading={save.isPending} onClick={() => save.mutate()}>{editing ? "Save changes" : "Create package"}</Button>
        </div>
      </Dialog>
    </div>
  );
}
