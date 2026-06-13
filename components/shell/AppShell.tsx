"use client";

import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bot, ChevronLeft, ChevronRight, FileText, Gauge, HelpCircle, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/ui/sentiment";

// Application shell: a fixed, collapsible left sidebar with the main content offset beside it
// (so content fills the remaining width rather than floating in a centred column). The nav is
// deliberately small, one entry per product area. Collapse state persists across visits; below
// md the sidebar is hidden and content runs full width.

type NavItem = { label: string; icon: ComponentType<{ className?: string }>; href?: string; soon?: boolean };

const NAV: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/" },
  { label: "AI assistant", icon: Bot, href: "/assistant" },
  { label: "Briefs", icon: FileText, href: "/briefs" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  // Read the persisted preference after mount (not in a lazy initialiser) so server and client
  // first render agree, which avoids a hydration mismatch on the sidebar.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCollapsed(localStorage.getItem("ppSidebarCollapsed") === "1");
  }, []);

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("ppSidebarCollapsed", next ? "1" : "0");
      return next;
    });
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-gray-200 bg-white transition-transform duration-300 ease-in-out md:flex",
          collapsed ? "-translate-x-full" : "translate-x-0",
        )}
      >
        <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-900 text-white">
            <Gauge className="h-5 w-5" />
          </span>
          <span className="text-base font-extrabold tracking-tight text-gray-900">PlacePulse</span>
        </div>

        <nav className="flex-1 space-y-1 p-3">
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
                  <span className="ml-auto rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gray-400">
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
        </nav>

        <div className="border-t border-gray-100 p-3">
          <a
            href="https://nextjs.org/docs"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
          >
            <HelpCircle className="h-4 w-4 shrink-0" />
            Help and docs
          </a>
          <p className="px-3 pt-2 text-xs text-gray-400">Customer sentiment intelligence</p>
        </div>
      </aside>

      <button
        type="button"
        onClick={toggle}
        aria-label={collapsed ? "Open sidebar" : "Collapse sidebar"}
        className={cn(
          "fixed top-1/2 z-50 hidden -translate-y-1/2 rounded-r-md bg-gray-700 py-2 text-white shadow transition-all duration-300 hover:bg-gray-600 md:flex",
          collapsed ? "left-0" : "left-64",
        )}
      >
        {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
      </button>

      <div className={cn("transition-all duration-300 ease-in-out", collapsed ? "md:ml-0" : "md:ml-64")}>{children}</div>
    </div>
  );
}
