import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, AlertTriangle, Car, Download, Search } from "lucide-react";
import type { Entry, Trip, Incident } from "@shared/schema";
import { format, parseISO, startOfMonth, endOfMonth } from "date-fns";
import * as XLSX from "xlsx";

function parse<T>(json: string, fallback: T): T {
  try { return JSON.parse(json); } catch { return fallback; }
}
function fmtTime(t: string) {
  if (!t) return "—";
  const [h, m] = t.split(":");
  const hr = parseInt(h);
  return `${hr === 0 ? 12 : hr > 12 ? hr - 12 : hr}:${m} ${hr >= 12 ? "PM" : "AM"}`;
}

export default function Reports() {
  const { data: entries = [], isLoading } = useQuery<Entry[]>({ queryKey: ["/api/entries"] });
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const filtered = entries.filter(e => {
    const matchSearch = !search || e.personPid.toLowerCase().includes(search.toLowerCase()) || e.staffName.toLowerCase().includes(search.toLowerCase());
    const matchFrom = !dateFrom || e.date >= dateFrom;
    const matchTo = !dateTo || e.date <= dateTo;
    return matchSearch && matchFrom && matchTo;
  });

  const allTrips = filtered.flatMap(e => parse<Trip[]>(e.tripsJson, []).map(t => ({ ...t, entry: e })));
  const allIncidents = filtered.flatMap(e => parse<Incident[]>(e.incidentsJson, []).map(i => ({ ...i, entry: e })));
  const criticalIncidents = allIncidents.filter(i => i.isCritical);

  function exportAllExcel() {
    const wb = XLSX.utils.book_new();

    // All entries sheet
    const rows = [
      ["Date", "PID", "Staff", "Shift Type", "Start", "End", "Service Codes", "Mileage", "Incidents", "Critical?"],
      ...filtered.map(e => {
        const codes = parse<string[]>(e.serviceCodesJson, []).join(", ");
        const incs = parse<Incident[]>(e.incidentsJson, []);
        return [e.date, e.personPid, e.staffName, e.shiftType, e.shiftStart, e.shiftEnd, codes, e.totalMileage || 0, incs.length, incs.some(i => i.isCritical) ? "YES" : "No"];
      })
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "All Entries");

    // EVV Trip log
    if (allTrips.length > 0) {
      const tripRows = [
        ["Date", "Person PID", "Driver", "Pick-up Time", "Pick-up Location", "Drop-off Time", "Drop-off Location", "Mileage (mi)", "Service Purpose"],
        ...allTrips.map(t => [t.entry.date, t.entry.personPid, t.driverName || t.entry.staffName, t.pickupTime, t.pickupLocation, t.dropoffTime, t.dropoffLocation, t.mileage || 0, t.purpose || "Routine transport"]),
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(tripRows), "EVV Trip Log");
    }

    // All incidents
    if (allIncidents.length > 0) {
      const incRows = [
        ["Date", "Person PID", "Staff", "Type", "Time", "Description", "Actions Taken", "Involved Entities", "Critical IR", "IR Submitted", "Guardian Notified"],
        ...allIncidents.map(i => [i.entry.date, i.entry.personPid, i.entry.staffName, i.type, i.timeOfIncident || "", i.description, i.actionsTaken || "", i.involvedEntities || "", i.isCritical ? "YES" : "No", i.irSubmitted ? "Yes" : "No", i.notifiedGuardian ? "Yes" : "No"]),
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(incRows), "All Incidents");
    }

    const range = dateFrom && dateTo ? `_${dateFrom}_to_${dateTo}` : "";
    XLSX.writeFile(wb, `FaleOfaz_Reports${range}.xlsx`);
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">Reports & Export</h1>
          <p className="text-sm text-muted-foreground">Filter and export entries, trip logs, and incident reports</p>
        </div>
        <Button onClick={exportAllExcel} className="gap-1.5" data-testid="btn-export-all">
          <Download size={15} /> Export All to Excel
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 flex flex-wrap gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-40">
            <Search size={14} className="text-muted-foreground shrink-0" />
            <Input placeholder="Search by PID or staff..." value={search} onChange={e => setSearch(e.target.value)} className="h-8 text-sm" data-testid="input-search" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground whitespace-nowrap">From:</label>
            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-8 text-sm w-36" data-testid="input-date-from" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground whitespace-nowrap">To:</label>
            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-8 text-sm w-36" data-testid="input-date-to" />
          </div>
          <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setDateFrom(""); setDateTo(""); }}>Clear</Button>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        {[
          ["Entries", filtered.length, "text-primary"],
          ["Trips", allTrips.length, "text-violet-600"],
          ["All Incidents", allIncidents.length, "text-yellow-600"],
          ["Critical IRs", criticalIncidents.length, criticalIncidents.length > 0 ? "text-destructive" : "text-green-600"],
        ].map(([label, val, color]) => (
          <Card key={label as string}>
            <CardContent className="p-3">
              <p className="text-muted-foreground">{label as string}</p>
              <p className={`text-2xl font-bold ${color as string}`} data-testid={`report-stat-${(label as string).toLowerCase().replace(/\s+/g, "-")}`}>{val as number}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Critical incidents alert */}
      {criticalIncidents.length > 0 && (
        <Card className="border-l-4 border-l-destructive bg-destructive/5">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm text-destructive flex items-center gap-1.5">
              <AlertTriangle size={14} /> {criticalIncidents.length} Critical Incident(s) — Review Required
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 space-y-1">
            {criticalIncidents.map((inc, i) => (
              <div key={i} className="text-xs flex items-start gap-2">
                <span className="text-destructive font-bold shrink-0">•</span>
                <span>
                  <Link href={`/entry/${inc.entry.id}`}><a className="text-primary underline">{inc.entry.date}</a></Link>
                  {" "}· PID: <span className="mono">{inc.entry.personPid}</span> · {inc.type}
                  {!inc.irSubmitted && <span className="text-destructive font-semibold ml-2">⚠ IR NOT SUBMITTED</span>}
                  {!inc.notifiedGuardian && <span className="text-destructive font-semibold ml-1">· Guardian not notified</span>}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Entry list */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">All Entries ({filtered.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 text-sm text-muted-foreground">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">No entries match your filters.</div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map(entry => {
                const incs = parse<Incident[]>(entry.incidentsJson, []);
                const trips = parse<Trip[]>(entry.tripsJson, []);
                const codes = parse<string[]>(entry.serviceCodesJson, []);
                const hasCritical = incs.some(i => i.isCritical);
                return (
                  <Link key={entry.id} href={`/entry/${entry.id}`}>
                    <a data-testid={`report-row-${entry.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors cursor-pointer">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="mono text-sm font-semibold text-primary">{entry.personPid}</span>
                          <span className="text-xs text-muted-foreground">{entry.date}</span>
                          <span className="text-xs text-muted-foreground">· {entry.shiftType}</span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap text-xs">
                          <span className="text-muted-foreground">{entry.staffName}</span>
                          {codes.slice(0, 3).map(c => <span key={c} className="badge-info rounded px-1 py-0.5">{c}</span>)}
                          {trips.length > 0 && <span className="badge-mtp rounded px-1 py-0.5"><Car size={9} className="inline mr-0.5" />{trips.length} trip{trips.length > 1 ? "s" : ""}</span>}
                          {hasCritical && <span className="badge-critical rounded px-1 py-0.5 font-semibold"><AlertTriangle size={9} className="inline mr-0.5" />Critical IR</span>}
                          {incs.length > 0 && !hasCritical && <span className="badge-warning rounded px-1 py-0.5">{incs.length} incident{incs.length > 1 ? "s" : ""}</span>}
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">{entry.totalMileage ? `${entry.totalMileage.toFixed(1)} mi` : ""}</span>
                    </a>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* EVV Trip Log table */}
      {allTrips.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5"><Car size={14} /> EVV Trip Log ({allTrips.length} trips)</CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/60">
                <tr>
                  {["Date", "PID", "Driver", "Pick-up", "Pick-up Loc.", "Drop-off", "Drop-off Loc.", "Miles"].map(h => (
                    <th key={h} className="text-left px-3 py-2 font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {allTrips.map((trip, i) => (
                  <tr key={i} className="hover:bg-muted/30">
                    <td className="px-3 py-2">{trip.entry.date}</td>
                    <td className="px-3 py-2 mono font-medium text-primary">{trip.entry.personPid}</td>
                    <td className="px-3 py-2">{trip.driverName || trip.entry.staffName}</td>
                    <td className="px-3 py-2 font-medium">{fmtTime(trip.pickupTime)}</td>
                    <td className="px-3 py-2">{trip.pickupLocation}</td>
                    <td className="px-3 py-2 font-medium">{fmtTime(trip.dropoffTime)}</td>
                    <td className="px-3 py-2">{trip.dropoffLocation}</td>
                    <td className="px-3 py-2">{trip.mileage || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
