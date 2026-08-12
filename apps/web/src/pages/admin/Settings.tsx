import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Save, Plus } from "lucide-react";
import { api } from "../../lib/api";
import { apiErrorMessage } from "../../lib/utils";
import { Button, Card, CardBody, CardHeader, Input, PageLoader, Textarea } from "../../components/ui";

interface Settings {
  settings: { key: string; value: string }[];
  cms: { key: string; content: string }[];
}

export function AdmSettingsPage() {
  const qc = useQueryClient();
  const [error, setError] = useState("");
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [cmsEdits, setCmsEdits] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "settings"],
    queryFn: () => api.get<Settings>("/api/admin/settings"),
  });

  const saveSetting = useMutation({
    mutationFn: (key: string) => api.post("/api/admin/settings", { key, value: edits[key] ?? "" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "settings"] }),
    onError: (e) => setError(apiErrorMessage(e)),
  });

  const saveCms = useMutation({
    mutationFn: (key: string) => {
      const raw = cmsEdits[key] ?? "";
      let content: unknown = raw;
      try {
        content = JSON.parse(raw);
      } catch {
        content = raw;
      }
      return api.post("/api/admin/cms", { key, content });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "settings"] }),
    onError: (e) => setError(apiErrorMessage(e)),
  });

  if (isLoading || !data) return <PageLoader />;

  const grouped = [
    { title: "Commission engine", desc: "Global commission & tax — recorded permanently at booking time.", keys: ["commission.global.percent", "commission.global.fixedFee", "commission.taxPercent"] },
    { title: "Agency information", desc: "Shown on invoices and the public site.", keys: ["agency.name", "agency.legal_name", "agency.registration", "agency.address", "agency.email", "agency.phone", "agency.gst"] },
    { title: "Operations", desc: "Inventory and invoicing behaviour.", keys: ["inventory.reservation_minutes", "invoice.prefix", "app.currency"] },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">Settings & Content Management</h1>
        <p className="mt-1 text-sm text-ink-500">Configure the agency, commission engine and public website content.</p>
      </div>

      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {grouped.map((g) => (
        <Card key={g.title}>
          <CardHeader title={g.title} subtitle={g.desc} />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            {g.keys.map((key) => {
              const row = data.settings.find((s) => s.key === key);
              return (
                <div key={key} className="space-y-1.5">
                  <label className="text-sm font-medium text-ink-700">{key}</label>
                  <div className="flex gap-2">
                    <Input value={edits[key] ?? row?.value ?? ""} onChange={(e) => setEdits((f) => ({ ...f, [key]: e.target.value }))} />
                    <Button size="sm" variant="outline" icon={<Save className="h-4 w-4" />} loading={saveSetting.isPending} onClick={() => saveSetting.mutate(key)}>
                      Save
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardBody>
        </Card>
      ))}

      <Card>
        <CardHeader title="Website content (CMS)" subtitle="Homepage hero, services, team, testimonials — editable without code" />
        <CardBody className="space-y-6">
          {data.cms.length === 0 && (
            <div className="rounded-xl border border-dashed border-ink-300 p-6 text-center text-sm text-ink-400">
              No CMS blocks yet. Use the API to add blocks, or add them here:
              <div className="mt-3 flex justify-center gap-2">
                <Button size="sm" variant="outline" icon={<Plus className="h-4 w-4" />} onClick={() => {}}>Not available in UI — use API</Button>
              </div>
            </div>
          )}
          {data.cms.map((row) => {
            let pretty = row.content;
            try {
              pretty = JSON.stringify(JSON.parse(row.content), null, 2);
            } catch { /* keep raw */ }
            return (
              <div key={row.key} className="space-y-1.5">
                <label className="text-sm font-medium text-ink-700">{row.key}</label>
                <Textarea rows={6} className="font-mono text-xs" defaultValue={pretty} onChange={(e) => setCmsEdits((f) => ({ ...f, [row.key]: e.target.value }))} />
                <Button size="sm" variant="outline" icon={<Save className="h-4 w-4" />} onClick={() => saveCms.mutate(row.key)}>Save block</Button>
              </div>
            );
          })}
        </CardBody>
      </Card>
    </div>
  );
}
