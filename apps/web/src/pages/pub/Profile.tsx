import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Save } from "lucide-react";
import { api } from "../../lib/api";
import { apiErrorMessage } from "../../lib/utils";
import { Button, Card, CardBody, CardHeader, Field, Input, PageLoader, Textarea, Select } from "../../components/ui";
import { cn } from "../../lib/utils";

interface PublisherMe {
  publisher: {
    id: string;
    name: string;
    slug: string;
    status: string;
    description: string | null;
    category: string | null;
    location: string | null;
    website_url: string | null;
    contact_email: string | null;
    contact_phone: string | null;
    social_links: string | null;
    about: string | null;
    advertising_policies: string | null;
    logo_url: string | null;
    cover_url: string | null;
  };
  stats: {
    id: string;
    platform: string;
    platform_url: string | null;
    followers: number;
    subscribers: number | null;
    monthly_visitors: number | null;
    monthly_page_views: number | null;
    avg_views: number | null;
    avg_reach: number | null;
    engagement_rate: number | null;
    avg_post_views: number | null;
    avg_story_views: number | null;
    avg_video_views: number | null;
    audience_location: string | null;
    audience_age_group: string | null;
    gender_distribution: string | null;
    primary_age_group: string | null;
    extra_notes: string | null;
  } | null;
  payout: {
    account_holder: string | null;
    bank_name: string | null;
    ifsc: string | null;
    upi: string | null;
    has_account_number: number;
  } | null;
}

const PLATFORMS = ["INSTAGRAM", "FACEBOOK", "YOUTUBE", "WEBSITE", "NEWSPAPER", "TELEVISION", "RADIO", "DIGITAL_MAGAZINE", "OUTDOOR", "OTHER"];

