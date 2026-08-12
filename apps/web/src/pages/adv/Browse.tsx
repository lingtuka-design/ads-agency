import { useQuery } from "@tanstack/react-query";
import { Link, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Search, Heart, MapPin, Target, Users, CalendarCheck } from "lucide-react";
import { api } from "../../lib/api";
import { formatNumber } from "../../lib/utils";
import { Badge, Button, Card, EmptyState, Input, PageLoader, Pagination, Select, VerifyBadge } from "../../components/ui";
import { BookingModal } from "../../components/BookingModal";
import { cn } from "../../lib/utils";

interface PublisherItem {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  verified: number;
  trust_level: string;
  featured: number;
  platform: string | null;
  followers: number;
  engagement_rate: number | null;
  audience_location: string | null;
  primary_age_group: string | null;
  starting_price: number | null;
}

interface Pkg {
  id: string;
  title: string;
  price: number;
  platform: string;
  available_slots: number;
  duration_days: number;
  publisher_name: string;
  publisher_slug: string;
}

export function AdvBrowsePage() {
  const search = useSearch({ from: "/advertiser/publishers" }) as Record<string, unknown>;
  const [q, setQ] = useState(typeof search.q === "string" ? search.q : "");
  const [platform, setPlatform] = useState("");
  const [sort, setSort] = useState("recommended");
  const [page, setPage] = useState(1);
  const [bookPkg, setBookPkg] = useState<Pkg | null>(null);
  const [debouncedQ, setDebouncedQ] = useState(q);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 400);
    return () => clearTimeout(t);
  }, [q]);

  const { data, isLoading } = useQuery({
    queryKey: ["adv-browse", { debouncedQ, platform, sort, page }],
    queryFn: () => {
      const params = new URLSearchParams();
      if (debouncedQ) params.set("q", debouncedQ);
      if (platform) params.set("platform", platform);
      params.set("sort", sort);
      params.set("page", String(page));
      params.set("pageSize", "9");
      return api.get<{ items: PublisherItem[]; total: number }>("/api/public/publishers?" + params);
    },
  });

  const { data: packages } = useQuery({
    queryKey: ["adv-packages-all"],
    queryFn: () => api.get<Pkg[]>(`/api/public/packages?pageSize=100`),
  });

  // Auto-open the booking modal when arriving with ?pkg=<id> (e.g. "Book Now" on a publisher profile)
  const [pendingPkgId, setPendingPkgId] = useState<string | null>(
    typeof search.pkg === "string" ? search.pkg : null,
  );
  useEffect(() => {
    if (!pendingPkgId || !packages) return;
    const found = (Array.isArray(packages) ? packages : []).find((p) => p.id === pendingPkgId);
    if (found) {
      setBookPkg(found);
      setPendingPkgId(null);
    }
  }, [pendingPkgId, packages]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">Find Publishers</h1>
        <p className="mt-1 text-sm text-ink-500">Search verified publishers, compare rates, and book advertising packages in a few clicks.</p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-ink-400" />
          <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search publishers…" className="pl-10" />
        </div>
        <Select value={platform} onChange={(e) => { setPlatform(e.target.value); setPage(1); }} className="sm:w-44">
          <option value="">All platforms</option>
          {["INSTAGRAM", "FACEBOOK", "YOUTUBE", "WEBSITE", "NEWSPAPER", "TELEVISION", "RADIO", "OUTDOOR"].map((p) => <option key={p}>{p}</option>)}
        </Select>
        <Select value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }} className="sm:w-48">
          <option value="recommended">Recommended</option>
          <option value="price-asc">Lowest price</option>
          <option value="followers">Highest followers</option>
          <option value="engagement">Highest engagement</option>
        </Select>
      </div>

      {isLoading ? <PageLoader /> : (data?.items.length ?? 0) === 0 ? (
        <EmptyState title="No publishers found" description="Try different filters or search terms." />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data?.items.map((p) => (
              <Card key={p.id} className="flex flex-col p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-sm font-bold text-brand-700">
                      {p.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="font-semibold text-ink-900">{p.name}</p>
                        <VerifyBadge verified={p.verified} />
                      </div>
                      <p className="text-xs text-ink-400">{p.platform ?? "Media"}</p>
                    </div>
                  </div>
                  <Heart className="h-4 w-4 text-ink-300" />
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-lg bg-ink-50 p-2"><Users className="mx-auto h-3.5 w-3.5 text-ink-400" /><p className="mt-0.5 font-semibold">{formatNumber(p.followers)}</p><p className="text-[10px] text-ink-400">followers</p></div>
                  <div className="rounded-lg bg-ink-50 p-2"><Target className="mx-auto h-3.5 w-3.5 text-ink-400" /><p className="mt-0.5 font-semibold">{p.primary_age_group ?? "—"}</p><p className="text-[10px] text-ink-400">audience</p></div>
                  <div className="rounded-lg bg-ink-50 p-2"><MapPin className="mx-auto h-3.5 w-3.5 text-ink-400" /><p className="mt-0.5 font-semibold">{p.audience_location ?? "—"}</p><p className="text-[10px] text-ink-400">location</p></div>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-ink-100 pt-3 text-sm">
                  <span className="text-ink-500">From <span className="font-bold text-ink-900">{p.starting_price != null ? "₹" + p.starting_price.toLocaleString("en-IN") : "—"}</span></span>
                  <Link to="/publishers/$slug" params={{ slug: p.slug }} className="text-xs font-semibold text-brand-600 hover:underline">View profile</Link>
                </div>
              </Card>
            ))}
          </div>

          <div className="mt-10">
            <h2 className="text-lg font-bold text-ink-900">Available packages right now</h2>
            <p className="mt-1 text-sm text-ink-500">Live inventory — book directly without contacting the publisher.</p>
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {(Array.isArray(packages) ? packages : []).slice(0, 6).map((p) => (
                <Card key={p.id} className={cn("flex flex-col p-5", p.available_slots <= 0 && "opacity-60")}>
                  <div className="flex items-center justify-between">
                    <Badge tone="blue">{p.platform}</Badge>
                    <span className={cn("text-xs font-semibold", p.available_slots <= 0 ? "text-red-600" : "text-emerald-600")}>
                      {p.available_slots <= 0 ? "Sold out" : `${p.available_slots} slot(s) left`}
                    </span>
                  </div>
                  <h3 className="mt-2.5 font-semibold text-ink-900">{p.title}</h3>
                  <p className="text-xs text-ink-400">{p.publisher_name} · {p.duration_days} days</p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-lg font-bold text-ink-900">₹{p.price.toLocaleString("en-IN")}</span>
                    <Button size="sm" icon={<CalendarCheck className="h-4 w-4" />} disabled={p.available_slots <= 0} onClick={() => setBookPkg(p)}>
                      Book Now
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          <div className="mt-8">
            <Pagination page={page} pageSize={9} total={data?.total ?? 0} onChange={setPage} />
          </div>
        </>
      )}

      {bookPkg && (
        <BookingModal
          open={!!bookPkg}
          onClose={() => setBookPkg(null)}
          pkg={bookPkg}
        />
      )}
    </div>
  );
}
