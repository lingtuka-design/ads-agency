import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Wallet, CheckCircle2 } from "lucide-react";
import { api } from "../../lib/api";
import { apiErrorMessage, formatMoney } from "../../lib/utils";
import { Button, Card, Dialog, EmptyState, Field, Input, PageLoader, Select, StatusBadge, Table, Td } from "../../components/ui";

interface Settlement {
  id: string;
  publisher_id: string;
  status: string;
  amount: number;
  method: string | null;
  payout_ref: string | null;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
  publisher_name: string;
  item_count: number;
}

interface PayableBooking {
  booking_id: string;
  amount: number;
}

export function AdmSettlementsPage() {
  const qc = useQueryClient();
  const [publisherId, setPublisherId] = useState("");
  const [method, setMethod] = useState("BANK_TRANSFER");
  const [notes, setNotes] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<Settlement | null>(null);
  const [payoutRef, setPayoutRef] = useState("");
  const [error, setError] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "settlements"],
    queryFn: () => api.get<Settlement[]>("/api/settlements"),
  });

  const { data: payable } = useQuery({
    queryKey: ["admin", "payable", publisherId],
    queryFn: () => api.get<PayableBooking[]>("/api/admin/payable/" + publisherId),
    enabled: !!publisherId,
  });

  const { data: publishers } = useQuery({
    queryKey: ["admin", "publishers", "all"],
    queryFn: () => api.get<{ items: { id: string; name: string }[] }>("/api/admin/publishers?pageSize=100"),
  });

  const create = useMutation({
    mutationFn: () =>
      api.post("/api/settlements", {
        publisher_id: publisherId,
        booking_ids: (payable ?? []).map((p) => p.booking_id),
        method,
        notes: notes || null,
      }),
    onSuccess: () => {
      setCreateOpen(false);
      setNotes("");
      qc.invalidateQueries({ queryKey: ["admin", "settlements"] });
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  const pay = useMutation({
    mutationFn: () => api.post(`/api/settlements/${selected!.id}/pay`, { status: "PAID", payout_ref: payoutRef || null }),
    onSuccess: () => {
      setSelected(null);
      setPayoutRef("");
      qc.invalidateQueries({ queryKey: ["admin", "settlements"] });
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Publisher Settlements</h1>
          <p className="mt-1 text-sm text-ink-500">Payment received → Commission calculated → Settlement created → Reviewed → Paid.</p>
        </div>
        <Button icon={<Wallet className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>Create Settlement</Button>
      </div>

      <Card>
        <Table headers={["Publisher", "Amount", "Method", "Items", "Ref", "Status"]}>
          {(data ?? []).map((s) => (
            <tr key={s.id} className="hover:bg-ink-50/60">
              <Td className="font-medium text-ink-900">{s.publisher_name}</Td>
              <Td className="font-semibold">{formatMoney(s.amount)}</Td>
              <Td className="text-xs text-ink-500">{s.method ?? "—"}</Td>
              <Td>{s.item_count}</Td>
              <Td className="font-mono text-xs">{s.payout_ref ?? "—"}</Td>
              <Td>
                <div className="flex items-center gap-2">
                  <StatusBadge status={s.status} />
                  {s.status === "PENDING" || s.status === "APPROVED" ? (
                    <Button size="sm" icon={<CheckCircle2 className="h-4 w-4" />} onClick={() => setSelected(s)}>Pay</Button>
                  ) : null}
                </div>
              </Td>
            </tr>
          ))}
        </Table>
        {!data?.length && <EmptyState icon={<Wallet className="h-6 w-6" />} title="No settlements yet" description="Create one for a publisher with verified paid campaigns." />}
      </Card>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} title="Create settlement" wide>
        <div className="space-y-4">
          <Field label="Publisher" required>
            <Select value={publisherId} onChange={(e) => setPublisherId(e.target.value)}>
              <option value="">Select publisher…</option>
              {(publishers?.items ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </Field>
          {publisherId && (
            <div className="rounded-xl bg-ink-50 p-4 text-sm">
              <p className="font-semibold text-ink-900">Payable now</p>
              {!payable?.length ? (
                <p className="mt-1 text-ink-500">No verified, unsettled bookings for this publisher.</p>
              ) : (
                <p className="mt-1 text-ink-600">
                  {payable.length} booking(s) · total{" "}
                  <span className="font-bold">{formatMoney(payable.reduce((s, p) => s + p.amount, 0))}</span>
                </p>
              )}
            </div>
          )}
          <Field label="Payout method">
            <Select value={method} onChange={(e) => setMethod(e.target.value)}>
              {["BANK_TRANSFER", "UPI", "MANUAL", "CHECK"].map((m) => <option key={m}>{m}</option>)}
            </Select>
          </Field>
          <Field label="Notes">
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button loading={create.isPending} disabled={!publisherId || !payable?.length} onClick={() => create.mutate()}>Create settlement</Button>
          </div>
        </div>
      </Dialog>

      <Dialog open={!!selected} onClose={() => setSelected(null)} title={`Pay — ${selected?.publisher_name ?? ""}`}>
        <div className="space-y-4">
          <div className="rounded-xl bg-ink-50 p-4 text-center">
            <p className="text-xs text-ink-400">Amount</p>
            <p className="text-3xl font-bold text-ink-900">{formatMoney(selected?.amount ?? 0)}</p>
          </div>
          <Field label="Payout reference number" required>
            <Input value={payoutRef} onChange={(e) => setPayoutRef(e.target.value)} placeholder="e.g. NEFT-12345" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setSelected(null)}>Cancel</Button>
            <Button variant="success" loading={pay.isPending} disabled={!payoutRef} onClick={() => pay.mutate()}>Mark as Paid</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
