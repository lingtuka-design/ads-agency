import { Link, Outlet, useLocation } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  LayoutDashboard, Megaphone, Package, CalendarCheck, Wallet, UserCog, MessageSquare,
  Sparkles, Search, FolderOpen, CreditCard, FileText, Heart, Compass, Settings, LogOut, Images,
} from "lucide-react";
import { useAuth } from "../lib/auth";
import { Avatar } from "../components/ui";
import { cn } from "../lib/utils";

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
}

export function AppLayout() {
  const { user, isAdvertiser, isPublisher, logout } = useAuth();
  const location = useLocation();
  const path = location.pathname;

  const nav: NavItem[] = isAdvertiser
    ? [
        { to: "/advertiser/dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
        { to: "/advertiser/publishers", label: "Find Publishers", icon: <Search className="h-4 w-4" /> },
        { to: "/advertiser/assistant", label: "AI Assistant", icon: <Sparkles className="h-4 w-4" /> },
        { to: "/advertiser/campaigns", label: "My Campaigns", icon: <Compass className="h-4 w-4" /> },
        { to: "/advertiser/bookings", label: "My Bookings", icon: <CalendarCheck className="h-4 w-4" /> },
        { to: "/advertiser/creative-studio", label: "Creative Studio", icon: <Images className="h-4 w-4" /> },
        { to: "/advertiser/messages", label: "Messages", icon: <MessageSquare className="h-4 w-4" /> },
        { to: "/advertiser/files", label: "Files", icon: <FolderOpen className="h-4 w-4" /> },
        { to: "/advertiser/payments", label: "Payments", icon: <CreditCard className="h-4 w-4" /> },
        { to: "/advertiser/invoices", label: "Invoices", icon: <FileText className="h-4 w-4" /> },
        { to: "/advertiser/shortlist", label: "My Shortlist", icon: <Heart className="h-4 w-4" /> },
        { to: "/advertiser/settings", label: "Account Settings", icon: <Settings className="h-4 w-4" /> },
      ]
    : isPublisher
      ? [
          { to: "/publisher/dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
          { to: "/publisher/packages", label: "My Packages", icon: <Package className="h-4 w-4" /> },
          { to: "/publisher/bookings", label: "Bookings", icon: <CalendarCheck className="h-4 w-4" /> },
          { to: "/publisher/earnings", label: "Earnings", icon: <Wallet className="h-4 w-4" /> },
          { to: "/publisher/profile", label: "Media Kit", icon: <UserCog className="h-4 w-4" /> },
          { to: "/publisher/messages", label: "Messages", icon: <MessageSquare className="h-4 w-4" /> },
        ]
      : [];

  return (
    <div className="flex min-h-screen bg-ink-50">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-ink-200 bg-white lg:flex">
        <Link to="/" className="flex h-16 items-center gap-2.5 border-b border-ink-100 px-5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white">
            <Megaphone className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-bold leading-tight text-ink-900">AdAgency<span className="text-brand-600">Hub</span></p>
            <p className="text-[10px] font-medium uppercase tracking-wide text-ink-400">
              {isAdvertiser ? "Advertiser" : "Publisher"} Dashboard
            </p>
          </div>
        </Link>
        <nav className="scrollbar-thin flex-1 space-y-0.5 overflow-y-auto p-3">
          {nav.map((item) => {
            const active = item.to === "/advertiser/dashboard" || item.to === "/publisher/dashboard"
              ? path === item.to
              : path.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  active ? "bg-brand-50 text-brand-700" : "text-ink-600 hover:bg-ink-100 hover:text-ink-900",
                )}
              >
                {item.icon}
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-ink-100 p-3">
          <div className="flex items-center gap-3 rounded-xl bg-ink-50 p-3">
            {user && <Avatar name={user.name} size={34} />}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink-900">{user?.name}</p>
              <p className="truncate text-xs text-ink-400">{user?.email}</p>
            </div>
            <button onClick={() => logout()} className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-200 hover:text-ink-700" aria-label="Log out">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 lg:pl-64">
        <div className="flex items-center gap-2 overflow-x-auto border-b border-ink-200 bg-white px-4 py-2 lg:hidden">
          {nav.map((item) => (
            <Link key={item.to} to={item.to} className={cn(
              "whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium",
              path.startsWith(item.to) ? "bg-brand-50 text-brand-700" : "text-ink-500",
            )}>
              {item.label}
            </Link>
          ))}
        </div>
        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
