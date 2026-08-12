import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { Loader2, X } from "lucide-react";
import { cn, initials } from "../lib/utils";

/* ---------------- Button ---------------- */

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "success";
type ButtonSize = "sm" | "md" | "lg";

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-brand-600 text-white hover:bg-brand-700 shadow-sm shadow-brand-600/20",
  secondary: "bg-ink-900 text-white hover:bg-ink-800",
  outline: "border border-ink-300 bg-white text-ink-700 hover:bg-ink-50 hover:border-ink-400",
  ghost: "text-ink-600 hover:bg-ink-100 hover:text-ink-900",
  danger: "bg-red-600 text-white hover:bg-red-700",
  success: "bg-emerald-600 text-white hover:bg-emerald-700",
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-6 text-base gap-2",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading, icon, children, disabled, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center rounded-xl font-medium transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]",
        buttonVariants[variant],
        buttonSizes[size],
        className,
      )}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </button>
  ),
);
Button.displayName = "Button";

/* ---------------- Inputs ---------------- */

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-10 w-full rounded-xl border border-ink-300 bg-white px-3.5 text-sm text-ink-900 placeholder:text-ink-400 transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "w-full rounded-xl border border-ink-300 bg-white px-3.5 py-2.5 text-sm text-ink-900 placeholder:text-ink-400 transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none",
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        "h-10 w-full rounded-xl border border-ink-300 bg-white px-3.5 text-sm text-ink-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  ),
);
Select.displayName = "Select";

export function Field({ label, hint, error, children, required }: { label: string; hint?: string; error?: string; children: ReactNode; required?: boolean }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-ink-700">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      {children}
      {hint && !error && <span className="block text-xs text-ink-400">{hint}</span>}
      {error && <span className="block text-xs text-red-600">{error}</span>}
    </label>
  );
}

/* ---------------- Card ---------------- */

export function Card({ className, children, onClick }: { className?: string; children: ReactNode; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className={cn("rounded-2xl border border-ink-200 bg-white shadow-sm", onClick && "cursor-pointer transition-all hover:shadow-md hover:border-brand-200", className)}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-ink-100 px-5 py-4">
      <div>
        <h3 className="text-sm font-semibold text-ink-900">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-ink-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function CardBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("px-5 py-4", className)}>{children}</div>;
}

/* ---------------- Badge ---------------- */

type BadgeTone = "brand" | "green" | "amber" | "red" | "slate" | "blue" | "violet" | "pink";

const badgeTones: Record<BadgeTone, string> = {
  brand: "bg-brand-50 text-brand-700 ring-brand-200",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  amber: "bg-amber-50 text-amber-700 ring-amber-200",
  red: "bg-red-50 text-red-700 ring-red-200",
  slate: "bg-ink-100 text-ink-600 ring-ink-200",
  blue: "bg-sky-50 text-sky-700 ring-sky-200",
  violet: "bg-violet-50 text-violet-700 ring-violet-200",
  pink: "bg-pink-50 text-pink-700 ring-pink-200",
};

export function Badge({ tone = "slate", children, className }: { tone?: BadgeTone; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset", badgeTones[tone], className)}>
      {children}
    </span>
  );
}

export function statusTone(status: string): BadgeTone {
  const s = status.toUpperCase();
  if (["ACTIVE", "APPROVED", "PAID", "SUCCESSFUL", "COMPLETED", "LIVE", "DELIVERED", "PUBLISHED", "PUBLISHER_APPROVED", "APPROVED", "PUBLISHER_PAID"].includes(s)) return "green";
  if (["PENDING", "PENDING_PAYMENT", "DRAFT", "INITIATED", "NEW_REQUEST", "ASSIGNED", "UNDER_REVIEW", "SCHEDULED", "RESERVED", "SETTLEMENT_PENDING", "VERIFICATION_REQUIRED"].includes(s)) return "amber";
  if (["REJECTED", "FAILED", "CANCELLED", "REFUNDED", "BLOCKED", "SUSPENDED", "REVISION_REQUESTED", "SETTLEMENT_FAILED"].includes(s)) return "red";
  if (["OPEN", "DISPUTED"].includes(s)) return "pink";
  if (["VERIFIED", "PREMIUM", "FEATURED", "CREATIVE_APPROVED", "APPROVED_BY_AGENCY", "PUBLISHER_REVIEW", "REVIEW", "FINAL_APPROVAL"].includes(s)) return "brand";
  return "slate";
}

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={statusTone(status)}>{status.replace(/_/g, " ")}</Badge>;
}

