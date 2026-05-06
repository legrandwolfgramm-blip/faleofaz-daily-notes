import { useState } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, FileText, Users, UserCheck,
  ChevronLeft, ChevronRight, Moon, Sun, Shield, Upload,
  Settings, LogOut, User
} from "lucide-react";
import { Button } from "@/components/ui/button";

const NAV = [
  { href: "/", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/entry/import", icon: Upload, label: "Upload & Organize" },
  { href: "/reports", icon: FileText, label: "Reports" },
  { href: "/persons", icon: Users, label: "Persons" },
  { href: "/staff", icon: UserCheck, label: "Staff" },
];

interface LayoutProps {
  children: React.ReactNode;
  currentUser?: { username: string; role: string };
  onLogout?: () => void;
}

export default function Layout({ children, currentUser, onLogout }: LayoutProps) {
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

  // Full nav — admin link shown only for admins
  const fullNav = [
    ...NAV,
    ...(currentUser?.role === "admin"
      ? [{ href: "/admin", icon: Settings, label: "User Management" }]
      : []),
  ];

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          "flex flex-col bg-card border-r border-border transition-all duration-200 shrink-0",
          collapsed ? "w-14" : "w-56"
        )}
      >
        {/* Logo */}
        <div className={cn("flex items-center gap-2 px-3 py-4 border-b border-border", collapsed && "justify-center")}>
          <div className="shrink-0">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-label="FaleOfaz logo">
              <rect width="32" height="32" rx="7" fill="hsl(210 85% 28%)" />
              <rect x="6" y="8" width="20" height="3" rx="1.5" fill="white" />
              <rect x="6" y="14.5" width="13" height="3" rx="1.5" fill="hsl(185 55% 65%)" />
              <rect x="6" y="21" width="17" height="3" rx="1.5" fill="white" opacity="0.7" />
              <circle cx="25" cy="23" r="4" fill="hsl(185 55% 45%)" />
              <path d="M23 23l1.5 1.5L27 21.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          {!collapsed && (
            <div>
              <p className="text-sm font-bold text-foreground leading-tight">FO Daily Notes</p>
              <p className="text-xs text-muted-foreground leading-tight">Notes Organizer</p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 flex flex-col gap-1 px-2">
          {fullNav.map(({ href, icon: Icon, label }) => {
            const active = location === href;
            return (
              <Link key={href} href={href}>
                <a
                  data-testid={`nav-${label.toLowerCase().replace(/\s/g, "-")}`}
                  className={cn(
                    "flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    collapsed && "justify-center px-0"
                  )}
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
          <div className="mx-2 mb-2 p-2 rounded-md bg-muted/60 border border-border">
            <div className="flex items-center gap-1.5 mb-1">
              <Shield size={11} className="text-primary" />
              <span className="text-xs font-semibold text-primary">Compliance</span>
            </div>
            <p className="text-xs text-muted-foreground leading-snug">R380-80 · R380-600<br />EVV · DSPD SAS</p>
          </div>
        )}

        {/* User info + logout */}
        {currentUser && (
          <div className={cn(
            "mx-2 mb-1 rounded-md border border-border bg-muted/40 overflow-hidden",
            collapsed ? "p-1" : "p-2"
          )}>
            {!collapsed ? (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <User size={11} className="text-muted-foreground" />
                  <span className="text-xs font-semibold text-foreground truncate">{currentUser.username}</span>
                  <span className="ml-auto text-[9px] uppercase tracking-wide font-semibold text-primary/70">
                    {currentUser.role}
                  </span>
                </div>
                <button
                  onClick={onLogout}
                  className="w-full flex items-center gap-1.5 text-xs text-muted-foreground hover:text-red-500 transition-colors"
                >
                  <LogOut size={11} />
                  Sign out
                </button>
              </div>
            ) : (
              <button
                onClick={onLogout}
                title="Sign out"
                className="flex items-center justify-center w-full p-1 text-muted-foreground hover:text-red-500 transition-colors"
              >
                <LogOut size={14} />
              </button>
            )}
          </div>
        )}

        {/* Bottom controls */}
        <div className={cn("p-2 border-t border-border flex", collapsed ? "flex-col gap-1" : "items-center justify-between")}>
          <Button variant="ghost" size="icon" onClick={toggleDark} data-testid="btn-toggle-dark" className="h-8 w-8">
            {dark ? <Sun size={15} /> : <Moon size={15} />}
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setCollapsed((c) => !c)} data-testid="btn-toggle-sidebar" className="h-8 w-8">
            {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto p-6">
        {children}
      </main>
    </div>
  );
}
