import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Users, MapPin, Target, TrendingUp, Globe, Mail, Phone, ArrowLeft, Heart, CalendarCheck, Sparkles, Star,
} from "lucide-react";
import { api } from "../lib/api";
import { apiErrorMessage, formatDate, formatNumber } from "../lib/utils";
import { Badge, Button, Card, CardBody, CardHeader, PageLoader, VerifyBadge, EmptyState } from "../components/ui";
import { useAuth } from "../lib/auth";
import { cn } from "../lib/utils";

interface PublisherProfile {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  cover_url: string | null;
  description: string | null;
  category: string | null;
  location: string | null;
  website_url: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  about: string | null;
  advertising_policies: string | null;
  verified: number;
  trust_level: string;
  featured: number;
  joined_at: string;
  platform: string | null;
  followers: number;
  subscribers: number | null;
  monthly_visitors: number | null;
  monthly_page_views: number | null;
  avg_reach: number | null;
  engagement_rate: number | null;
  audience_location: string | null;
  primary_age_group: string | null;
  gender_distribution: string | null;
  starting_price: number | null;
  review_count: number;
  avg_rating: number;
}

interface Pkg {
  id: string;
  title: string;
  platform: string;
  description: string | null;
  price: number;
  currency: string;
  quantity: number;
  duration_days: number;
  total_slots: number;
  booked_slots: number;
  reserved_slots: number;
  available_slots: number;
  availability_start: string | null;
  availability_end: string | null;
  creative_specs: string | null;
  requirements: string | null;
  is_featured: number;
}