export function PubProfilePage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"profile" | "stats" | "payout">("profile");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["pub", "me"],
    queryFn: () => api.get<PublisherMe>("/api/publishers/me"),
  });

  const [profile, setProfile] = useState<Record<string, string>>({});
  const [stats, setStats] = useState<Record<string, string>>({});
  const [payout, setPayout] = useState<Record<string, string>>({});

  const saveProfile = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      await api.patch("/api/publishers/me", body);
    },
    onSuccess: () => { setMsg("Saved."); qc.invalidateQueries({ queryKey: ["pub", "me"] }); },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  if (isLoading) return <PageLoader />;
  if (!data) return null;

  const p = data.publisher;
  const s = data.stats;

  const num = (v: unknown, fallback = 0) => {
    const n = parseFloat(String(v ?? ""));
    return isNaN(n) ? fallback : n;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">Media Kit & Profile</h1>
        <p className="mt-1 text-sm text-ink-500">This is your public sales pitch — keep audience stats fresh and attractive.</p>
      </div>

      {msg && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{msg}</p>}
      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="flex gap-1 rounded-xl bg-ink-100 p-1">
        {([["profile", "Profile"], ["stats", "Audience statistics"], ["payout", "Payout details"]] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} className={cn("flex-1 rounded-lg px-4 py-2 text-sm font-medium", tab === id ? "bg-white text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-800")}>
            {label}
          </button>
        ))}
      </div>

      {tab === "profile" && (
        <Card>
          <CardHeader title="Publisher profile" subtitle="Shown publicly on your media kit page" />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <Field label="Publisher name" required>
              <Input defaultValue={p.name} onChange={(e) => setProfile((f) => ({ ...f, name: e.target.value }))} />
            </Field>
            <Field label="Category">
              <Input defaultValue={p.category ?? ""} onChange={(e) => setProfile((f) => ({ ...f, category: e.target.value }))} placeholder="Influencer, News, Channel…" />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Description">
                <Textarea rows={3} defaultValue={p.description ?? ""} onChange={(e) => setProfile((f) => ({ ...f, description: e.target.value }))} placeholder="One paragraph pitch for advertisers…" />
              </Field>
            </div>
            <Field label="Location">
              <Input defaultValue={p.location ?? ""} onChange={(e) => setProfile((f) => ({ ...f, location: e.target.value }))} />
            </Field>
            <Field label="Website">
              <Input defaultValue={p.website_url ?? ""} onChange={(e) => setProfile((f) => ({ ...f, website_url: e.target.value }))} />
            </Field>
            <Field label="Contact email">
              <Input defaultValue={p.contact_email ?? ""} onChange={(e) => setProfile((f) => ({ ...f, contact_email: e.target.value }))} />
            </Field>
            <Field label="Contact phone">
              <Input defaultValue={p.contact_phone ?? ""} onChange={(e) => setProfile((f) => ({ ...f, contact_phone: e.target.value }))} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="About">
                <Textarea rows={3} defaultValue={p.about ?? ""} onChange={(e) => setProfile((f) => ({ ...f, about: e.target.value }))} />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Advertising policies">
                <Textarea rows={3} defaultValue={p.advertising_policies ?? ""} onChange={(e) => setProfile((f) => ({ ...f, advertising_policies: e.target.value }))} placeholder="Deadlines, content restrictions, rescheduling rules…" />
              </Field>
            </div>
            <div className="sm:col-span-2 flex justify-end">
              <Button icon={<Save className="h-4 w-4" />} loading={saveProfile.isPending} onClick={() => saveProfile.mutate(profile)}>Save profile</Button>
            </div>
          </CardBody>
        </Card>
      )}

      {tab === "stats" && (
        <Card>
          <CardHeader title="Audience statistics" subtitle="Your sales pitch — updated live on your public page" />
          <CardBody className="grid gap-4 sm:grid-cols-3">
            <Field label="Platform">
              <Select defaultValue={s?.platform ?? "INSTAGRAM"} onChange={(e) => setStats((f) => ({ ...f, platform: e.target.value }))}>
                {PLATFORMS.map((p) => <option key={p}>{p}</option>)}
              </Select>
            </Field>
            <Field label="Platform URL">
              <Input defaultValue={s?.platform_url ?? ""} onChange={(e) => setStats((f) => ({ ...f, platform_url: e.target.value }))} placeholder="https://instagram.com/…" />
            </Field>
            <Field label="Followers">
              <Input type="number" min="0" defaultValue={s?.followers ?? 0} onChange={(e) => setStats((f) => ({ ...f, followers: e.target.value }))} />
            </Field>
            <Field label="Subscribers">
              <Input type="number" min="0" defaultValue={s?.subscribers ?? ""} onChange={(e) => setStats((f) => ({ ...f, subscribers: e.target.value }))} />
            </Field>
            <Field label="Monthly visitors">
              <Input type="number" min="0" defaultValue={s?.monthly_visitors ?? ""} onChange={(e) => setStats((f) => ({ ...f, monthly_visitors: e.target.value }))} />
            </Field>
            <Field label="Monthly page views">
              <Input type="number" min="0" defaultValue={s?.monthly_page_views ?? ""} onChange={(e) => setStats((f) => ({ ...f, monthly_page_views: e.target.value }))} />
            </Field>
            <Field label="Avg. reach">
              <Input type="number" min="0" defaultValue={s?.avg_reach ?? ""} onChange={(e) => setStats((f) => ({ ...f, avg_reach: e.target.value }))} />
            </Field>
            <Field label="Engagement rate (%)">
              <Input type="number" min="0" step="0.1" defaultValue={s?.engagement_rate ?? ""} onChange={(e) => setStats((f) => ({ ...f, engagement_rate: e.target.value }))} />
            </Field>
            <Field label="Avg. views">
              <Input type="number" min="0" defaultValue={s?.avg_views ?? ""} onChange={(e) => setStats((f) => ({ ...f, avg_views: e.target.value }))} />
            </Field>
            <Field label="Avg. post views">
              <Input type="number" min="0" defaultValue={s?.avg_post_views ?? ""} onChange={(e) => setStats((f) => ({ ...f, avg_post_views: e.target.value }))} />
            </Field>
            <Field label="Avg. story views">
              <Input type="number" min="0" defaultValue={s?.avg_story_views ?? ""} onChange={(e) => setStats((f) => ({ ...f, avg_story_views: e.target.value }))} />
            </Field>
            <Field label="Avg. video views">
              <Input type="number" min="0" defaultValue={s?.avg_video_views ?? ""} onChange={(e) => setStats((f) => ({ ...f, avg_video_views: e.target.value }))} />
            </Field>
            <Field label="Audience location">
              <Input defaultValue={s?.audience_location ?? ""} onChange={(e) => setStats((f) => ({ ...f, audience_location: e.target.value }))} placeholder="Mizoram" />
            </Field>
            <Field label="Primary age group">
              <Input defaultValue={s?.primary_age_group ?? ""} onChange={(e) => setStats((f) => ({ ...f, primary_age_group: e.target.value }))} placeholder="18-34" />
            </Field>
            <Field label="Gender distribution (JSON)">
              <Input defaultValue={s?.gender_distribution ?? ""} onChange={(e) => setStats((f) => ({ ...f, gender_distribution: e.target.value }))} placeholder='{"male":55,"female":44,"other":1}' />
            </Field>
            <div className="sm:col-span-3">
              <Field label="Extra notes">
                <Textarea rows={2} defaultValue={s?.extra_notes ?? ""} onChange={(e) => setStats((f) => ({ ...f, extra_notes: e.target.value }))} />
              </Field>
            </div>
            <div className="sm:col-span-3 flex justify-end">
              <Button
                icon={<Save className="h-4 w-4" />}
                loading={saveProfile.isPending}
                onClick={() => saveProfile.mutate({
                  ...stats,
                  followers: num(stats.followers, s?.followers ?? 0),
                  subscribers: stats.subscribers !== undefined ? num(stats.subscribers, 0) : undefined,
                  monthly_visitors: stats.monthly_visitors !== undefined ? num(stats.monthly_visitors, 0) : undefined,
                  monthly_page_views: stats.monthly_page_views !== undefined ? num(stats.monthly_page_views, 0) : undefined,
                  avg_reach: stats.avg_reach !== undefined ? num(stats.avg_reach, 0) : undefined,
                  engagement_rate: stats.engagement_rate !== undefined ? num(stats.engagement_rate, 0) : undefined,
                  avg_views: stats.avg_views !== undefined ? num(stats.avg_views, 0) : undefined,
                  avg_post_views: stats.avg_post_views !== undefined ? num(stats.avg_post_views, 0) : undefined,
                  avg_story_views: stats.avg_story_views !== undefined ? num(stats.avg_story_views, 0) : undefined,
                  avg_video_views: stats.avg_video_views !== undefined ? num(stats.avg_video_views, 0) : undefined,
                  gender_distribution: stats.gender_distribution ? JSON.parse(stats.gender_distribution) : undefined,
                })}
              >
                Save statistics
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {tab === "payout" && (
        <Card>
          <CardHeader title="Payout details" subtitle="Stored securely — never shown publicly" />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <Field label="Account holder name">
              <Input defaultValue={data.payout?.account_holder ?? ""} onChange={(e) => setPayout((f) => ({ ...f, account_holder: e.target.value }))} />
            </Field>
            <Field label="Bank name">
              <Input defaultValue={data.payout?.bank_name ?? ""} onChange={(e) => setPayout((f) => ({ ...f, bank_name: e.target.value }))} />
            </Field>
            <Field label="Account number">
              <Input type="password" defaultValue={data.payout?.has_account_number ? "••••••••" : ""} onChange={(e) => setPayout((f) => ({ ...f, account_number: e.target.value }))} autoComplete="off" />
            </Field>
            <Field label="IFSC">
              <Input defaultValue={data.payout?.ifsc ?? ""} onChange={(e) => setPayout((f) => ({ ...f, ifsc: e.target.value }))} />
            </Field>
            <Field label="UPI ID">
              <Input defaultValue={data.payout?.upi ?? ""} onChange={(e) => setPayout((f) => ({ ...f, upi: e.target.value }))} placeholder="name@upi" />
            </Field>
            <div className="sm:col-span-2 flex items-center justify-between rounded-xl bg-ink-50 p-4">
              <p className="text-xs text-ink-500">The agency uses these details to pay you after campaign verification. Sensitive data is never exposed publicly.</p>
              <Button icon={<Save className="h-4 w-4" />} loading={saveProfile.isPending} onClick={() => saveProfile.mutate(payout)}>Save payout details</Button>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
