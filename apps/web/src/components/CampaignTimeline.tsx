import { Check, Circle, Clock, X } from "lucide-react";
import { CAMPAIGN_TIMELINE, timelineIndex, type BookingStatus } from "@agency/shared";
import { cn } from "../lib/utils";

export function CampaignTimeline({ status }: { status: string }) {
  const idx = timelineIndex(status as BookingStatus);
  const steps = CAMPAIGN_TIMELINE.filter((s) => s.status !== "DRAFT");

  return (
    <ol className="space-y-0">
      {steps.map((s, i) => {
        const done = i < idx;
        const current = i === idx;
        const skipped = ["CREATIVE_REQUIRED", "UNDER_REVIEW", "PUBLISHER_APPROVED", "PAID"].includes(s.status) && idx > i + 1;
        return (
          <li key={s.status} className="relative flex gap-3 pb-5 last:pb-0">
            {i < steps.length - 1 && (
              <span className={cn("absolute left-[13px] top-7 h-full w-0.5", i < idx ? "bg-brand-500" : "bg-ink-200")} />
            )}
            <span
              className={cn(
                "relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2",
                done && "border-brand-500 bg-brand-500 text-white",
                current && "border-brand-500 bg-white text-brand-600 ring-4 ring-brand-100",
                !done && !current && "border-ink-200 bg-white text-ink-300",
              )}
            >
              {done ? <Check className="h-3.5 w-3.5" /> : current ? <Clock className="h-3.5 w-3.5" /> : skipped ? <X className="h-3 w-3" /> : <Circle className="h-2.5 w-2.5" />}
            </span>
            <div className="pt-1">
              <p className={cn("text-sm font-medium", current ? "text-brand-700" : done ? "text-ink-800" : "text-ink-400")}>
                {s.label}
              </p>
              {current && <p className="text-xs text-brand-600">Current stage</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