export function PublisherProfilePage() {
  const { slug } = useParams({ from: "/publishers/$slug" });
  const { isAdvertiser } = useAuth();
  const qc = useQueryClient();
  const [error, setError] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["publisher", slug],
    queryFn: async () => {
      const res = await api.get<{ publisher: PublisherProfile; packages: Pkg[]; reviews: unknown[] }>(
        "/api/public/publishers/" + slug,
      );
      return res;
    },
  });

  const favMutation = useMutation({
    mutationFn: () => api.post("/api/favorites", { publisher_id: data?.publisher.id }),
    onError: (e) => setError(apiErrorMessage(e)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["favorites"] }),
  });

  if (isLoading) return <PageLoader />;
  if (!data?.publisher) {
    return <EmptyState title="Publisher not found" description="This publisher may not be active yet." action={<Link to="/publishers"><Button variant="outline">Back to marketplace</Button></Link>} />;
  }

  const p = data.publisher;
  const gender = p.gender_distribution ? JSON.parse(p.gender_distribution) : null;
  const demos: { label: string; icon: React.ReactNode; value: string }[] = [
    { label: "Followers", icon: <Users className="h-4 w-4" />, value: formatNumber(p.followers) },
    { label: "Avg. reach", icon: <TrendingUp className="h-4 w-4" />, value: formatNumber(p.avg_reach ?? 0) },
    { label: "Engagement", icon: <Target className="h-4 w-4" />, value: p.engagement_rate != null ? `${p.engagement_rate}%` : "—" },
    { label: "Audience", icon: <Target className="h-4 w-4" />, value: p.primary_age_group ?? "—" },
    { label: "Location", icon: <MapPin className="h-4 w-4" />, value: p.audience_location ?? p.location ?? "—" },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <Link to="/publishers" className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-brand-600">
        <ArrowLeft className="h-4 w-4" /> Back to marketplace
      </Link>

      {/* Header card */}
      <Card className="overflow-hidden">
        <div className="h-36 bg-gradient-to-r from-brand-600 via-indigo-500 to-sky-500" />
        <div className="px-6 pb-6">
          <div className="-mt-10 flex flex-wrap items-end justify-between gap-4">
            <div className="flex items-end gap-4">
              <div className="flex h-20 w-20 items-center justify-center rounded-3xl border-4 border-white bg-white text-2xl font-bold text-brand-700 shadow-md">
                {p.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="pb-1">
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold text-ink-900">{p.name}</h1>
                  <VerifyBadge verified={p.verified} />
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <Badge tone="blue">{p.platform ?? "Media"}</Badge>
                  {p.category && <Badge>{p.category}</Badge>}
                  {p.trust_level !== "REGISTERED" && <Badge tone="violet">{p.trust_level}</Badge>}
                  {p.review_count > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-ink-500">
                      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" /> {p.avg_rating.toFixed(1)} ({p.review_count} reviews)
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-2 pb-1">
              {isAdvertiser && (
                <Button variant="outline" icon={<Heart className="h-4 w-4" />} onClick={() => favMutation.mutate()}>
                  Shortlist
                </Button>
              )}
              <a href={`#packages`}>
                <Button icon={<CalendarCheck className="h-4 w-4" />}>Book Now</Button>
              </a>
            </div>
          </div>

          <p className="mt-4 max-w-3xl leading-relaxed text-ink-600">{p.description ?? p.about ?? "Media publisher on the AdAgencyHub marketplace."}</p>

          {/* Demographics */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {demos.map((d) => (
              <div key={d.label} className="rounded-2xl border border-ink-200 bg-ink-50/60 p-4">
                <span className="text-ink-400">{d.icon}</span>
                <p className="mt-2 text-lg font-bold text-ink-900">{d.value}</p>
                <p className="text-[11px] uppercase tracking-wide text-ink-400">{d.label}</p>
              </div>
            ))}
          </div>
          {gender && (
            <div className="mt-3 flex gap-2">
              {["male", "female", "other"].filter((k) => gender[k] != null).map((k) => (
                <Badge key={k} tone="slate">{k}: {gender[k]}%</Badge>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Packages */}
      <div id="packages" className="mt-10">
        <h2 className="text-xl font-bold text-ink-900">Advertising Packages</h2>
        <p className="mt-1 text-sm text-ink-500">Live availability is shown for every package. Slots are reserved the moment you book.</p>
        <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {data.packages.map((pkg) => {
            const pct = pkg.total_slots > 0 ? (pkg.booked_slots / pkg.total_slots) * 100 : 0;
            const soldOut = pkg.available_slots <= 0;
            return (
              <Card key={pkg.id} className={cn("flex flex-col p-6", soldOut && "opacity-70")}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Badge tone="blue">{pkg.platform}</Badge>
                    <h3 className="mt-2 font-semibold text-ink-900">{pkg.title}</h3>
                  </div>
                  {pkg.is_featured === 1 && <Badge tone="violet">Popular</Badge>}
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-ink-500">{pkg.description}</p>
                <div className="mt-4 flex items-end justify-between">
                  <div>
                    <p className="text-2xl font-bold text-ink-900">₹{pkg.price.toLocaleString("en-IN")}</p>
                    <p className="text-xs text-ink-400">per {pkg.duration_days} days · {pkg.quantity} units</p>
                  </div>
                  <span className={cn("text-xs font-semibold", soldOut ? "text-red-600" : pkg.available_slots <= Math.ceil(pkg.total_slots * 0.2) ? "text-amber-600" : "text-emerald-600")}>
                    {soldOut ? "Sold Out" : `${pkg.available_slots} of ${pkg.total_slots} slots left`}
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-100">
                  <div className="h-full rounded-full bg-brand-500" style={{ width: `${Math.min(100, pct)}%` }} />
                </div>
                <div className="mt-4 flex-1" />
                {isAdvertiser ? (
                  <Link to="/advertiser/publishers" search={{ pkg: pkg.id }}>
                    <Button className="w-full" disabled={soldOut} variant={soldOut ? "outline" : "primary"}>
                      {soldOut ? "Sold Out" : "Book Now"}
                    </Button>
                  </Link>
                ) : (
                  <a
                    href={`/login?redirect=${encodeURIComponent(`/advertiser/publishers?pkg=${pkg.id}`)}`}
                    className={soldOut ? "pointer-events-none" : undefined}
                  >
                    <Button className="w-full" disabled={soldOut} variant={soldOut ? "outline" : "primary"}>
                      {soldOut ? "Sold Out" : "Log in to Book"}
                    </Button>
                  </a>
                )}
              </Card>
            );
          })}
          {data.packages.length === 0 && (
            <div className="col-span-full rounded-2xl border border-dashed border-ink-300 p-10 text-center text-sm text-ink-400">
              This publisher hasn't listed any packages yet.
            </div>
          )}
        </div>
      </div>

      {/* About */}
      {(p.about || p.advertising_policies) && (
        <div className="mt-10 grid gap-5 lg:grid-cols-2">
          {p.about && (
            <Card>
              <CardHeader title="About" />
              <CardBody className="whitespace-pre-wrap text-sm leading-relaxed text-ink-600">{p.about}</CardBody>
            </Card>
          )}
          {p.advertising_policies && (
            <Card>
              <CardHeader title="Advertising Policies" />
              <CardBody className="whitespace-pre-wrap text-sm leading-relaxed text-ink-600">{p.advertising_policies}</CardBody>
            </Card>
          )}
        </div>
      )}

      {/* Contact */}
      <Card className="mt-10">
        <CardHeader title="Contact & Links" subtitle={`Publisher since ${formatDate(p.joined_at)}`} />
        <CardBody className="flex flex-wrap gap-x-8 gap-y-3 text-sm text-ink-600">
          {p.website_url && <span className="inline-flex items-center gap-2"><Globe className="h-4 w-4 text-ink-400" />{p.website_url}</span>}
          {p.contact_email && <span className="inline-flex items-center gap-2"><Mail className="h-4 w-4 text-ink-400" />{p.contact_email}</span>}
          {p.contact_phone && <span className="inline-flex items-center gap-2"><Phone className="h-4 w-4 text-ink-400" />{p.contact_phone}</span>}
          <span className="inline-flex items-center gap-2"><MapPin className="h-4 w-4 text-ink-400" />{p.location ?? p.audience_location ?? "—"}</span>
        </CardBody>
      </Card>

      <p className="mt-8 flex items-center justify-center gap-2 text-center text-sm text-ink-400">
        <Sparkles className="h-4 w-4" /> Managed end-to-end by the agency — payment, creative, approval and proof of publication.
      </p>
      {error && <p className="mt-3 text-center text-sm text-red-600">{error}</p>}
    </div>
  );
}
