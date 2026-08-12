import { Link, Outlet, useLocation } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  LayoutDashboard, Users, Store, CalendarCheck, CreditCard, Wallet, Images,
  Scale, FileBarChart2, ScrollText, Settings, ShieldCheck, Megaphone, LogOut,
} from "lucide-react";
import { useAuth } from "../lib/auth";
import { Avatar } from "../components/ui";
import { cn } from "../lib/utils";

const nav: { to: string; label: string; icon: ReactNode }[] = [
  { to: "/admin", label: "Overview", icon: <LayoutDashboard className="h-4 w-4" /> },
  { to: "/admin/publishers", label: "Publishers", icon: <Store className="h-4 w-4" /> },
  { to: "/admin/advertisers", label: "Advertisers", icon: <Users className="h-4 w-4" /> },
  { to: "/admin/bookings", label: "Bookings", icon: <CalendarCheck className="h-4 w-4" /> },
  { to: "/admin/payments", label: "Payments", icon: <CreditCard className="h-4 w-4" /> },
  { to: "/admin/settlements", label: "Settlements", icon: <Wallet className="h-4 w-4" /> },
  { to: "/admin/creative-studio", label: "Creative Studio", icon: <Images className="h-4 w-4" /> },
  { to: "/admin/disputes", label: "Disputes", icon: <Scale className="h-4 w-4" /> },
  { to: "/admin/reports", label: "Reports", icon: <FileBarChart2 className="h-4 w-4" /> },
  { to: "/admin/audit", label: "Audit Logs", icon: <ScrollText className="h-4 w-4" /> },
  { to: "/admin/staff", label: "Staff", icon: <ShieldCheck className="h-4 w-4" /> },
  { to: "/admin/settings", label: "Settings & CMS", icon: <Settings className="h-4 w-4" /> },
];

export function AdminLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const path = location.pathname;

  return (
    <div className="flex min-h-screen bg-ink-900">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col bg-ink-900 lg:flex">
        <div className="flex h-16 items-center gap-2.5 border-b border-white/10 px-5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white">
            <Megaphone className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-bold leading-tight text-white">Agency Admin</p>
            <p className="text-[10px] font-medium uppercase tracking-wide text-ink-400">Command Center</p>
          </div>
        </div>
        <nav className="scrollbar-thin flex-1 space-y-0.5 overflow-y-auto p-3">
          {nav.map((item) => {
            const active = item.to === "/admin" ? path === "/admin" : path.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  active ? "bg-brand-600 text-white" : "text-ink-400 hover:bg-white/10 hover:text-white",
                )}
              >
                {item.icon}
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-white/10 p-3">
          <div className="flex items-center gap-3 rounded-xl bg-white/5 p-3">
            {user && <Avatar name={user.name} size={34} />}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">{user?.name}</p>
              <p className="truncate text-xs text-ink-400">{user?.staff_role ?? "SUPER_ADMIN"}</p>
            </div>
            <button onClick={() => logout()} className="rounded-lg p-1.5 text-ink-400 hover:bg-white/10 hover:text-white" aria-label="Log out">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 lg:pl-60">
        <div className="flex items-center gap-2 overflow-x-auto bg-ink-800 px-4 py-2 lg:hidden">
          {nav.map((item) => (
            <Link key={item.to} to={item.to} className={cn(
              "whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium",
              path.startsWith(item.to) ? "bg-brand-600 text-white" : "text-ink-400",
            )}>
              {item.label}
            </Link>
          ))}
        </div>
        <main className="bg-ink-50 px-4 py-6 sm:px-6 lg:px-8" style={{ minHeight: "100vh" }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
