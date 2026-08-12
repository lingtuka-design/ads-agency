import { CalendarCheck } from "lucide-react";
import { formatMoney } from "../lib/utils";
import { Button, Dialog } from "./ui";

export interface ConfirmPackage {
  id: string;
  title: string;
  price: number;
  platform?: string;
  publisher_name?: string;
  available_slots?: number;
}

export function BookConfirm({
  open,
  pkg,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  pkg: ConfirmPackage | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog open={open} onClose={onCancel} title="Confirm booking">
      {pkg && (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-xl border border-ink-200 bg-white p-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <CalendarCheck className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-ink-900">{pkg.title}</p>
              {pkg.publisher_name && <p className="text-xs text-ink-500">{pkg.publisher_name}</p>}
              {pkg.platform && (
                <span className="mt-1.5 inline-block rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-700 ring-1 ring-inset ring-sky-200">
                  {pkg.platform}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl bg-ink-50 px-4 py-3 text-sm">
            <span className="text-ink-500">Price</span>
            <span className="font-bold text-ink-900">{formatMoney(pkg.price)}</span>
          </div>
          {typeof pkg.available_slots === "number" && (
            <div className="flex items-center justify-between rounded-xl bg-ink-50 px-4 py-3 text-sm">
              <span className="text-ink-500">Available slots</span>
              <span className="font-semibold text-ink-900">{pkg.available_slots}</span>
            </div>
          )}

          <p className="text-xs leading-relaxed text-ink-400">
            Your slot will be reserved while you complete the booking. Payment is collected by the agency and
            verified before the campaign is confirmed.
          </p>

          <div className="flex justify-end gap-2 border-t border-ink-100 pt-4">
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button onClick={onConfirm}>Okay</Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
