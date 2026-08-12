import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { api } from "../lib/api";
import { apiErrorMessage } from "../lib/utils";
import { Button, Dialog, Field, Input } from "./ui";
import { cn } from "../lib/utils";

export interface PublicationSlot {
  id: string;
  booking_id: string;
  slot_date: string; // YYYY-MM-DD
  slot_time: string | null;
  status: "PROPOSED" | "APPROVED" | "ADJUSTED" | "REJECTED" | "PUBLISHED";
  proposed_by: string;
  note: string | null;
  created_at: string;
  updated_at: string;
}

const STATUS_STYLES: Record<PublicationSlot["status"], string> = {
  PROPOSED: "bg-amber-400 ring-amber-200",
  APPROVED: "bg-emerald-500 ring-emerald-200",
  ADJUSTED: "bg-sky-500 ring-sky-200",
  REJECTED: "bg-red-400 ring-red-200",
  PUBLISHED: "bg-violet-500 ring-violet-200",
};

const STATUS_LABEL: Record<PublicationSlot["status"], string> = {
  PROPOSED: "Requested by advertiser",
  APPROVED: "Approved by publisher",
  ADJUSTED: "Adjusted by publisher — awaiting your OK",
  REJECTED: "Not available on this date",
  PUBLISHED: "Published",
};

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

