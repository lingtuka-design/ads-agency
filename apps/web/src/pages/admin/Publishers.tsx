import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CheckCircle2, XCircle, Star, Search } from "lucide-react";
import { api } from "../../lib/api";
import { apiErrorMessage, formatDate } from "../../lib/utils";
import { Badge, Button, Card, Dialog, Field, Input, PageLoader, Pagination, Select, StatusBadge, Table, Td } from "../../components/ui";
import { cn } from "../../lib/utils";

interface PublisherRow {
  id: string;
  name: string;
  slug: string;
  status: string;
  trust_level: string;
  verified: number;
  featured: number;
  joined_at: string;
  location: string | null;
  category: string | null;
  email: string;
  owner_name: string;
  account_status: string;
  package_count: number;
  booking_count: number;
}

export function AdmPublishersPage() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<PublisherRow | null>(null);
  const [decision, setDecision] = useState({ status: "APPROVED", reason: "", trust_level: "VERIFIED", featured: false });
  const [error, setError] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "publishers", { statusFilter, q, page }],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), pageSize: "20" });
      if (statusFilter) params.set("status", statusFilter);
      if (q) params.set("q", q);
      return api.get<{ items: PublisherRow[]; total: number }>("/api/admin/publishers?" + params);
    },
  });

  const decide = useMutation({
    mutationFn: () => api.post(`/api/admin/publishers/${selected!.id}/decision`, decision),
    onSuccess: () => {
      setSelected(null);
      qc.invalidateQueries({ queryKey: ["admin", "publishers"] });
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">Publisher Management</h1>
        <p className="mt-1 text-sm text-ink-500">Application → Review → Verification → Approved → Active. You control who monetizes on the platform.</p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-ink-400" />
          <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search by name or email…" className="pl-10" />
        </div>
        <Select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="sm:w-48">
          <option value="">All statuses</option>
          {["PENDING", "INFO_REQUIRED", "APPROVED", "ACTIVE", "REJECTED", "SUSPENDED"].map((s) => <option key={s}>{s}</option>)}
        </Select>
      </div>

      {isLoading ? <PageLoader /> : (
        <Card>
          <Table headers={["Publisher", "Status", "Trust", "Stats", "Joined", "Actions"]}>
            {data?.items.map((p) => (
              <tr key={p.id} className="hover:bg-ink-50/60">
                <Td>
                  <p className="font-medium text-ink-900">{p.name}</p>
                  <p className="text-xs text-ink-400">{p.email}</p>
                </Td>
                <Td><StatusBadge status={p.status} /></Td>
                <Td>
                  <div className="flex flex-wrap gap-1">
                    <Badge tone={p.trust_level === "REGISTERED" ? "slate" : "violet"}>{p.trust_level}</Badge>
                    {p.verified === 1 && <Badge tone="blue">Verified</Badge>}
                    {p.featured === 1 && <Badge tone="brand">Featured</Badge>}
                  </div>
                </Td>
                <Td className="text-xs text-ink-500">{p.package_count} pkgs · {p.booking_count} bookings</Td>
                <Td className="text-xs text-ink-500">{formatDate(p.joined_at)}</Td>
                <Td>
                  <div className="flex gap-1.5">
                    {["PENDING", "INFO_REQUIRED", "SUSPENDED"].includes(p.status) && (
                      <button className="rounded-lg bg-emerald-50 p-1.5 text-emerald-600 hover:bg-emerald-100" title="Approve" onClick={() => { setSelected(p); setDecision({ status: "ACTIVE", reason: "", trust_level: "VERIFIED", featured: p.featured === 1 }); }}>
                        <CheckCircle2 className="h-4 w-4" />
                      </button>
                    )}
                    {["PENDING", "INFO_REQUIRED", "ACTIVE", "APPROVED"].includes(p.status) && (
                      <button className="rounded-lg bg-red-50 p-1.5 text-red-600 hover:bg-red-100" title="Reject / suspend" onClick={() => { setSelected(p); setDecision({ status: "SUSPENDED", reason: "", trust_level: p.trust_level as never, featured: p.featured === 1 }); }}>
                        <XCircle className="h-4 w-4" />
                      </button>
                    )}
                    <button className="rounded-lg bg-ink-100 p-1.5 text-ink-500 hover:bg-ink-200" title="Edit trust & featured" onClick={() => { setSelected(p); setDecision({ status: p.status, reason: "", trust_level: p.trust_level as never, featured: p.featured === 1 }); }}>
                      <Star className="h-4 w-4" />
                    </button>
                  </div>
                </Td>
              </tr>
            ))}
          </Table>
          <Pagination page={page} pageSize={20} total={data?.total ?? 0} onChange={setPage} />
        </Card>
      )}

      <Dialog open={!!selected} onClose={() => setSelected(null)} title={`Manage — ${selected?.name ?? ""}`}>
        <div className="space-y-4">
          <Field label="Status">
            <Select value={decision.status} onChange={(e) => setDecision({ ...decision, status: e.target.value })}>
              {["PENDING", "INFO_REQUIRED", "APPROVED", "ACTIVE", "REJECTED", "SUSPENDED"].map((s) => <option key={s}>{s}</option>)}
            </Select>
          </Field>
          <Field label="Trust level">
            <Select value={decision.trust_level} onChange={(e) => setDecision({ ...decision, trust_level: e.target.value })}>
              {["REGISTERED", "VERIFIED", "PREMIUM", "FEATURED"].map((s) => <option key={s}>{s}</option>)}
            </Select>
          </Field>
          <label className={cn("flex items-center gap-2 text-sm text-ink-700")}>
            <input type="checkbox" checked={decision.featured} onChange={(e) => setDecision({ ...decision, featured: e.target.checked })} />
            Featured on homepage
          </label>
          <Field label="Reason / note (sent to publisher)">
            <Input value={decision.reason} onChange={(e) => setDecision({ ...decision, reason: e.target.value })} placeholder="Required for rejection" />
          </Field>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setSelected(null)}>Cancel</Button>
            <Button loading={decide.isPending} onClick={() => decide.mutate()}>Apply</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
