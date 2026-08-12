import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PauseCircle, PlayCircle } from "lucide-react";
import { api } from "../../lib/api";
import { apiErrorMessage, formatMoney } from "../../lib/utils";
import { Button, Card, PageLoader, StatusBadge, Table, Td } from "../../components/ui";

interface AdvertiserRow {
  id: string;
  company_name: string | null;
  industry: string | null;
  location: string | null;
  verified: number;
  created_at: string;
  email: string;
  name: string;
  account_status: string;
  campaign_count: number;
  total_spend: number;
}

export function AdmAdvertisersPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "advertisers"],
    queryFn: () => api.get<AdvertiserRow[]>("/api/admin/advertisers"),
  });

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.post(`/api/admin/advertisers/${id}/status`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "advertisers"] }),
    onError: (e) => alert(apiErrorMessage(e)),
  });

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">Advertisers</h1>
        <p className="mt-1 text-sm text-ink-500">{data?.length ?? 0} advertiser account(s).</p>
      </div>
      <Card>
        <Table headers={["Advertiser", "Organization", "Spend", "Campaigns", "Account", "Actions"]}>
          {data?.map((a) => (
            <tr key={a.id} className="hover:bg-ink-50/60">
              <Td>
                <p className="font-medium text-ink-900">{a.company_name ?? a.name}</p>
                <p className="text-xs text-ink-400">{a.email}</p>
              </Td>
              <Td className="text-xs text-ink-500">{a.industry ?? "—"} · {a.location ?? "—"}</Td>
              <Td className="font-semibold">{formatMoney(a.total_spend)}</Td>
              <Td>{a.campaign_count}</Td>
              <Td><StatusBadge status={a.account_status} /></Td>
              <Td>
                <div className="flex gap-1.5">
                  {a.account_status === "ACTIVE" ? (
                    <Button size="sm" variant="outline" icon={<PauseCircle className="h-4 w-4" />} onClick={() => setStatus.mutate({ id: a.id, status: "SUSPENDED" })}>Suspend</Button>
                  ) : (
                    <Button size="sm" variant="outline" icon={<PlayCircle className="h-4 w-4" />} onClick={() => setStatus.mutate({ id: a.id, status: "ACTIVE" })}>Reactivate</Button>
                  )}
                </div>
              </Td>
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  );
}
