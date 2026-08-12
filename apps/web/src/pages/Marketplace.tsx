import { useQuery } from "@tanstack/react-query";
import { Link, useSearch } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, SlidersHorizontal, Users, MapPin, Target } from "lucide-react";
import { api } from "../lib/api";
import { formatNumber } from "../lib/utils";
import { Badge, Input, Pagination, Select, VerifyBadge, EmptyState, Card, Button } from "../components/ui";
import { cn } from "../lib/utils";

interface PublisherItem {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  description: string | null;
  category: string | null;
  location: string | null;
  verified: number;
  trust_level: string;
  featured: number;
  platform: string | null;
  followers: number;
  subscribers: number | null;
  engagement_rate: number | null;
  audience_location: string | null;
  primary_age_group: string | null;
  starting_price: number | null;
  review_count: number;
  avg_rating: number;
}

const PLATFORMS = ["INSTAGRAM", "FACEBOOK", "YOUTUBE", "WEBSITE", "NEWSPAPER", "TELEVISION", "RADIO", "OUTDOOR", "OTHER"];

export function MarketplacePage() {
  const search = useSearch({ from: "/publishers" }) as Record<string, unknown>;
  const [q, setQ] = useState(typeof search.q === "string" ? search.q : "");
  const [platform, setPlatform] = useState("");
  const [sort, setSort] = useState("recommended");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [debouncedQ, setDebouncedQ] = useState(q);

  const queryKey = ["marketplace", { q: debouncedQ, platform, sort, verifiedOnly, page }];
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => {
      const params = new URLSearchParams();
      if (debouncedQ) params.set("q", debouncedQ);
      if (platform) params.set("platform", platform);
      if (sort) params.set("sort", sort);
      if (verifiedOnly) params.set("verified", "1");
      params.set("page", String(page));
      params.set("pageSize", "12");
      return api.get<{ items: PublisherItem[]; total: number; page: number; pageSize: number }>(
        "/api/public/publishers?" + params.toString(),
      );
    },
  });

  const debounceTimer = useMemo(() => {
    const t = setTimeout(() => setDebouncedQ(q), 400);
    return t;
  }, [q]);
  void debounceTimer;

  return (
    <div>
      <div className="border-b border-ink-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
          <h1 className="text-3xl font-bold tracking-tight text-ink-900">Find Publishers</h1>
          <p className="mt-2 max-w-2xl text-ink-500">
            Browse verified publishers, compare rates and audience reach, then book advertising packages directly.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-3 h-4 w-4 text-ink-400" />
              <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search publishers, categories, locations…" className="pl-10" />
            </div>
            <Select value={platform} onChange={(e) => { setPlatform(e.target.value); setPage(1); }} className="sm:w-48">
              <option value="">All platforms</option>
              {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
            </Select>
            <Select value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }} className="sm:w-52">
              <option value="recommended">Sort: Recommended</option>
              <option value="price-asc">Lowest price</option>
              <option value="followers">Highest followers</option>
              <option value="reach">Highest reach</option>
              <option value="engagement">Highest engagement</option>
              <option value="popular">Most popular</option>
              <option value="newest">Recently added</option>
            </Select>
          </div>
          <button
            onClick={() => { setVerifiedOnly((v) => !v); setPage(1); }}
            className={cn(
              "mt-3 inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
              verifiedOnly ? "border-sky-300 bg-sky-50 text-sky-700" : "border-ink-300 bg-white text-ink-600 hover:bg-ink-50",
            )}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" /> Verified only
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        {isLoading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-72 animate-pulse rounded-2xl border border-ink-200 bg-white shadow-sm" />)}
          </div>
        ) : (data?.items.length ?? 0) === 0 ? (
          <EmptyState
            title="No publishers match your search"
            description="Try adjusting your filters, or become the first publisher in your niche."
            action={<Link to="/register" search={{ role: "publisher" }}><Button>Become a Publisher</Button></Link>}
          />
        ) : (
          <>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {data?.items.map((p) => (
                <Link key={p.id} to="/publishers/$slug" params={{ slug: p.slug }} className="group">
                  <Card className="flex h-full flex-col overflow-hidden transition-all group-hover:-translate-y-0.5 group-hover:shadow-lg">
                    <div className="flex items-start justify-between p-5 pb-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-sm font-bold text-brand-700">
                          {p.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <p className="font-semibold text-ink-900">{p.name}</p>
                            <VerifyBadge verified={p.verified} />
                          </div>
                          <p className="text-xs text-ink-400">{p.platform ?? p.category ?? "Media"}</p>
                        </div>
                      </div>
                      {p.featured === 1 && <Badge tone="violet">Featured</Badge>}
                    </div>
                    <div className="flex-1 px-5 pb-4">
                      <p className="line-clamp-2 text-sm text-ink-500">{p.description ?? "Media publisher on the AdAgencyHub marketplace."}</p>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                        <div className="rounded-xl bg-ink-50 p-2.5">
                          <Users className="mx-auto h-3.5 w-3.5 text-ink-400" />
                          <p className="mt-1 text-sm font-bold text-ink-900">{formatNumber(p.followers)}</p>
                          <p className="text-[10px] text-ink-400">followers</p>
                        </div>
                        <div className="rounded-xl bg-ink-50 p-2.5">
                          <Target className="mx-auto h-3.5 w-3.5 text-ink-400" />
                          <p className="mt-1 text-sm font-bold text-ink-900">{p.primary_age_group ?? "—"}</p>
                          <p className="text-[10px] text-ink-400">audience</p>
                        </div>
                        <div className="rounded-xl bg-ink-50 p-2.5">
                          <MapPin className="mx-auto h-3.5 w-3.5 text-ink-400" />
                          <p className="mt-1 text-sm font-bold text-ink-900">{p.audience_location ?? "—"}</p>
                          <p className="text-[10px] text-ink-400">location</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between border-t border-ink-100 px-5 py-3.5">
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-ink-400">Starting price</p>
                        <p className="font-bold text-ink-900">{p.starting_price != null ? "₹" + p.starting_price.toLocaleString("en-IN") : "—"}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] uppercase tracking-wide text-ink-400">Rating</p>
                        <p className="text-sm font-semibold text-ink-700">{p.review_count > 0 ? `★ ${p.avg_rating.toFixed(1)} (${p.review_count})` : "New"}</p>
                      </div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
            <div className="mt-8">
              <Pagination page={page} pageSize={12} total={data?.total ?? 0} onChange={setPage} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