function fmtDay(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function PublicationCalendar({
  bookingId,
  role,
}: {
  bookingId: string;
  role: "advertiser" | "publisher" | "admin";
}) {
  const qc = useQueryClient();
  const [cursor, setCursor] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [proposeOpen, setProposeOpen] = useState(false);
  const [adjustSlotId, setAdjustSlotId] = useState<string | null>(null);
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const { data: slots, isLoading } = useQuery({
    queryKey: ["slots", bookingId],
    queryFn: () => api.get<PublicationSlot[]>(`/api/bookings/${bookingId}/slots`),
    refetchInterval: 15_000,
  });

  const byDay = useMemo(() => {
    const map = new Map<string, PublicationSlot[]>();
    for (const s of slots ?? []) {
      const list = map.get(s.slot_date) ?? [];
      list.push(s);
      map.set(s.slot_date, list);
    }
    return map;
  }, [slots]);

  const grid = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const startOffset = (first.getDay() + 6) % 7; // Monday-first
    const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const cells: (string | null)[] = [];
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(fmtDay(new Date(cursor.getFullYear(), cursor.getMonth(), d)));
    return cells;
  }, [cursor]);

  const daySlots = selectedDay ? (byDay.get(selectedDay) ?? []) : [];

  const act = useMutation({
    mutationFn: ({ slotId, status, date, time, reason }: { slotId: string; status: string; date?: string; time?: string | null; reason?: string }) =>
      api.patch(`/api/bookings/${bookingId}/slots/${slotId}`, { status, date, time, note: reason || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["slots", bookingId] });
      setError("");
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  const propose = useMutation({
    mutationFn: () =>
      api.post(`/api/bookings/${bookingId}/slots`, {
        slots: [{ date: newDate, time: newTime || null, note: note || null }],
      }),
    onSuccess: () => {
      setProposeOpen(false);
      setNewDate("");
      setNewTime("");
      setNote("");
      qc.invalidateQueries({ queryKey: ["slots", bookingId] });
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  function openDialog(prefill?: { date: string; time?: string | null; note?: string; slotId?: string }) {
    setNewDate(prefill?.date ?? "");
    setNewTime(prefill?.time ?? "");
    setNote(prefill?.note ?? "");
    setAdjustSlotId(prefill?.slotId ?? null);
    setError("");
    setProposeOpen(true);
  }

  function confirmDialog() {
    if (!newDate) return;
    if (adjustSlotId) {
      act.mutate({
        slotId: adjustSlotId,
        status: "ADJUSTED",
        date: newDate,
        time: newTime || null,
        reason: note || undefined,
      });
    } else {
      propose.mutate();
    }
  }

  const monthLabel = `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`;
  const canPropose = role === "advertiser" || role === "admin";

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button
          className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
          onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="text-sm font-semibold text-ink-900">{monthLabel}</p>
        <button
          className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
          onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {DAYS.map((d) => (
          <span key={d} className="py-1 text-[10px] font-semibold uppercase tracking-wide text-ink-400">
            {d}
          </span>
        ))}
        {grid.map((day, i) => {
          if (!day) return <span key={`e-${i}`} />;
          const daySlotsList = byDay.get(day) ?? [];
          return (
            <button
              key={day}
              onClick={() => setSelectedDay(day)}
              className={cn(
                "relative flex aspect-square flex-col items-center justify-center rounded-lg text-sm transition-colors",
                daySlotsList.length > 0 ? "font-semibold text-ink-900 hover:bg-brand-50" : "text-ink-500 hover:bg-ink-100",
                selectedDay === day && "bg-brand-100 ring-2 ring-brand-300",
              )}
            >
              {parseInt(day.slice(8), 10)}
              {daySlotsList.length > 0 && (
                <span className="mt-0.5 flex gap-0.5">
                  {daySlotsList.slice(0, 3).map((s) => (
                    <span key={s.id} className={cn("h-1.5 w-1.5 rounded-full ring-2 ring-white", STATUS_STYLES[s.status])} />
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        {(Object.keys(STATUS_STYLES) as PublicationSlot["status"][]).map((s) => (
          <span key={s} className="flex items-center gap-1 text-[10px] text-ink-500">
            <span className={cn("h-2 w-2 rounded-full", STATUS_STYLES[s])} /> {STATUS_LABEL[s].split("—")[0].split(" (")[0]}
          </span>
        ))}
      </div>

      {isLoading && <p className="mt-3 text-xs text-ink-400">Loading publication dates…</p>}

      {canPropose && (
        <div className="mt-4">
          <Button size="sm" variant="outline" onClick={() => openDialog()}>
            + Request a publication date
          </Button>
        </div>
      )}

      <Dialog open={!!selectedDay} onClose={() => setSelectedDay(null)} title={selectedDay ? `Publication dates — ${selectedDay}` : ""}>
        {daySlots.length === 0 ? (
          <p className="py-4 text-center text-sm text-ink-400">No dates requested on this day.</p>
        ) : (
          <div className="space-y-3">
            {daySlots.map((s) => (
              <div key={s.id} className="rounded-xl border border-ink-200 p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-ink-900">
                      {s.slot_date}
                      {s.slot_time ? ` · ${s.slot_time}` : ""}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-500">{STATUS_LABEL[s.status]}</p>
                    {s.note && <p className="mt-1 rounded-lg bg-ink-50 px-2 py-1 text-xs text-ink-600">"{s.note}"</p>}
                  </div>
                  <span className={cn("h-3 w-3 shrink-0 rounded-full", STATUS_STYLES[s.status])} />
                </div>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {role !== "advertiser" && s.status === "PROPOSED" && (
                    <>
                      <Button size="sm" variant="success" onClick={() => act.mutate({ slotId: s.id, status: "APPROVED" })}>
                        Approve date
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => act.mutate({ slotId: s.id, status: "REJECTED", reason: "Not available" })}>
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openDialog({ date: s.slot_date, time: s.slot_time, note: `Adjusted from ${s.slot_date}`, slotId: s.id })}
                      >
                        Adjust date
                      </Button>
                    </>
                  )}
                  {role === "advertiser" && s.status === "ADJUSTED" && (
                    <>
                      <Button size="sm" variant="success" onClick={() => act.mutate({ slotId: s.id, status: "APPROVED" })}>
                        Accept date
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => act.mutate({ slotId: s.id, status: "PROPOSED", date: s.slot_date, reason: "Counter-proposed" })}>
                        Counter-propose
                      </Button>
                    </>
                  )}
                  {role === "admin" && (
                    <>
                      <Button size="sm" variant="success" onClick={() => act.mutate({ slotId: s.id, status: "APPROVED" })}>
                        Approve
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => act.mutate({ slotId: s.id, status: "REJECTED", reason: "Agency decision" })}>
                        Reject
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </Dialog>

      {/* Adjust / propose dialog — reused by both parties */}
      <Dialog open={proposeOpen} onClose={() => setProposeOpen(false)} title="Publication date">
        <div className="space-y-4">
          <Field label="Date" required>
            <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
          </Field>
          <Field label="Time (optional)">
            <Input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} />
          </Field>
          <Field label="Note">
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Best time for our audience is 6pm" />
          </Field>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setProposeOpen(false)}>Cancel</Button>
            <Button loading={propose.isPending || act.isPending} disabled={!newDate} onClick={confirmDialog}>
              {adjustSlotId ? "Propose adjusted date" : role === "advertiser" ? "Request this date" : "Propose this date"}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
