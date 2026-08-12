import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight, Search, Megaphone, Palette, Rocket, Sparkles, BadgeCheck,
  Camera, PlayCircle, Globe, Newspaper, Users, TrendingUp, Target, MapPin,
} from "lucide-react";
import { api } from "../lib/api";
import { formatNumber } from "../lib/utils";
import { Badge, VerifyBadge } from "../components/ui";
import { useAuth } from "../lib/auth";

interface FeaturedPublisher {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  cover_url: string | null;
  description: string | null;
  verified: number;
  trust_level: string;
  platform: string;
  followers: number;
  engagement_rate: number | null;
  audience_location: string | null;
  primary_age_group: string | null;
  starting_price: number | null;
  review_count: number;
  avg_rating: number;
}

const PLATFORM_ICONS: Record<string, typeof Camera> = {
  INSTAGRAM: Camera,
  FACEBOOK: Camera,
  YOUTUBE: PlayCircle,
  WEBSITE: Globe,
  NEWSPAPER: Newspaper,
  TELEVISION: PlayCircle,
};

export function HomePage() {
  const { isAdvertiser } = useAuth();
  const { data: publishers } = useQuery({
    queryKey: ["featured-publishers"],
    queryFn: () => api.get<FeaturedPublisher[]>("/api/public/featured-publishers"),
  });

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-ink-900">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(99,102,241,0.35),transparent_55%),radial-gradient(ellipse_at_bottom_left,rgba(14,165,233,0.2),transparent_50%)]" />
        <div className="relative mx-auto max-w-7xl px-4 pb-20 pt-16 sm:px-6 sm:pt-24">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-medium text-ink-200 backdrop-blur">
              <Sparkles className="h-3.5 w-3.5 text-brand-400" />
              Managed advertising across social media, web, TV & print
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-6xl">
              Connect Your Brand With the <span className="bg-gradient-to-r from-brand-400 to-sky-400 bg-clip-text text-transparent">Right Audience.</span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-ink-300">
              One platform connecting advertisers with powerful publishers, media platforms, influencers, and creative advertising services.
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link to="/publishers">
                <span className="inline-flex h-12 items-center gap-2 rounded-2xl bg-brand-600 px-7 text-base font-semibold text-white shadow-lg shadow-brand-600/30 transition-all hover:bg-brand-500 hover:shadow-brand-500/40">
                  <Search className="h-5 w-5" /> Find Advertising Opportunities
                </span>
              </Link>
              <Link to="/register" search={{ role: "publisher" }}>
                <span className="inline-flex h-12 items-center gap-2 rounded-2xl border border-white/20 bg-white/5 px-7 text-base font-semibold text-white backdrop-blur transition-all hover:bg-white/10">
                  <Megaphone className="h-5 w-5" /> Become a Publisher
                </span>
              </Link>
            </div>
            <Link
              to={isAdvertiser ? "/advertiser/assistant" : "/login"}
              className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-brand-300 hover:text-brand-200"
            >
              <Sparkles className="h-4 w-4" /> Talk to our AI Advertising Assistant <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {/* Quick stats */}
          <div className="mx-auto mt-16 grid max-w-3xl grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { v: "100%", l: "Managed by agency" },
              { v: "₹0", l: "Cost to browse" },
              { v: "24/7", l: "Agency support" },
              { v: "2", l: "Languages: Mizo & English" },
            ].map((s) => (
              <div key={s.l} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center backdrop-blur">
                <p className="text-xl font-bold text-white">{s.v}</p>
                <p className="mt-1 text-xs text-ink-400">{s.l}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-ink-900">How It Works</h2>
          <p className="mx-auto mt-3 max-w-xl text-ink-500">From idea to published campaign — the agency handles everything for you.</p>
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: <Search className="h-6 w-6" />, step: "1. Discover", desc: "Find the right publisher from a marketplace of verified media owners, influencers and platforms." },
            { icon: <CalendarCheckIcon />, step: "2. Book", desc: "Choose an available advertising package with transparent pricing and live inventory." },
            { icon: <Palette className="h-6 w-6" />, step: "3. Create", desc: "Upload your advertisement — or let our Creative Studio design it for you." },
            { icon: <Rocket className="h-6 w-6" />, step: "4. Launch", desc: "We coordinate with the publisher, verify publication, and settle everything." },
          ].map((s) => (
            <div key={s.step} className="group rounded-2xl border border-ink-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 transition-colors group-hover:bg-brand-600 group-hover:text-white">
                {s.icon}
              </div>
              <h3 className="font-semibold text-ink-900">{s.step}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-500">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Featured publishers */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-ink-900">Featured Publishers</h2>
              <p className="mt-2 text-ink-500">Hand-picked media partners verified by the agency.</p>
            </div>
            <Link to="/publishers" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:text-brand-700">
              Browse all publishers <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {(publishers ?? []).slice(0, 4).map((p) => {
              const Icon = PLATFORM_ICONS[p.platform] ?? Globe;
              return (
                <Link key={p.id} to="/publishers/$slug" params={{ slug: p.slug }} className="group">
                  <div className="overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-sm transition-all group-hover:-translate-y-1 group-hover:shadow-xl">
                    <div className="flex h-28 items-center justify-center bg-gradient-to-br from-brand-600/10 to-sky-500/10">
                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-md">
                        <Icon className="h-8 w-8 text-brand-600" />
                      </div>
                    </div>
                    <div className="p-5">
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-semibold text-ink-900">{p.name}</h3>
                        <VerifyBadge verified={p.verified} />
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <Badge tone="blue">{p.platform}</Badge>
                        {p.trust_level !== "REGISTERED" && <Badge tone="violet">{p.trust_level}</Badge>}
                      </div>
                      <div className="mt-3 space-y-1.5 text-sm text-ink-500">
                        <p className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-ink-400" /> {formatNumber(p.followers)} followers</p>
                        <p className="flex items-center gap-1.5"><Target className="h-3.5 w-3.5 text-ink-400" /> {p.primary_age_group ?? "All ages"}</p>
                        <p className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-ink-400" /> {p.audience_location ?? p.platform}</p>
                      </div>
                      <div className="mt-4 flex items-center justify-between border-t border-ink-100 pt-3">
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-ink-400">Starting at</p>
                          <p className="text-lg font-bold text-ink-900">{p.starting_price != null ? "₹" + p.starting_price.toLocaleString("en-IN") : "—"}</p>
                        </div>
                        <span className="inline-flex items-center gap-1 rounded-lg bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 transition-colors group-hover:bg-brand-600 group-hover:text-white">
                          View Profile <ArrowRight className="h-3 w-3" />
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
            {(publishers ?? []).length === 0 && (
              <div className="col-span-full rounded-2xl border border-dashed border-ink-300 p-10 text-center text-sm text-ink-400">
                Publishers are joining — check back soon.
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Creative services */}
      <section className="relative overflow-hidden bg-ink-900 py-20">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(99,102,241,0.25),transparent_60%)]" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full bg-white/5 px-4 py-1.5 text-xs font-medium text-ink-200 ring-1 ring-white/10">
              <Palette className="h-3.5 w-3.5 text-brand-400" /> Creative Studio
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Don't have an advertisement? <span className="text-brand-400">We can create it for you.</span>
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-ink-300">
              Social media flyers, posters, banners, promotional graphics, video advertisements, reels, YouTube ads, motion graphics and campaign creatives — designed by the agency and delivered inside the platform.
            </p>
            <div className="mt-8">
              <Link to={isAdvertiser ? "/advertiser/creative-studio" : "/login"}>
                <span className="inline-flex h-12 items-center gap-2 rounded-2xl bg-white px-7 text-base font-semibold text-ink-900 transition-all hover:bg-ink-100">
                  <Palette className="h-5 w-5" /> Request a Design
                </span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Why agency */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-ink-900">
              One agency. <span className="text-brand-600">Every campaign handled.</span>
            </h2>
            <p className="mt-4 leading-relaxed text-ink-500">
              Instead of managing dozens of publishers, payments, creatives and invoices yourself, the agency becomes your advertising infrastructure — from discovery and booking to publication proof and settlement.
            </p>
            <ul className="mt-8 space-y-4">
              {[
                { icon: <BadgeCheck className="h-5 w-5 text-emerald-500" />, t: "Verified publishers", d: "Every media partner is reviewed and verified by the agency before they go live." },
                { icon: <TrendingUp className="h-5 w-5 text-brand-500" />, t: "Live inventory & pricing", d: "Real availability, transparent rates and a permanent financial ledger for every booking." },
                { icon: <Rocket className="h-5 w-5 text-sky-500" />, t: "End-to-end management", d: "Creatives, approvals, publication proof, invoicing and publisher settlement — all in one place." },
              ].map((f) => (
                <li key={f.t} className="flex gap-4 rounded-2xl border border-ink-200 bg-white p-4 shadow-sm">
                  <span className="mt-0.5">{f.icon}</span>
                  <div>
                    <p className="font-semibold text-ink-900">{f.t}</p>
                    <p className="mt-0.5 text-sm text-ink-500">{f.d}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-3xl border border-ink-200 bg-white p-6 shadow-xl">
            <p className="text-sm font-semibold text-ink-900">Sample campaign math</p>
            <div className="mt-4 space-y-3">
              {[
                { l: "Campaign price (10 Instagram Stories)", v: "₹10,000" },
                { l: "Agency commission (10%)", v: "₹1,000", accent: "text-brand-600" },
                { l: "Publisher earnings", v: "₹9,000", accent: "text-emerald-600" },
              ].map((r) => (
                <div key={r.l} className="flex items-center justify-between rounded-xl bg-ink-50 px-4 py-3 text-sm">
                  <span className="text-ink-600">{r.l}</span>
                  <span className={`font-bold ${r.accent ?? "text-ink-900"}`}>{r.v}</span>
                </div>
              ))}
              <p className="pt-1 text-xs leading-relaxed text-ink-400">
                Every booking records its commission permanently — historical finances never change with later settings.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function CalendarCheckIcon() {
  return <Megaphone className="h-6 w-6" />;
}