/* ---------------- Table ---------------- */

export function Table({ headers, children, className }: { headers: ReactNode[]; children: ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-ink-200 bg-ink-50/60">
            {headers.map((h, i) => (
              <th key={i} className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ink-500">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100">{children}</tbody>
      </table>
    </div>
  );
}

export function Td({ children, className }: { children: ReactNode; className?: string }) {
  return <td className={cn("px-4 py-3 align-middle", className)}>{children}</td>;
}

/* ---------------- Other primitives ---------------- */

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("h-5 w-5 animate-spin text-brand-600", className)} />;
}

export function PageLoader({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-ink-400">
      <Spinner className="h-7 w-7" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} />;
}

export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      {icon && <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-ink-100 text-ink-400">{icon}</div>}
      <h3 className="text-base font-semibold text-ink-900">{title}</h3>
      {description && <p className="max-w-sm text-sm text-ink-500">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function StatCard({ label, value, sub, icon, tone = "brand" }: { label: string; value: ReactNode; sub?: ReactNode; icon?: ReactNode; tone?: BadgeTone }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-ink-400">{label}</p>
          <p className="mt-1.5 text-2xl font-bold tracking-tight text-ink-900">{value}</p>
          {sub && <p className="mt-1 text-xs text-ink-500">{sub}</p>}
        </div>
        {icon && <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl text-white", tone === "brand" && "bg-brand-600", tone === "green" && "bg-emerald-600", tone === "amber" && "bg-amber-500", tone === "red" && "bg-red-500", tone === "blue" && "bg-sky-600", tone === "violet" && "bg-violet-600", tone === "slate" && "bg-ink-500", tone === "pink" && "bg-pink-600")}>{icon}</div>}
      </div>
    </Card>
  );
}

export function Avatar({ name, url, size = 40, className }: { name: string; url?: string | null; size?: number; className?: string }) {
  if (url) {
    return <img src={url} alt={name} style={{ width: size, height: size }} className={cn("rounded-full object-cover ring-2 ring-white", className)} />;
  }
  return (
    <div
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      className={cn("flex items-center justify-center rounded-full bg-brand-600 font-semibold text-white", className)}
    >
      {initials(name)}
    </div>
  );
}

export function Dialog({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-ink-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className={cn("relative w-full rounded-2xl bg-white shadow-2xl", wide ? "max-w-2xl" : "max-w-md")}>
        <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
          <h2 className="text-base font-semibold text-ink-900">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700" aria-label="Close dialog">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[75vh] overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

export function Tabs({ tabs, active, onChange }: { tabs: { id: string; label: string; count?: number }[]; active: string; onChange: (id: string) => void }) {
  return (
    <div className="flex gap-1 overflow-x-auto rounded-xl bg-ink-100 p-1" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={active === t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            "flex-1 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-all",
            active === t.id ? "bg-white text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-800",
          )}
        >
          {t.label}
          {typeof t.count === "number" && (
            <span className={cn("ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold", active === t.id ? "bg-brand-100 text-brand-700" : "bg-ink-200 text-ink-500")}>{t.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

export function ProgressBar({ value, max, className }: { value: number; max: number; className?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-ink-100", className)}>
      <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function VerifyBadge({ verified }: { verified: number | boolean }) {
  if (!verified) return null;
  return (
    <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-sky-500 text-white" title="Verified publisher">
      <svg viewBox="0 0 24 24" fill="none" className="h-3 w-3" stroke="currentColor" strokeWidth="3"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </span>
  );
}

export function Pagination({ page, pageSize, total, onChange }: { page: number; pageSize: number; total: number; onChange: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <p className="text-xs text-ink-500">
        Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
      </p>
      <div className="flex gap-1">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>Previous</Button>
        <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => onChange(page + 1)}>Next</Button>
      </div>
    </div>
  );
}
