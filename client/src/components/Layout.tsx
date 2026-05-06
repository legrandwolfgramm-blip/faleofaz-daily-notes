import { useState } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, FileText, Users, UserCheck,
  ChevronLeft, ChevronRight, Moon, Sun, Shield, Upload
} from "lucide-react";
import { Button } from "@/components/ui/button";

const NAV = [
  { href: "/", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/entry/import", icon: Upload, label: "Upload & Organize" },
  { href: "/reports", icon: FileText, label: "Reports" },
  { href: "/persons", icon: Users, label: "Persons" },
  { href: "/staff", icon: UserCheck, label: "Staff" },
];

/* ─── FaleOfaz logo — sage + warm cream wordmark ─────────────────────────── */
function FaleOfazLogo({ collapsed }: { collapsed: boolean }) {
  return (
    <div className={cn("flex items-center gap-2.5", collapsed && "justify-center")}>
      {/* Icon mark — stacked leaf/page motif in sage */}
      <svg
        width="34"
        height="34"
        viewBox="0 0 34 34"
        fill="none"
        aria-label="Fale Ofaz logo"
        className="shrink-0"
      >
        {/* Background rounded square */}
        <rect width="34" height="34" rx="8" fill="hsl(152 32% 36%)" />
        {/* Top bar — full width */}
        <rect x="7" y="8" width="20" height="3" rx="1.5" fill="white" />
        {/* Middle bar — 3/4 width, warm accent tint */}
        <rect x="7" y="13.5" width="14" height="3" rx="1.5" fill="hsl(152 60% 82%)" />
        {/* Lower bar — partial */}
        <rect x="7" y="19" width="17" height="3" rx="1.5" fill="white" opacity="0.75" />
        {/* Checkmark circle — bottom right */}
        <circle cx="26" cy="25.5" r="5" fill="hsl(152 45% 28%)" />
        <path
          d="M23.5 25.5 L25.2 27.2 L28.5 23.8"
          stroke="hsl(152 55% 82%)"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      {/* Wordmark — only when expanded */}
      {!collapsed && (
        <div className="flex flex-col leading-none">
          {/* "FaleOfaz" in two tones */}
          <div className="flex items-baseline gap-0">
            <span
              className="text-sm font-bold tracking-tight"
              style={{ color: "hsl(152 32% 32%)" }}
            >
              Fale
            </span>
            <span
              className="text-sm font-bold tracking-tight"
              style={{ color: "hsl(30 12% 20%)" }}
            >
              Ofaz
            </span>
            <span
              className="text-[10px] font-semibold ml-1 px-1 py-0.5 rounded"
              style={{
                background: "hsl(152 32% 36% / 0.12)",
                color: "hsl(152 32% 32%)",
              }}
            >
              LLC
            </span>
          </div>
          <span
            className="text-[10px] tracking-wide mt-0.5"
            style={{ color: "hsl(30 8% 52%)" }}
          >
            Daily Notes Organizer
          </span>
        </div>
      )}
    </div>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [dark, setDark] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches
  );
  const [location] = useLocation();

  const toggleDark = () => {
    setDark((d) => {
      const next = !d;
      document.documentElement.classList.toggle("dark", next);
      return next;
    });
  };

  if (typeof document !== "undefined") {
    document.documentElement.classList.toggle("dark", dark);
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          "flex flex-col border-r transition-all duration-200 shrink-0",
          collapsed ? "w-14" : "w-60"
        )}
        style={{
          background: "hsl(var(--sidebar-bg))",
          borderColor: "hsl(var(--sidebar-border))",
        }}
      >
        {/* Logo area */}
        <div
          className={cn(
            "px-3 py-4 border-b",
            collapsed && "flex justify-center"
          )}
          style={{ borderColor: "hsl(var(--sidebar-border))" }}
        >
          <FaleOfazLogo collapsed={collapsed} />
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 flex flex-col gap-0.5 px-2">
          {NAV.map(({ href, icon: Icon, label }) => {
            const active = location === href;
            return (
              <Link key={href} href={href}>
                <a
                  data-testid={`nav-${label.toLowerCase().replace(/\s/g, "-")}`}
                  className={cn(
                    "flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer",
                    active
                      ? "text-white"
                      : "text-muted-foreground hover:text-foreground",
                    collapsed && "justify-center px-0"
                  )}
                  style={
                    active
                      ? { background: "hsl(152 32% 36%)", boxShadow: "0 1px 3px hsl(152 32% 20% / 0.25)" }
                      : undefined
                  }
                  onMouseEnter={(e) => {
                    if (!active) (e.currentTarget as HTMLElement).style.background = "hsl(152 32% 36% / 0.10)";
                  }}
                  onMouseLeave={(e) => {
                    if (!active) (e.currentTarget as HTMLElement).style.background = "";
                  }}
                  title={collapsed ? label : undefined}
                >
                  <Icon size={17} className="shrink-0" />
                  {!collapsed && label}
                </a>
              </Link>
            );
          })}
        </nav>

        {/* Compliance tag */}
        {!collapsed && (
          <div
            className="mx-2 mb-2 p-2.5 rounded-xl border"
            style={{
              background: "hsl(152 32% 36% / 0.07)",
              borderColor: "hsl(152 32% 36% / 0.20)",
            }}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <Shield size={11} style={{ color: "hsl(152 32% 36%)" }} />
              <span className="text-xs font-semibold" style={{ color: "hsl(152 32% 32%)" }}>
                Compliance
              </span>
            </div>
            <p
              className="text-xs leading-snug"
              style={{ color: "hsl(30 8% 50%)" }}
            >
              R380-80 · R380-600
              <br />
              DSPD SAS
            </p>
          </div>
        )}

        {/* Bottom controls */}
        <div
          className={cn(
            "p-2 border-t flex",
            collapsed ? "flex-col gap-1" : "items-center justify-between"
          )}
          style={{ borderColor: "hsl(var(--sidebar-border))" }}
        >
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleDark}
            data-testid="btn-toggle-dark"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            {dark ? <Sun size={15} /> : <Moon size={15} />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed((c) => !c)}
            data-testid="btn-toggle-sidebar"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  );
}
