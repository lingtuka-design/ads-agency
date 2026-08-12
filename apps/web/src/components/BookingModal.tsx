import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { CalendarCheck, CreditCard, Upload, CheckCircle2 } from "lucide-react";
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

const STEPS = ["Campaign", "Creative", "Payment"];

export function BookingModal({ open, onClose, pkg, defaultDates }: BookingModalProps) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [paymentRef, setPaymentRef] = useState("");
  const [bookingIds, setBookingIds] = useState<string[]>([]);

  const [form, setForm] = useState({
    name: "",
    product: "",
    objective: "",
    audience: "",
    start: defaultDates?.start ?? new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    end: defaultDates?.end ?? new Date(Date.now() + 37 * 86400000).toISOString().slice(0, 10),
    instructions: "",
  });
  const [file, setFile] = useState<File | null>(null);
  const [uploadPct, setUploadPct] = useState(0);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const createBooking = useMutation({
    mutationFn: async () => {
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
      setBookingIds(res.bookings.map((b) => b.booking_id));
      return res;
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  const checkout = useMutation({
    mutationFn: async () => {
      const res = await api.post<{ amount: number; client_payload: { ref: string } }>("/api/payments/checkout", {
        booking_ids: bookingIds,
        method: "UPI",
      });
      setPaymentRef(res.client_payload.ref);
      return res;
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  const confirm = useMutation({
    mutationFn: async () => {
      const res = await api.post<{ ok: boolean }>("/api/payments/confirm", { ref: paymentRef });
      return res;
    },
    onSuccess: async () => {
      await qc.invalidateQueries();
      setStep(3);
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  async function next() {
    setError("");
    if (step === 0) {
      if (!form.start || !form.end || form.start > form.end) {
        setError("Please choose valid campaign dates.");
        return;
      }
      if (file) {
        try {
          await uploadFile(file, setUploadPct);
        } catch (e) {
          setError(apiErrorMessage(e));
          return;
        }
      }
      const res = await createBooking.mutateAsync().catch((e) => { setError(apiErrorMessage(e)); return null; });
      if (!res) return;
      setStep(1);
    } else if (step === 1) {
      const res = await checkout.mutateAsync().catch((e) => { setError(apiErrorMessage(e)); return null; });
      if (!res) return;
      setStep(2);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={`Book — ${pkg.title}`} wide>
      <div className="mb-6">
        <div className="flex items-center gap-1">
          {STEPS.map((s, i) => (
            <div key={s} className="flex flex-1 items-center gap-1">
              <div className={`flex items-center gap-2`}>
                <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${i < step ? "bg-emerald-500 text-white" : i === step ? "bg-brand-600 text-white" : "bg-ink-100 text-ink-400"}`}>
                  {i < step ? "✓" : i + 1}
                </span>
                <span className={`text-xs font-medium ${i <= step ? "text-ink-900" : "text-ink-400"}`}>{s}</span>
              </div>
              {i < STEPS.length - 1 && <div className="mx-1 h-px flex-1 bg-ink-200" />}
            </div>
          ))}
        </div>
      </div>

      {step === 0 && (
        <div className="space-y-4">
          <div className="rounded-xl bg-ink-50 p-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-ink-900">{pkg.publisher_name ?? "Publisher"}</span>
              <Badgeish label={pkg.platform} />
            </div>
            <div className="mt-2 flex items-center justify-between text-ink-600">
              <span>{pkg.title}</span>
              <span className="font-bold text-ink-900">{formatMoney(pkg.price)}</span>
            </div>
          </div>
          <Field label="Campaign name" required>
            <Input value={form.name} onChange={set("name")} placeholder="e.g. Festive Sale 2026" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Product / service">
              <Input value={form.product} onChange={set("product")} placeholder="e.g. Clothing store" />
            </Field>
            <Field label="Campaign objective">
              <Input value={form.objective} onChange={set("objective")} placeholder="e.g. BRAND_AWARENESS" />
            </Field>
          </div>
          <Field label="Target audience">
            <Input value={form.audience} onChange={set("audience")} placeholder="e.g. Youth 18-34 in Mizoram" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Start date" required>
              <Input type="date" value={form.start} onChange={set("start")} />
            </Field>
            <Field label="End date" required>
              <Input type="date" value={form.end} onChange={set("end")} />
            </Field>
          </div>
          <Field label="Instructions (optional)">
            <Textarea value={form.instructions} onChange={set("instructions")} rows={3} placeholder="Any special instructions for the publisher…" />
          </Field>
          <Field label="Creative material (optional)" hint="Upload a flyer or video now, or add it later. Don't have one? Use Creative Studio.">
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-ink-300 px-4 py-6 text-sm text-ink-500 hover:border-brand-400 hover:bg-brand-50/40">
              <Upload className="h-5 w-5" />
              {file ? file.name : "Click to upload — JPG, PNG, WEBP, PDF, MP4 (max 100MB)"}
              <input type="file" className="hidden" accept=".jpg,.jpeg,.png,.webp,.pdf,.mp4,.mov" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </label>
            {uploadPct > 0 && uploadPct < 100 && <ProgressBar value={uploadPct} max={100} />}
          </Field>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-xl border border-ink-200 bg-white p-4">
            <CalendarCheck className="h-8 w-8 text-brand-600" />
            <div className="text-sm">
              <p className="font-semibold text-ink-900">Booking created — {bookingIds.length} item(s)</p>
              <p className="text-ink-500">Your slots are now reserved for the next 30 minutes. Complete payment to confirm.</p>
            </div>
          </div>
          <div className="rounded-xl bg-ink-50 p-4 text-sm">
            <div className="flex justify-between"><span className="text-ink-500">Package</span><span className="font-semibold">{pkg.title}</span></div>
            <div className="mt-1.5 flex justify-between"><span className="text-ink-500">Amount (incl. agency fees)</span><span className="font-bold">{formatMoney(pkg.price)}</span></div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-xl border border-ink-200 bg-white p-4">
            <CreditCard className="h-8 w-8 text-brand-600" />
            <div className="text-sm">
              <p className="font-semibold text-ink-900">Payment via UPI (test gateway)</p>
              <p className="text-ink-500">In production this connects to a payment provider (Razorpay) with server-side verification.</p>
            </div>
          </div>
          {checkout.data && (
            <div className="rounded-xl bg-ink-50 p-4 text-center">
              <p className="text-xs uppercase tracking-wide text-ink-400">Payment reference</p>
              <p className="mt-1 font-mono text-lg font-bold text-ink-900">{paymentRef}</p>
              <p className="mt-1 text-xs text-ink-500">Confirm payment to simulate the gateway returning a successful payment.</p>
            </div>
          )}
        </div>
      )}

      {step === 3 && (
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
            <CheckCircle2 className="h-9 w-9 text-emerald-600" />
          </span>
          <div>
            <h3 className="text-lg font-bold text-ink-900">Payment successful!</h3>
            <p className="mt-1 text-sm text-ink-500">
              Your booking is confirmed, an invoice has been issued, and the publisher has been notified.
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose}>Close</Button>
            <Button
              onClick={() => {
                onClose();
                navigate({ to: "/advertiser/campaigns" });
              }}
            >
              View Campaigns
            </Button>
          </div>
        </div>
      )}

      {error && <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {step < 3 && (
        <div className="mt-6 flex justify-end gap-3 border-t border-ink-100 pt-4">
          {step > 0 && (
            <Button variant="outline" onClick={() => { setStep(step - 1); setError(""); }}>
              Back
            </Button>
          )}
          {step === 2 ? (
            <Button loading={confirm.isPending} onClick={() => confirm.mutate()} icon={<CreditCard className="h-4 w-4" />}>
              Confirm Payment
            </Button>
          ) : (
            <Button loading={createBooking.isPending || checkout.isPending} onClick={next} icon={<CalendarCheck className="h-4 w-4" />}>
              {step === 0 ? "Continue to Payment" : "Proceed to Payment"}
            </Button>
          )}
        </div>
      )}
    </Dialog>
  );
}

function Badgeish({ label }: { label: string }) {
  return <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-700 ring-1 ring-inset ring-sky-200">{label}</span>;
}
