import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ShieldCheck, Plus, Save } from "lucide-react";
import { api } from "../../lib/api";
import { apiErrorMessage } from "../../lib/utils";
import { Badge, Button, Card, CardHeader, Dialog, Field, Input, PageLoader, Select, Table, Td } from "../../components/ui";

interface StaffRow {
  user_id: string;
  staff_role: string;
  title: string | null;
  bio: string | null;
  active: number;
  email: string;
  name: string;
  account_status: string;
}

const ROLES = ["SUPER_ADMIN", "FINANCE_ADMIN", "CAMPAIGN_MANAGER", "CREATIVE_MANAGER", "SUPPORT_STAFF", "CONTENT_MANAGER"];

export function AdmStaffPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ email: "", name: "", staff_role: "CAMPAIGN_MANAGER", title: "", bio: "", password: "" });

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "staff"],
    queryFn: () => api.get<StaffRow[]>("/api/admin/staff"),
  });

  const create = useMutation({
    mutationFn: () => api.post("/api/admin/staff", { ...form, password: form.password || undefined }),
    onSuccess: () => {
      setOpen(false);
      setForm({ email: "", name: "", staff_role: "CAMPAIGN_MANAGER", title: "", bio: "", password: "" });
      qc.invalidateQueries({ queryKey: ["admin", "staff"] });
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => api.patch("/api/admin/staff/" + id, { active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "staff"] }),
    onError: (e) => alert(apiErrorMessage(e)),
  });

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Staff Management</h1>
          <p className="mt-1 text-sm text-ink-500">Internal staff with granular permissions — finance, campaigns, creative, support.</p>
        </div>
        <Button icon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>Add staff</Button>
      </div>

      <Card>
        <Table headers={["Staff", "Role", "Permissions scope", "Status", "Actions"]}>
          {(data ?? []).map((s) => (
            <tr key={s.user_id} className="hover:bg-ink-50/60">
              <Td>
                <p className="font-medium text-ink-900">{s.name}</p>
                <p className="text-xs text-ink-400">{s.email}</p>
              </Td>
              <Td><Badge tone={s.staff_role === "SUPER_ADMIN" ? "violet" : "brand"}>{s.staff_role}</Badge></Td>
              <Td className="text-xs text-ink-500">
                {s.staff_role === "SUPER_ADMIN" ? "Everything" : s.staff_role === "FINANCE_ADMIN" ? "Payments, settlements, invoices, reports" : s.staff_role === "CREATIVE_MANAGER" ? "Creative studio, files, messages" : s.staff_role === "CAMPAIGN_MANAGER" ? "Campaigns, bookings, publishers" : s.staff_role === "CONTENT_MANAGER" ? "CMS, content, publishers" : "Disputes, campaigns, support"}
              </Td>
              <Td>
                <Badge tone={s.active === 1 ? "green" : "red"}>{s.active === 1 ? "Active" : "Disabled"}</Badge>
              </Td>
              <Td>
                <Button size="sm" variant="outline" onClick={() => toggle.mutate({ id: s.user_id, active: s.active !== 1 })}>
                  {s.active === 1 ? "Disable" : "Enable"}
                </Button>
              </Td>
            </tr>
          ))}
        </Table>
      </Card>

      <Card>
        <CardHeader title="Permission model" subtitle="Staff permissions are enforced server-side on every admin endpoint" />
        <div className="space-y-2 px-5 py-4 text-sm">
          {[
            ["SUPER_ADMIN", "Full access, including settings, staff and audit logs."],
            ["FINANCE_ADMIN", "Payments, settlements, invoices, commission and reports. No staff or CMS changes."],
            ["CAMPAIGN_MANAGER", "Campaigns, bookings, publishers and advertiser management."],
            ["CREATIVE_MANAGER", "Creative Studio, files and design request assignment."],
            ["SUPPORT_STAFF", "Dispute resolution, campaign visibility and support."],
            ["CONTENT_MANAGER", "Public website content (CMS) and publisher listings."],
          ].map(([role, desc]) => (
            <p key={role} className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" /><span><span className="font-semibold text-ink-900">{role}</span> — <span className="text-ink-500">{desc}</span></span></p>
          ))}
        </div>
      </Card>

      <Dialog open={open} onClose={() => setOpen(false)} title="Add staff member">
        <div className="space-y-4">
          <Field label="Email" required>
            <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="Name" required>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Role">
            <Select value={form.staff_role} onChange={(e) => setForm({ ...form, staff_role: e.target.value })}>
              {ROLES.map((r) => <option key={r}>{r}</option>)}
            </Select>
          </Field>
          <Field label="Title">
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Creative Manager" />
          </Field>
          <Field label="Password" hint="Leave empty to auto-generate; user must change on first login">
            <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </Field>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button loading={create.isPending} icon={<Save className="h-4 w-4" />} onClick={() => create.mutate()}>Create staff</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
