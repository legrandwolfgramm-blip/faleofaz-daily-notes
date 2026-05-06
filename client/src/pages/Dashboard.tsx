import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { FileText, AlertTriangle, Users, ClipboardCheck, Car, Upload, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Entry, Person } from "@shared/schema";
import { format } from "date-fns";

/* ─── Stat card with soft sage-tinted icon bg ─────────────────────────── */
function StatCard({
  title,
  value,
  icon: Icon,
  iconBg,
  iconColor,
}: {
  title: string;
  value: string | number;
  icon: any;
  iconBg: string;
  iconColor: string;
}) {
  return (
    <Card className="card-lift border">
      <CardContent className="p-4 flex items-center gap-3">
        <div
          className="p-2.5 rounded-xl shrink-0"
          style={{ background: iconBg }}
        >
          <Icon size={17} style={{ color: iconColor }} />
        </div>
        <div>
          <p className="text-xs text-muted-foreground font-medium leading-tight">{title}</p>
          <p
            className="text-xl font-bold leading-tight mt-0.5"
            data-testid={`stat-${title.toLowerCase().replace(/\s+/g, "-")}`}
          >
            {value}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { data: entries = [], isLoading } = useQuery<Entry[]>({ queryKey: ["/api/entries"] });
  const { data: persons = [] } = useQuery<Person[]>({ queryKey: ["/api/persons"] });

  const today = format(new Date(), "yyyy-MM-dd");
  const todayEntries = entries.filter((e) => e.date === today);
  const allIncidents = entries.flatMap((e) => {
    try { return JSON.parse(e.incidentsJson) as any[]; } catch { return []; }
  });
  const criticalCount = allIncidents.filter((i) => i.isCritical).length;
  const recentEntries = entries.slice(0, 8);

  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          {/* FaleOfaz wordmark in header */}
          <div className="flex items-center gap-2 mb-1">
            {/* Inline logo mark */}
            <svg width="26" height="26" viewBox="0 0 34 34" fill="none" aria-hidden="true">
              <rect width="34" height="34" rx="8" fill="hsl(152 32% 36%)" />
              <rect x="7" y="8" width="20" height="3" rx="1.5" fill="white" />
              <rect x="7" y="13.5" width="14" height="3" rx="1.5" fill="hsl(152 60% 82%)" />
              <rect x="7" y="19" width="17" height="3" rx="1.5" fill="white" opacity="0.75" />
              <circle cx="26" cy="25.5" r="5" fill="hsl(152 45% 28%)" />
              <path
                d="M23.5 25.5 L25.2 27.2 L28.5 23.8"
                stroke="hsl(152 55% 82%)"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <h1 className="text-xl font-bold text-foreground tracking-tight">
              FO Daily Notes Organizer
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Utah DSPD · DHHS R380-80/R380-600 · Compliance Team
          </p>
        </div>
        <Link href="/entry/import">
          <Button
            data-testid="btn-upload"
            className="gap-1.5 shrink-0"
            style={{ background: "hsl(152 32% 36%)", color: "white" }}
          >
            <Upload size={15} /> Upload & Organize
          </Button>
        </Link>
      </div>

      {/* ── Stats ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          title="Today's Entries"
          value={todayEntries.length}
          icon={ClipboardCheck}
          iconBg="hsl(152 32% 36% / 0.12)"
          iconColor="hsl(152 32% 36%)"
        />
        <StatCard
          title="Total Entries"
          value={entries.length}
          icon={FileText}
          iconBg="hsl(36 60% 48% / 0.12)"
          iconColor="hsl(36 60% 38%)"
        />
        <StatCard
          title="Active Persons"
          value={persons.length}
          icon={Users}
          iconBg="hsl(255 38% 52% / 0.12)"
          iconColor="hsl(255 38% 44%)"
        />
        <StatCard
          title="Critical Incidents"
          value={criticalCount}
          icon={AlertTriangle}
          iconBg={criticalCount > 0 ? "hsl(4 72% 50% / 0.12)" : "hsl(152 32% 36% / 0.10)"}
          iconColor={criticalCount > 0 ? "hsl(4 72% 44%)" : "hsl(152 32% 36%)"}
        />
      </div>

      {/* ── Recent Entries ───────────────────────────────────────────── */}
      <Card className="card-lift">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">Recent Entries</CardTitle>
            <Link href="/reports">
              <Button variant="outline" size="sm" className="text-xs gap-1 h-7">
                <FileText size={13} /> View Reports
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10 w-full rounded-lg" />
              ))}
            </div>
          ) : recentEntries.length === 0 ? (
            <div className="py-12 text-center">
              {/* Empty state with logo */}
              <div className="mx-auto mb-4 flex items-center justify-center w-14 h-14 rounded-2xl" style={{ background: "hsl(152 32% 36% / 0.10)" }}>
                <svg width="28" height="28" viewBox="0 0 34 34" fill="none" aria-hidden="true">
                  <rect width="34" height="34" rx="8" fill="hsl(152 32% 36% / 0.20)" />
                  <rect x="7" y="8" width="20" height="3" rx="1.5" fill="hsl(152 32% 36%)" />
                  <rect x="7" y="13.5" width="14" height="3" rx="1.5" fill="hsl(152 32% 36% / 0.5)" />
                  <rect x="7" y="19" width="17" height="3" rx="1.5" fill="hsl(152 32% 36% / 0.3)" />
                </svg>
              </div>
              <p className="text-sm text-muted-foreground font-medium">No entries yet</p>
              <p className="text-xs text-muted-foreground mt-1 mb-4">Upload a raw data file to get started</p>
              <Link href="/entry/import">
                <Button
                  size="sm"
                  className="gap-1.5 text-xs"
                  style={{ background: "hsl(152 32% 36%)", color: "white" }}
                >
                  <Upload size={14} /> Upload & Organize
                </Button>
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {recentEntries.map((entry) => {
                const incidents = (() => { try { return JSON.parse(entry.incidentsJson); } catch { return []; } })();
                const trips = (() => { try { return JSON.parse(entry.tripsJson); } catch { return []; } })();
                const codes = (() => { try { return JSON.parse(entry.serviceCodesJson); } catch { return []; } })();
                const hasCritical = incidents.some((i: any) => i.isCritical);
                return (
                  <Link key={entry.id} href={`/entry/${entry.id}`}>
                    <a
                      data-testid={`entry-row-${entry.id}`}
                      className="flex items-center gap-3 px-4 py-3 transition-colors cursor-pointer"
                      style={{ transition: "background 0.15s" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "hsl(152 32% 36% / 0.05)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold mono" style={{ color: "hsl(152 32% 32%)" }}>
                            {entry.personPid}
                          </span>
                          <span className="text-xs text-muted-foreground">{entry.date}</span>
                          <span className="text-xs text-muted-foreground">· {entry.shiftType}</span>
                          <span className="text-xs text-muted-foreground">· {entry.staffName}</span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          {codes.slice(0, 3).map((c: string) => (
                            <span key={c} className="badge-info rounded-md px-1.5 py-0.5 text-xs font-medium">{c}</span>
                          ))}
                          {trips.length > 0 && (
                            <span className="badge-mtp rounded-md px-1.5 py-0.5 text-xs font-medium">
                              <Car size={10} className="inline mr-0.5" />MTP ×{trips.length}
                            </span>
                          )}
                          {hasCritical && (
                            <span className="badge-critical rounded-md px-1.5 py-0.5 text-xs font-medium">
                              <AlertTriangle size={10} className="inline mr-0.5" />Critical IR
                            </span>
                          )}
                          {incidents.length > 0 && !hasCritical && (
                            <span className="badge-warning rounded-md px-1.5 py-0.5 text-xs font-medium">
                              IR ×{incidents.length}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {entry.shiftStart}–{entry.shiftEnd}
                      </span>
                    </a>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Compliance Reminder ──────────────────────────────────────── */}
      <Card
        className="card-lift"
        style={{
          borderLeft: "3px solid hsl(152 32% 36%)",
          background: "hsl(152 32% 36% / 0.04)",
        }}
      >
        <CardContent className="p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <Shield size={13} style={{ color: "hsl(152 32% 36%)" }} />
            <p className="text-xs font-semibold" style={{ color: "hsl(152 32% 32%)" }}>
              Compliance Reminders — R380-600 / R380-80
            </p>
          </div>
          <ul className="text-xs text-muted-foreground space-y-0.5 ml-4">
            <li>• Critical incidents must be reported to OL within <strong>1 business day</strong></li>
            <li>• Legal guardians must be notified within <strong>24 hours</strong> of a critical incident</li>
            <li>• Trip logs require: driver name, Person PID, date, pick-up/drop-off times and locations, mileage</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
