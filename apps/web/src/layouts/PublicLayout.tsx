import { Link, useRouter } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Megaphone, Sparkles, LogOut, UserCircle2 } from "lucide-react";
import { useAuth } from "../lib/auth";
import { Avatar, Button } from "../components/ui";
import { cn } from "../lib/utils";

export function PublicLayout({ children }: { children?: ReactNode }) {
  const { user, isAuthenticated, isAdmin, isPublisher, isAdvertiser, logout } = useAuth();
  const router = useRouter();

  const dashboardLink = isAdmin
    ? "/admin"
    : isPublisher
      ? "/publisher/dashboard"
      : isAdvertiser
        ? "/advertiser/dashboard"
        : "/login";

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-ink-200 bg-white/95 shadow-xs gpu-layer">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm shadow-brand-600/30">
              <Megaphone className="h-5 w-5" />
            </span>
            <span className="text-lg font-bold tracking-tight text-ink-900">
              AdAgency<span className="text-brand-600">Hub</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            <Link to="/publishers" className="rounded-lg px-3 py-2 text-sm font-medium text-ink-600 hover:bg-ink-100 hover:text-ink-900">
              Find Publishers
            </Link>
            <Link to="/register" search={{ role: "publisher" }} className="rounded-lg px-3 py-2 text-sm font-medium text-ink-600 hover:bg-ink-100 hover:text-ink-900">
              Become a Publisher
            </Link>
            {isAdvertiser && (
              <Link to="/advertiser/assistant" className="rounded-lg px-3 py-2 text-sm font-medium text-ink-600 hover:bg-ink-100 hover:text-ink-900">
                AI Assistant
              </Link>
            )}
          </nav>

          <div className="flex items-center gap-2">
            {isAuthenticated && user ? (
              <>
                <Link to={dashboardLink as never}>
                  <Button variant="outline" size="sm" icon={<UserCircle2 className="h-4 w-4" />}>
                    Dashboard
                  </Button>
                </Link>
                <Avatar name={user.name} size={32} />
                <button
                  onClick={async () => {
                    await logout();
                    router.invalidate();
                  }}
                  className="rounded-lg p-2 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
                  aria-label="Log out"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </>
            ) : (
              <>
                <Link to="/login"><Button variant="ghost" size="sm">Log in</Button></Link>
                <Link to="/register"><Button size="sm">Get Started</Button></Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className={cn("flex-1")}>
        {children}
      </main>

      <footer className="border-t border-ink-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
                <Megaphone className="h-4 w-4" />
              </span>
              <span className="font-bold text-ink-900">AdAgency<span className="text-brand-600">Hub</span></span>
            </div>
            <p className="text-sm leading-relaxed text-ink-500">
              The advertising agency marketplace connecting brands with publishers, media platforms, influencers and creative services.
            </p>
          </div>
          <div>
            <h4 className="mb-3 text-sm font-semibold text-ink-900">Marketplace</h4>
            <ul className="space-y-2 text-sm text-ink-500">
              <li><Link to="/publishers" className="hover:text-brand-600">Find Publishers</Link></li>
              <li><Link to="/register" search={{ role: "publisher" }} className="hover:text-brand-600">Become a Publisher</Link></li>
              <li><Link to="/register" className="hover:text-brand-600">Advertise With Us</Link></li>
              <li><Link to="/register" search={{ role: "advertiser" }} className="hover:text-brand-600">Request a Design</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="mb-3 text-sm font-semibold text-ink-900">Services</h4>
            <ul className="space-y-2 text-sm text-ink-500">
              <li>Social media flyers & posters</li>
              <li>Video advertisements & reels</li>
              <li>Campaign management</li>
              <li>Media planning & booking</li>
            </ul>
          </div>
          <div>
            <h4 className="mb-3 text-sm font-semibold text-ink-900">Contact</h4>
            <ul className="space-y-2 text-sm text-ink-500">
              <li>hello@adagencyhub.in</li>
              <li>Aizawl, Mizoram</li>
              <li className="flex items-center gap-1.5 pt-2">
                <Sparkles className="h-4 w-4 text-brand-500" />
                <Link to={isAdvertiser ? "/advertiser/assistant" : "/login"} className="font-medium text-brand-600 hover:underline">
                  Ask our Advertising Assistant
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-ink-100 py-5 text-center text-xs text-ink-400">
          © {new Date().getFullYear()} AdAgencyHub · Advertising Agency Marketplace. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
