import { Link, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Upload, FileText, CheckCircle2, Link2 } from "lucide-react";
import { api, uploadFile } from "../../lib/api";
import { apiErrorMessage, formatDateTime, formatMoney, titleCase } from "../../lib/utils";
import { useMemo } from "react";
import { Button, Card, CardBody, CardHeader, Dialog, EmptyState, Input, PageLoader, StatusBadge, Tabs, Badge } from "../../components/ui";
import { CampaignTimeline } from "../../components/CampaignTimeline";
import { Thread } from "../../components/Thread";

interface CampaignDetail {
  id: string;
  name: string;
  objective: string | null;
  product_service: string | null;
  target_audience: string | null;
  start_date: string;
  end_date: string;
  status: string;
  total_amount: number;
  currency: string;
  company_name: string | null;
  created_at: string;
}

interface Booking {
  id: string;
  status: string;
  amount: number;
  unit_price: number;
  currency: string;
  scheduled_start: string | null;
  scheduled_end: string | null;
  package_title: string;
  platform: string;
  publisher_name: string;
  publisher_slug: string;
  finance: string | null;
}

interface Creative {
  id: string;
  current_version: number;
  status: string;
  drive_links: string | null;
}

interface CreativeVersion {
  id: string;
  version: number;
  file_url: string | null;
  file_name: string | null;
  file_size: number | null;
  uploaded_by_name: string;
  status: string;
  comment: string | null;
  created_at: string;
}

