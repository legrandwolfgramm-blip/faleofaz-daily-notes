import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { FileText, AlertTriangle, Users, ClipboardCheck, Car, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { Entry, Person } from "@shared/schema";
import { format } from "date-fns";

function StatCard({ title, value, icon: Icon, color }: { title: string; value: string | number; icon: any; color: string }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon size={18} className="text-white" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground font-medium">{title}</p>
          <p className="text-xl font-bold text-foreground" data-testid={`stat-${title.toLowerCase().replace(/\s+/g, "-")}`}>{value}</p>
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
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">FO Daily Notes Organizer</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Utah DSPD · DHHS R380-80/R380-600 · Compliance Team</p>
        </div>
        <Link href="/entry/import">
          <Button data-testid="btn-upload" className="gap-1.5">
            <Upload size={16} /> Upload &amp; Organize
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard title="Today's Entries" value={todayEntries.length} icon={ClipboardCheck} color="bg-primary" />
        <StatCard title="Total Entries" value={entries.length} icon={FileText} color="bg-secondary" />
        <StatCard title="Active Persons" value={persons.length} icon={Users} color="bg-violet-600" />
        <StatCard title="Critical Incidents" value={criticalCount} icon={AlertTriangle} color={criticalCount > 0 ? "bg-destructive" : "bg-green-600"} />
      </div>

      {/* Recent Entries */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Recent Entries</CardTitle>
            <Link href="/reports">
              <Button variant="outline" size="sm" className="text-xs gap-1">
                <FileText size={13} /> View Reports
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : recentEntries.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground text-sm">
              <FileText size={32} className="mx-auto mb-2 opacity-30" />
              No entries yet. <Link href="/entry/import"><a className="text-primary underline">Upload raw data to get started.</a></Link>
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
                    <a data-testid={`entry-row-${entry.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors cursor-pointer">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold mono text-primary">{entry.personPid}</span>
                          <span className="text-xs text-muted-foreground">{entry.date}</span>
                          <span className="text-xs text-muted-foreground">· {entry.shiftType}</span>
                          <span className="text-xs text-muted-foreground">· {entry.staffName}</span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          {codes.slice(0, 3).map((c: string) => (
                            <span key={c} className="badge-info rounded px-1.5 py-0.5 text-xs font-medium">{c}</span>
                          ))}
                          {trips.length > 0 && <span className="badge-mtp rounded px-1.5 py-0.5 text-xs font-medium"><Car size={10} className="inline mr-0.5" />MTP ×{trips.length}</span>}
                          {hasCritical && <span className="badge-critical rounded px-1.5 py-0.5 text-xs font-medium"><AlertTriangle size={10} className="inline mr-0.5" />Critical IR</span>}
                          {incidents.length > 0 && !hasCritical && <span className="badge-warning rounded px-1.5 py-0.5 text-xs font-medium">IR ×{incidents.length}</span>}
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">{entry.shiftStart}–{entry.shiftEnd}</span>
                    </a>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Compliance reminder */}
      <Card className="border-l-4 border-l-primary bg-primary/5">
        <CardContent className="p-4">
          <p className="text-xs font-semibold text-primary mb-1">Compliance Reminders (R380-600 / R380-80)</p>
          <ul className="text-xs text-muted-foreground space-y-0.5">
            <li>• Critical incidents must be reported to OL within <strong>1 business day</strong></li>
            <li>• Legal guardians must be notified within <strong>24 hours</strong> of a critical incident</li>
            <li>• EVV records must include: service type, person, date, location, provider, start/end time</li>
            <li>• Trip logs require: driver name, Person PID, date, pick-up/drop-off times and locations, mileage</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
