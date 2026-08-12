import { useQuery } from "@tanstack/react-query";
import { CreditCard } from "lucide-react";
import { api } from "../../lib/api";
import { formatDateTime, formatMoney, titleCase } from "../../lib/utils";
import { Card, EmptyState, PageLoader, StatusBadge, Table, Td } from "../../components/ui";

interface Payment {
  id: string;
  amount: number;
  currency: string;
  status: string;
  method: string | null;
  provider: string | null;
  provider_ref: string | null;
  paid_at: string | null;
  created_at: string;
  booking_id: string;
  package_title: string;
}

export function AdmPaymentsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "payments"],
    queryFn: () => api.get<{ items: Payment[]; total: number }>("/api/payments"),
  });

  if (isLoading) return <PageLoader />;

  const items = data?.items ?? [];
  const captured = items.filter((p) => p.status === "SUCCESSFUL").reduce((s, p) => s + p.amount, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">Payments</h1>
        <p className="mt-1 text-sm text-ink-500">
          {items.length} payment(s) · <span className="font-bold">captured {formatMoney(captured)}</span> — all verified server-side.
        </p>
      </div>
      <Card>
        <Table headers={["Ref", "Package", "Amount", "Provider", "Status", "Paid at"]}>
          {items.map((p) => (
            <tr key={p.id} className="hover:bg-ink-50/60">
              <Td className="font-mono text-xs">{p.provider_ref ?? "—"}</Td>
              <Td className="text-sm">{p.package_title}</Td>
              <Td className="font-semibold">{formatMoney(p.amount)}</Td>
              <Td className="text-xs text-ink-500">{p.provider ?? "—"} {p.method && `· ${titleCase(p.method)}`}</Td>
              <Td><StatusBadge status={p.status} /></Td>
              <Td className="text-xs text-ink-500">{p.paid_at ? formatDateTime(p.paid_at) : formatDateTime(p.created_at)}</Td>
            </tr>
          ))}
        </Table>
        {!items.length && <EmptyState icon={<CreditCard className="h-6 w-6" />} title="No payments yet" />}
      </Card>
    </div>
  );
}
