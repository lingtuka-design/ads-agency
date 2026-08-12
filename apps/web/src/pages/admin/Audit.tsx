import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ScrollText } from "lucide-react";
import { api } from "../../lib/api";
import { formatDateTime } from "../../lib/utils";
import { Card, EmptyState, PageLoader, Pagination, Select, Table, Td } from "../../components/ui";

interface AuditRow {
  id: string;
  action: string;
  entity: string | null;
  entity_id: string | null;
  old_value: string | null;
  new_value: string | null;
  user_email: string | null;
  ip: string | null;
  created_at: string;
}

export function AdmAuditPage() {
  const [action, setAction] = useState("");
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "audit", { action, page }],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), pageSize: "25" });
      if (action) params.set("action", action);
      return api.get<{ items: AuditRow[]; total: number }>("/api/admin/audit-logs?" + params);
    },
  });

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">Audit Logs</h1>
        <p className="mt-1 text-sm text-ink-500">Immutable record of sensitive system activity — who did what, when.</p>
      </div>

      <Select value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} className="sm:w-72">
        <option value="">All actions</option>
        {["LOGIN", "LOGOUT", "LOGIN_FAILED", "REGISTER", "PASSWORD_CHANGE", "PUBLISHER_APPROVED", "PUBLISHER_REJECTED", "PUBLISHER_SUSPENDED", "PACKAGE_CREATE", "BOOKING_CREATE", "BOOKING_CANCEL", "PAYMENT_SUCCESS", "PAYMENT_INITIATED", "SETTLEMENT_CREATE", "SETTLEMENT_UPDATE", "CREATIVE_UPLOAD", "CREATIVE_JOB_CREATE", "DISPUTE_CREATE", "DISPUTE_RESOLVE", "STAFF_CREATE", "SETTING_UPDATE", "CMS_UPDATE", "BOOTSTRAP_ADMIN"].map((a) => (
          <option key={a}>{a}</option>
        ))}
      </Select>

      <Card>
        {!data?.items.length ? (
          <EmptyState icon={<ScrollText className="h-6 w-6" />} title="No log entries" description="Actions will appear here as they happen." />
        ) : (
          <>
            <Table headers={["Time", "User", "Action", "Entity", "Change"]}>
              {data.items.map((l) => (
                <tr key={l.id} className="hover:bg-ink-50/60">
                  <Td className="whitespace-nowrap text-xs text-ink-500">{formatDateTime(l.created_at)}</Td>
                  <Td className="text-xs">{l.user_email ?? "system"}</Td>
                  <Td>
                    <span className="rounded-md bg-ink-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-ink-700">{l.action}</span>
                  </Td>
                  <Td className="text-xs text-ink-500">
                    {l.entity ?? "—"}<span className="block max-w-40 truncate font-mono text-[10px]">{l.entity_id ?? ""}</span>
                  </Td>
                  <Td className="max-w-64">
                    {l.old_value !== l.new_value && (
                      <p className="text-[11px] text-ink-500">
                        {l.old_value && <span className="text-red-500 line-through">{l.old_value.slice(0, 60)}</span>}
                        {l.old_value && l.new_value && " → "}
                        {l.new_value && <span className="text-emerald-600">{l.new_value.slice(0, 80)}</span>}
                      </p>
                    )}
                  </Td>
                </tr>
              ))}
            </Table>
            <Pagination page={page} pageSize={25} total={data?.total ?? 0} onChange={setPage} />
          </>
        )}
      </Card>
    </div>
  );
}
