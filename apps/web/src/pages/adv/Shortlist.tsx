import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Heart, Trash2, Package } from "lucide-react";
import { api } from "../../lib/api";
import { formatMoney } from "../../lib/utils";
import { Button, Card, CardHeader, EmptyState, PageLoader } from "../../components/ui";

interface Favorite {
  id: string;
  publisher_id: string | null;
  package_id: string | null;
  publisher_name: string | null;
  publisher_slug: string | null;
  package_title: string | null;
  package_price: number | null;
  package_platform: string | null;
  created_at: string;
}

export function AdvShortlistPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["favorites"],
    queryFn: () => api.get<Favorite[]>("/api/favorites"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.del("/api/favorites/" + id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["favorites"] }),
  });

  if (isLoading) return <PageLoader />;
  const favs = data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">My Shortlist</h1>
        <p className="mt-1 text-sm text-ink-500">Publishers and packages you're comparing before booking.</p>
      </div>
      <Card>
        <CardHeader title="Shortlist" subtitle={`${favs.length} saved item(s)`} />
        {!favs.length ? (
          <EmptyState
            icon={<Heart className="h-6 w-6" />}
            title="Nothing saved yet"
            description="Tap the heart on a publisher profile or save a package to compare options here."
            action={<Link to="/advertiser/publishers"><Button size="sm">Browse Publishers</Button></Link>}
          />
        ) : (
          <div className="divide-y divide-ink-100">
            {favs.map((f) => (
              <div key={f.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ink-100 text-ink-500">
                    {f.package_id ? <Package className="h-5 w-5" /> : <Heart className="h-5 w-5" />}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink-900">{f.package_title ?? f.publisher_name}</p>
                    <p className="text-xs text-ink-400">
                      {f.package_id ? `${f.package_platform ?? ""} · ${formatMoney(f.package_price ?? 0)}` : "Publisher profile"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {f.package_id ? (
                    <Button size="sm" onClick={() => { /* open booking */ }}>Book</Button>
                  ) : f.publisher_slug ? (
                    <Link to="/publishers/$slug" params={{ slug: f.publisher_slug }}><Button size="sm" variant="outline">View profile</Button></Link>
                  ) : null}
                  <button onClick={() => remove.mutate(f.id)} className="rounded-lg p-2 text-ink-400 hover:bg-red-50 hover:text-red-600" aria-label="Remove">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
