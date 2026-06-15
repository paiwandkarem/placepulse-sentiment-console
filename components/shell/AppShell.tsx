"use client";

import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bot, ChevronLeft, ChevronRight, FileText, Gauge, HelpCircle, LayoutDashboard, MapPin, Menu, X } from "lucide-react";
import { UserButton } from "@clerk/nextjs";
import { cn } from "@/lib/ui/sentiment";
import { HelpModal } from "./HelpModal";

// Application shell. On md+ it is a fixed, collapsible left sidebar with the main content offset
// beside it (so content fills the remaining width rather than floating in a centred column).
// Collapse state persists across visits. The nav is deliberately small, one entry per product area.
//
// Below md the sidebar is replaced by a fixed overlay top bar (brand + account + a hamburger that
// opens an off-canvas menu). The content wrapper is padded down by the bar's height (h-14 = 3.5rem);
// full-height surfaces (the assistant and places maps) subtract that same 3.5rem on mobile so the
// page fills the viewport exactly instead of overflowing under the bar.

type NavItem = { label: string; icon: ComponentType<{ className?: string }>; href?: string; soon?: boolean };

const NAV: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/" },
  { label: "AI assistant", icon: Bot, href: "/assistant" },
  { label: "Briefs", icon: FileText, href: "/briefs" },
  { label: "Places", icon: MapPin, href: "/places" },
];

// The nav links, shared by the desktop sidebar and the mobile off-canvas menu so their active-state
// logic and styling never drift. onNavigate lets the mobile menu close itself on selection.
function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <>
      {NAV.map((item) => {
        const Icon = item.icon;
        if (item.soon) {
          return (
            <span
              key={item.label}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold text-gray-300"
              title="Coming soon"
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
              <span className="ml-auto rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gray-500">
                Soon
              </span>
            </span>
          );
        }
        const href = item.href ?? "/";
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={item.label}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
              active ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </>
  );
}

export function AppShell({ children, initialCollapsed = false }: { children: ReactNode; initialCollapsed?: boolean }) {
  // Seeded from the server-read cookie, so the first render already matches the user's preference and
  // the content margin never shifts after hydration (no CLS for returning collapsed-sidebar users).
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const pathname = usePathname();

  // Escape closes the mobile menu. (Tapping a nav item closes it via NavLinks' onNavigate, and the
  // backdrop closes it on click, so there is no need to react to route changes in an effect.)
  useEffect(() => {
    if (!mobileOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setMobileOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev;
      // Persist in a cookie (not localStorage) so the server can read it and render the correct
      // sidebar width on first paint, avoiding a post-hydration content-margin shift (CLS).
      document.cookie = `ppSidebarCollapsed=${next ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
      return next;
    });
  }

  // The auth pages render their own centred card; skip the sidebar chrome there so a signed-out
  // visitor sees only the sign-in form.
  if (pathname.startsWith("/sign-in") || pathname.startsWith("/sign-up")) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Desktop sidebar (md+) */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-gray-200 bg-white transition-transform duration-300 ease-in-out md:flex",
          collapsed ? "-translate-x-full" : "translate-x-0",
        )}
      >
        <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-900 text-white">
            <Gauge className="h-5 w-5" />
          </span>
          <span className="text-base font-extrabold tracking-tight text-gray-900">PlacePulse</span>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          <NavLinks pathname={pathname} />
        </nav>

        <div className="border-t border-gray-100 p-3">
          <div className="mb-1 flex items-center gap-3 px-3 py-2">
            <UserButton />
            <span className="text-sm font-medium text-gray-600">Account</span>
          </div>
          <button
            type="button"
            onClick={() => setHelpOpen(true)}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
          >
            <HelpCircle className="h-4 w-4 shrink-0" />
            Help and docs
          </button>
        </div>
      </aside>

      {/* Desktop collapse toggle (md+) */}
      <button
        type="button"
        onClick={toggle}
        aria-label={collapsed ? "Open sidebar" : "Collapse sidebar"}
        className={cn(
          "fixed top-1/2 z-50 hidden -translate-y-1/2 rounded-r-lg bg-gray-700 px-2 py-2 text-white shadow transition-all duration-300 hover:bg-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 md:flex",
          collapsed ? "left-0" : "left-64",
        )}
      >
        {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
      </button>

      {/* Mobile top bar (below md): overlays content; the content wrapper pads down by its height. */}
      <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b border-gray-200 bg-white px-4 md:hidden">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
            aria-expanded={mobileOpen}
            className="-ml-1 flex h-11 w-11 items-center justify-center rounded-lg text-gray-700 hover:bg-gray-100"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-900 text-white">
              <Gauge className="h-[18px] w-[18px]" />
            </span>
            <span className="text-sm font-extrabold tracking-tight text-gray-900">PlacePulse</span>
          </Link>
        </div>
        <UserButton />
      </header>

      {/* Mobile off-canvas menu */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
            className="absolute inset-0 bg-gray-900/40"
          />
          <div
            role="dialog"
            aria-label="Menu"
            className="absolute inset-y-0 left-0 flex w-72 max-w-[80vw] flex-col border-r border-gray-200 bg-white shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-4">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-900 text-white">
                  <Gauge className="h-5 w-5" />
                </span>
                <span className="text-base font-extrabold tracking-tight text-gray-900">PlacePulse</span>
              </div>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Close menu"
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <nav className="flex-1 space-y-1 overflow-y-auto p-3">
              <NavLinks pathname={pathname} onNavigate={() => setMobileOpen(false)} />
            </nav>
            <div className="border-t border-gray-100 p-3">
              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  setHelpOpen(true);
                }}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
              >
                <HelpCircle className="h-4 w-4 shrink-0" />
                Help and docs
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Content: offset beside the sidebar on desktop, padded below the overlay bar on mobile. */}
      <div className={cn("pt-14 transition-all duration-300 ease-in-out md:pt-0", collapsed ? "md:ml-0" : "md:ml-64")}>
        {children}
      </div>

      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}
