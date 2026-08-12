import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { CalendarCheck, Upload, CheckCircle2, AlertCircle } from "lucide-react";
import { api, uploadFile } from "../lib/api";
import { apiErrorMessage, formatMoney } from "../lib/utils";
import { Button, Dialog, Field, Input, Textarea, ProgressBar } from "./ui";

interface PackageInfo {
  id: string;
  title: string;
  price: number;
  platform: string;
  publisher_name?: string;
}

interface BookingModalProps {
  open: boolean;
  onClose: () => void;
  pkg: PackageInfo;
  defaultDates?: { start: string; end: string };
}

export function BookingModal({ open, onClose, pkg, defaultDates }: BookingModalProps) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [bookingId, setBookingId] = useState<string>("");

  const [form, setForm] = useState({
    name: "",
    product: "",
    objective: "",
    audience: "",
    start: defaultDates?.start ?? new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    end: defaultDates?.end ?? new Date(Date.now() + 37 * 86400000).toISOString().slice(0, 10),
    instructions: "",
    preferredDates: "",
  });
  const [file, setFile] = useState<File | null>(null);
  const [uploadPct, setUploadPct] = useState(0);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submitBooking() {
    setError("");
    if (!form.start || !form.end || form.start > form.end) {
      setError("Please choose valid campaign dates.");
      return;
    }
    setLoading(true);
    try {
      if (file) {
        await uploadFile(file, setUploadPct);
      }
      // 1. Create booking
      const res = await api.post<{ bookings: { booking_id: string }[] }>("/api/bookings", {
        campaign: {
          name: form.name || `Campaign — ${pkg.title}`,
          product_service: form.product || null,
          objective: form.objective || null,
          target_audience: form.audience || null,
          start_date: form.start,
          end_date: form.end,
        },
        package_ids: [pkg.id],
        instructions: form.instructions || null,
      });
      const ids = res.bookings.map((b) => b.booking_id);
      if (ids.length > 0) setBookingId(ids[0]);

      // Preferred publication dates → requested slots on the shared calendar
      const dates = form.preferredDates
        .split(/[\s,]+/)
        .map((d) => d.trim())
        .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
      if (dates.length > 0 && ids[0]) {
        await api.post(`/api/bookings/${ids[0]}/slots`, {
          slots: dates.map((date) => ({ date })),
        });
      }

      // 2. Auto-confirm booking (no payment required)
      const chk = await api.post<{ client_payload: { ref: string } }>("/api/payments/checkout", {
        booking_ids: ids,
        method: "MANUAL",
      });
      await api.post("/api/payments/confirm", { ref: chk.client_payload.ref });

      await qc.invalidateQueries();
      setStep(1);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={step === 0 ? `Confirm Booking — ${pkg.title}` : "Booking Confirmed"} wide>
      {step === 0 && (
        <div className="space-y-4">
          {/* Confirmation Box */}
          <div className="rounded-xl border border-brand-200 bg-brand-50/50 p-4 text-sm">
            <div className="flex items-center gap-2 font-bold text-brand-800">
              <AlertCircle className="h-4 w-4 text-brand-600" />
              <span>Confirm Package Booking</span>
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-brand-200/60 pt-2 text-ink-700">
              <div>
                <span className="font-semibold text-ink-900">{pkg.publisher_name ?? "Publisher"}</span>
                <span className="mx-1 text-ink-400">·</span>
                <span className="text-ink-600">{pkg.title}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badgeish label={pkg.platform} />
                <span className="text-base font-bold text-brand-700">{formatMoney(pkg.price)}</span>
              </div>
            </div>
          </div>

          <Field label="Campaign name" required>
            <Input value={form.name} onChange={set("name")} placeholder="e.g. Festive Promotion 2026" />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Start date" required>
              <Input type="date" value={form.start} onChange={set("start")} />
            </Field>
            <Field label="End date" required>
              <Input type="date" value={form.end} onChange={set("end")} />
            </Field>
          </div>

          <Field label="Preferred publication dates (optional)" hint="Comma-separated dates like 2026-09-10, 2026-09-12 — the publisher approves or adjusts them on the calendar">
            <Input value={form.preferredDates} onChange={set("preferredDates")} placeholder="2026-09-10, 2026-09-12, 2026-09-15" />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Product / service (optional)">
              <Input value={form.product} onChange={set("product")} placeholder="e.g. Clothing store" />
            </Field>
            <Field label="Target audience (optional)">
              <Input value={form.audience} onChange={set("audience")} placeholder="e.g. Youth 18-34 in Mizoram" />
            </Field>
          </div>

          <Field label="Instructions for publisher (optional)">
            <Textarea value={form.instructions} onChange={set("instructions")} rows={2} placeholder="Any special notes or instructions…" />
          </Field>

          <Field label="Creative material (optional)">
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-ink-300 px-4 py-4 text-sm text-ink-500 hover:border-brand-400 hover:bg-brand-50/40">
              <Upload className="h-5 w-5" />
              {file ? file.name : "Upload flyer/video (JPG, PNG, PDF, MP4)"}
              <input type="file" className="hidden" accept=".jpg,.jpeg,.png,.webp,.pdf,.mp4,.mov" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </label>
            {uploadPct > 0 && uploadPct < 100 && <ProgressBar value={uploadPct} max={100} />}
          </Field>

          {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <div className="mt-6 flex justify-end gap-3 border-t border-ink-100 pt-4">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button loading={loading} onClick={submitBooking} icon={<CalendarCheck className="h-4 w-4" />}>
              Okay, Confirm Booking
            </Button>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 shadow-md">
            <CheckCircle2 className="h-10 w-10" />
          </span>
          <div>
            <h3 className="text-xl font-bold text-ink-900">Booking Confirmed Successfully!</h3>
            <p className="mt-2 text-sm text-ink-600">
              Your ad package booking for <strong className="text-ink-900">{pkg.title}</strong> ({formatMoney(pkg.price)}) has been placed.
            </p>
            <p className="mt-1 text-xs text-ink-400">The publisher ({pkg.publisher_name}) has been notified.</p>
            {bookingId && <p className="mt-2 font-mono text-xs text-brand-600 font-semibold">Ref ID: {bookingId}</p>}
          </div>

          <div className="mt-4 flex gap-3">
            <Button onClick={onClose} variant="outline" className="px-6 font-semibold">
              Cancel / Close
            </Button>
            <Button
              onClick={() => {
                onClose();
                navigate({ to: "/advertiser/campaigns" });
              }}
              className="px-6 font-bold"
            >
              OKAY (View Campaigns)
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}

function Badgeish({ label }: { label: string }) {
  return <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-700 ring-1 ring-inset ring-sky-200">{label}</span>;
}