export function AdvCampaignDetailPage() {
  const { id } = useParams({ from: "/advertiser/campaigns/$id" });
  const qc = useQueryClient();
  const [tab, setTab] = useState("overview");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [linksText, setLinksText] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["adv", "campaign", id],
    queryFn: async () => {
      const res = await api.get<{ campaign: CampaignDetail; bookings: Booking[] }>("/api/bookings/campaigns/" + id);
      return res;
    },
  });

  const firstBooking = data?.bookings[0];

  const { data: creativeData } = useQuery({
    queryKey: ["creative", firstBooking?.id],
    queryFn: async () => {
      const res = await api.get<{ creative: Creative | null; versions: CreativeVersion[] }>("/api/creatives/booking/" + firstBooking!.id);
      return res;
    },
    enabled: !!firstBooking,
  });

  const upload = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Choose a file first.");
      const up = await uploadFile(file);
      await api.post(`/api/creatives/booking/${firstBooking!.id}/upload`, {
        file_url: up.url,
        file_name: up.file_name,
        file_size: file.size,
        mime_type: file.type,
        comment: comment || null,
      });
    },
    onSuccess: () => {
      setUploadOpen(false);
      setFile(null);
      setComment("");
      qc.invalidateQueries({ queryKey: ["creative", firstBooking?.id] });
      qc.invalidateQueries({ queryKey: ["adv", "campaign", id] });
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  const addLinks = useMutation({
    mutationFn: async () => {
      const links = linksText
        .split(/[\s,]+/)
        .map((l) => l.trim())
        .filter((l) => l.startsWith("http"));
      if (links.length === 0) throw new Error("Paste at least one valid link (https://…).");
      await api.post(`/api/creatives/booking/${firstBooking!.id}/links`, { links });
    },
    onSuccess: () => {
      setLinksText("");
      qc.invalidateQueries({ queryKey: ["creative", firstBooking?.id] });
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  const driveLinks = useMemo(() => {
    const raw = creativeData?.creative?.drive_links;
    if (!raw) return [] as string[];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : ([] as string[]);
    } catch {
      return [] as string[];
    }
  }, [creativeData?.creative?.drive_links]);

  if (isLoading) return <PageLoader />;
  if (!data) return <EmptyState title="Campaign not found" />;
  const c = data.campaign;
  const finance = firstBooking?.finance ? JSON.parse(firstBooking.finance) : null;

  return (
    <div className="space-y-6">
      <Link to="/advertiser/campaigns" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-brand-600">
        <ArrowLeft className="h-4 w-4" /> My Campaigns
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">{c.name}</h1>
          <p className="mt-1 text-sm text-ink-500">
            {c.company_name ?? "You"} · {formatDateTime(c.created_at)}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <StatusBadge status={c.status} />
            <Badge tone="slate">{data.bookings.length} booking(s)</Badge>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-ink-400">Total value</p>
          <p className="text-2xl font-bold text-ink-900">{formatMoney(c.total_amount)}</p>
        </div>
      </div>

      <Tabs
        tabs={[
          { id: "overview", label: "Overview" },
          { id: "timeline", label: "Timeline" },
          { id: "creative", label: "Creative" },
          { id: "messages", label: "Messages" },
          { id: "invoice", label: "Invoice" },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "overview" && (
        <div className="grid gap-5 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader title="Bookings" subtitle="Packages included in this campaign" />
            <div className="divide-y divide-ink-100">
              {data.bookings.map((b) => (
                <div key={b.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                  <div>
                    <p className="font-medium text-ink-900">{b.package_title}</p>
                    <p className="text-xs text-ink-400">
                      {b.publisher_name} · {b.platform}
                      {b.scheduled_start ? ` · ${b.scheduled_start.slice(0, 10)} → ${b.scheduled_end?.slice(0, 10)}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right text-xs text-ink-500">
                      <p className="font-bold text-ink-900">{formatMoney(b.amount)}</p>
                      {finance && (
                        <p className="text-[10px]">
                          Commission {finance.commissionPercent}% · Publisher {formatMoney(finance.publisherAmount)}
                        </p>
                      )}
                    </div>
                    <StatusBadge status={b.status} />
                  </div>
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <CardHeader title="Campaign details" />
            <CardBody className="space-y-2.5 text-sm">
              {[
                ["Objective", c.objective ?? "—"],
                ["Product / service", c.product_service ?? "—"],
                ["Target audience", c.target_audience ?? "—"],
                ["Start", c.start_date],
                ["End", c.end_date],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4">
                  <span className="text-ink-400">{k}</span>
                  <span className="text-right font-medium text-ink-800">{v}</span>
                </div>
              ))}
            </CardBody>
          </Card>
        </div>
      )}

      {tab === "timeline" && (
        <div className="grid gap-5 lg:grid-cols-2">
          {data.bookings.map((b) => (
            <Card key={b.id}>
              <CardHeader title={b.package_title} subtitle={`${b.publisher_name} · ${b.status.replace(/_/g, " ")}`} />
              <CardBody>
                <CampaignTimeline status={b.status} />
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {tab === "creative" && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader
              title="Creative files"
              subtitle={creativeData?.creative ? `Current version v${creativeData.creative.current_version} · ${titleCase(creativeData.creative.status)}` : "No creative uploaded yet"}
              action={firstBooking && (
                <Button size="sm" icon={<Upload className="h-4 w-4" />} onClick={() => setUploadOpen(true)}>Upload</Button>
              )}
            />
            {!creativeData?.versions.length ? (
              <EmptyState
                icon={<Upload className="h-6 w-6" />}
                title="Need an advertisement?"
                description="Upload your own creative here, or ask the Creative Studio to design one for you."
                action={<Link to="/advertiser/creative-studio"><Button size="sm">Request a Design</Button></Link>}
              />
            ) : (
              <div className="divide-y divide-ink-100">
                {creativeData.versions.map((v) => (
                  <div key={v.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                    <div className="min-w-0">
                      <a href={v.file_url ?? "#"} target="_blank" rel="noreferrer" className="flex items-center gap-2 font-medium text-brand-700 hover:underline">
                        <FileText className="h-4 w-4 shrink-0" />
                        <span className="truncate">{v.file_name}</span>
                      </a>
                      <p className="mt-0.5 text-xs text-ink-400">
                        v{v.version} · {v.uploaded_by_name} · {formatDateTime(v.created_at)}
                      </p>
                      {v.comment && <p className="mt-1 text-xs text-ink-500">"{v.comment}"</p>}
                    </div>
                    <StatusBadge status={v.status} />
                  </div>
                ))}
              </div>
            )}
            {driveLinks.length > 0 && (
              <div className="border-t border-ink-100 px-5 py-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">Video links (submitted to publisher)</p>
                <div className="flex flex-wrap gap-2">
                  {driveLinks.map((l, i) => (
                    <a key={i} href={l} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 hover:bg-sky-100">
                      <Link2 className="h-3.5 w-3.5" /> Video link {i + 1}
                    </a>
                  ))}
                </div>
              </div>
            )}
            <div className="border-t border-ink-100 px-5 py-4">
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">Add video / Google Drive links</p>
              <div className="flex gap-2">
                <Input value={linksText} onChange={(e) => setLinksText(e.target.value)} placeholder="https://drive.google.com/… (space or comma separated)" className="flex-1" />
                <Button size="sm" variant="outline" loading={addLinks.isPending} onClick={() => addLinks.mutate()}>Add links</Button>
              </div>
            </div>
          </Card>
          <Card>
            <CardHeader title="Approval status" subtitle="The agency reviews creatives before they go to the publisher" />
            <CardBody>
              {creativeData?.creative ? (
                <div className="space-y-2">
                  <p className="text-sm text-ink-600">
                    Current status: <StatusBadge status={creativeData.creative.status} />
                  </p>
                  <p className="text-xs leading-relaxed text-ink-400">
                    The agency will review your creative, request changes if needed, and pass the approved version to the publisher for scheduling.
                  </p>
                </div>
              ) : (
                <p className="text-sm text-ink-500">Upload a creative or request one from Creative Studio to move the campaign forward.</p>
              )}
            </CardBody>
          </Card>
        </div>
      )}

      {tab === "messages" && firstBooking && (
        <Card><Thread threadType="campaign" threadId={firstBooking.id} /></Card>
      )}
      {tab === "messages" && !firstBooking && <EmptyState title="No messages yet" />}

      {tab === "invoice" && (
        <Card>
          <CardHeader title="Invoice" subtitle="Issued automatically when payment is confirmed" />
          <CardBody className="text-sm text-ink-500">
            {firstBooking?.status && ["PAID", "COMPLETED", "LIVE", "PROOF_SUBMITTED", "SCHEDULED", "PUBLISHER_APPROVED", "SENT_TO_PUBLISHER", "CREATIVE_APPROVED", "CREATIVE_REQUIRED", "UNDER_REVIEW", "DISPUTED"].includes(firstBooking.status) ? (
              <Link to="/advertiser/invoices" className="inline-flex items-center gap-1.5 font-semibold text-brand-600 hover:underline">
                <CheckCircle2 className="h-4 w-4" /> View invoice in Invoices section
              </Link>
            ) : (
              <p>Payment must be completed before an invoice is issued.</p>
            )}
          </CardBody>
        </Card>
      )}

      <Dialog open={uploadOpen} onClose={() => setUploadOpen(false)} title="Upload creative">
        <div className="space-y-4">
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-ink-300 px-4 py-8 text-sm text-ink-500 hover:border-brand-400 hover:bg-brand-50/40">
            <Upload className="h-6 w-6" />
            {file ? file.name : "Choose a file — JPG, PNG, WEBP, PDF, MP4 (max 100MB)"}
            <input type="file" className="hidden" accept=".jpg,.jpeg,.png,.webp,.pdf,.mp4,.mov" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
          <Input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Comment for the agency (optional)" />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setUploadOpen(false)}>Cancel</Button>
            <Button onClick={() => upload.mutate()} loading={upload.isPending} disabled={!file}>Upload version</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
