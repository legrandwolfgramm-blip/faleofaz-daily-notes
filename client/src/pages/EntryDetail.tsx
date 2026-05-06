import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { useState, useRef } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Download, FileSpreadsheet, Printer, AlertTriangle, Car, CheckCircle, XCircle } from "lucide-react";
import type { Entry, Activity, Trip, Incident } from "@shared/schema";
import { format, parseISO } from "date-fns";
import * as XLSX from "xlsx";

function parse<T>(json: string, fallback: T): T {
  try { return JSON.parse(json); } catch { return fallback; }
}

function fmtTime(t: string) {
  if (!t) return "—";
  const [h, m] = t.split(":");
  const hr = parseInt(h);
  const ampm = hr >= 12 ? "PM" : "AM";
  return `${hr === 0 ? 12 : hr > 12 ? hr - 12 : hr}:${m} ${ampm}`;
}

function fmtDate(d: string) {
  try { return format(parseISO(d), "MMMM d, yyyy"); } catch { return d; }
}

// ─── Daily Report View ────────────────────────────────────────────────────────
function DailyReport({ entry }: { entry: Entry }) {
  const activities: Activity[] = parse(entry.activitiesJson, []);
  const trips: Trip[] = parse(entry.tripsJson, []);
  const incidents: Incident[] = parse(entry.incidentsJson, []);
  const codes: string[] = parse(entry.serviceCodesJson, []);
  const criticalIncidents = incidents.filter(i => i.isCritical);

  return (
    <div className="report-page bg-card border border-border rounded-lg p-6 space-y-5 text-sm font-sans print:shadow-none" id="daily-report">
      {/* Header */}
      <div className="border-b-2 border-primary pb-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">FaleOfaz · Utah DSPD SAS Daily Report</p>
            <h2 className="text-lg font-bold text-foreground mt-0.5">Daily Service Entry Report</h2>
          </div>
          <div className="text-right text-xs text-muted-foreground space-y-0.5">
            <p>R380-80 Compliant</p>
            <p>R380-600 Compliant</p>
            <p>EVV Ready</p>
          </div>
        </div>
      </div>

      {/* Identification block */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          ["Person PID", <span className="mono font-bold text-primary">{entry.personPid}</span>],
          ["Date", fmtDate(entry.date)],
          ["Shift Type", entry.shiftType],
          ["Staff", entry.staffName],
          ["Shift Start", fmtTime(entry.shiftStart)],
          ["Shift End", fmtTime(entry.shiftEnd)],
          ["Service Codes", codes.join(", ") || "—"],
          ["Mileage", entry.totalMileage ? `${entry.totalMileage.toFixed(1)} mi` : "—"],
        ].map(([label, val], i) => (
          <div key={i} className="bg-muted/40 rounded-md p-2.5">
            <p className="text-xs text-muted-foreground font-medium">{label}</p>
            <p className="text-sm font-semibold text-foreground mt-0.5">{val as any}</p>
          </div>
        ))}
      </div>

      {/* Critical incident banner */}
      {criticalIncidents.length > 0 && (
        <div className="rounded-lg border-2 border-destructive bg-destructive/8 p-3">
          <p className="text-xs font-bold text-destructive flex items-center gap-1.5">
            <AlertTriangle size={13} /> CRITICAL INCIDENT(S) — R380-600 Reporting Required
          </p>
          <ul className="text-xs text-destructive/80 mt-1 space-y-0.5">
            {criticalIncidents.map((inc, i) => (
              <li key={i}>• {inc.type}: {inc.description.slice(0, 100)}{inc.description.length > 100 ? "..." : ""}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Activities */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Activities</p>
        {activities.length === 0 ? <p className="text-muted-foreground italic text-xs">No activities recorded.</p> : (
          <div className="space-y-1">
            {activities.map((act, i) => (
              <div key={i} className="flex gap-3 items-baseline">
                <span className="text-xs text-muted-foreground w-16 shrink-0 font-medium mono">{act.time ? fmtTime(act.time) : ""}</span>
                <span className="text-sm text-foreground">{act.description}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Behavior summary */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Behavior Summary</p>
        <p className="text-sm text-foreground leading-relaxed bg-muted/30 rounded-md p-3">
          {entry.behaviorSummary || <span className="italic text-muted-foreground">No behavior summary recorded.</span>}
        </p>
      </div>

      {/* Medications */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Medications</p>
        <div className="flex gap-4 text-sm">
          <span className="flex items-center gap-1.5">
            {entry.medsGiven ? <CheckCircle size={14} className="text-green-600" /> : <XCircle size={14} className="text-muted-foreground" />}
            Medications given
          </span>
          {entry.medsGiven && (
            <span className="flex items-center gap-1.5">
              {entry.marsCompleted ? <CheckCircle size={14} className="text-green-600" /> : <XCircle size={14} className="text-destructive" />}
              MARS completed
            </span>
          )}
        </div>
        {entry.medsNotes && <p className="text-xs text-muted-foreground mt-1">{entry.medsNotes}</p>}
      </div>

      {/* Trips */}
      {trips.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">MTP Transportation Log</p>
          <div className="space-y-2">
            {trips.map((trip, i) => (
              <div key={i} className="rounded-md border border-border bg-muted/20 p-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                <div><span className="text-muted-foreground">Driver</span><p className="font-medium">{trip.driverName || entry.staffName}</p></div>
                <div><span className="text-muted-foreground">Pick-up</span><p className="font-medium">{fmtTime(trip.pickupTime)} — {trip.pickupLocation}</p></div>
                <div><span className="text-muted-foreground">Drop-off</span><p className="font-medium">{fmtTime(trip.dropoffTime)} — {trip.dropoffLocation}</p></div>
                <div><span className="text-muted-foreground">Mileage</span><p className="font-medium">{trip.mileage || 0} mi</p></div>
                {trip.vehicleIssue && <div className="col-span-4 text-destructive">Issue: {trip.vehicleIssue}</div>}
                {trip.purpose && trip.purpose !== "Day Program transport" && <div className="col-span-4 text-muted-foreground">Notes: {trip.purpose}</div>}
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Total mileage this entry: <strong>{entry.totalMileage?.toFixed(1) || 0} mi</strong></p>
        </div>
      )}

      {/* Incidents */}
      {incidents.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Incident Reports</p>
          <div className="space-y-3">
            {incidents.map((inc, i) => (
              <div key={i} className={`rounded-md border p-3 text-xs space-y-1.5 ${inc.isCritical ? "border-destructive/50 bg-destructive/5" : "border-border bg-muted/20"}`}>
                <div className="flex items-center gap-2">
                  <span className={`font-bold ${inc.isCritical ? "text-destructive" : "text-warning"}`}>
                    {inc.isCritical ? "⚠ CRITICAL: " : "Incident: "}{inc.type}
                  </span>
                  {inc.timeOfIncident && <span className="text-muted-foreground">at {fmtTime(inc.timeOfIncident)}</span>}
                </div>
                <p><span className="text-muted-foreground">Description: </span>{inc.description}</p>
                {inc.actionsTaken && <p><span className="text-muted-foreground">Actions taken: </span>{inc.actionsTaken}</p>}
                {inc.involvedEntities && <p><span className="text-muted-foreground">Involved entities: </span>{inc.involvedEntities}</p>}
                <div className="flex gap-3 flex-wrap pt-0.5">
                  <span className={inc.irSubmitted ? "text-green-600" : "text-muted-foreground"}>
                    {inc.irSubmitted ? "✓" : "○"} IR Submitted
                  </span>
                  <span className={inc.notifiedGuardian ? "text-green-600" : "text-muted-foreground"}>
                    {inc.notifiedGuardian ? "✓" : "○"} Guardian Notified
                  </span>
                  <span className={inc.notifiedSupervisor ? "text-green-600" : "text-muted-foreground"}>
                    {inc.notifiedSupervisor ? "✓" : "○"} Supervisor Notified
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="border-t border-border pt-3 text-xs text-muted-foreground flex items-center justify-between">
        <span>Organized by FO Daily Notes Organizer</span>
        <span>DHHS R380-80 / R380-600 · EVV Compliant</span>
      </div>
    </div>
  );
}

// ─── Critical Incident Notification ──────────────────────────────────────────
function CriticalIncidentNotification({ entry }: { entry: Entry }) {
  const incidents: Incident[] = parse(entry.incidentsJson, []);
  const criticals = incidents.filter(i => i.isCritical);

  if (criticals.length === 0) {
    return (
      <div className="bg-muted/40 rounded-lg p-8 text-center text-muted-foreground">
        <CheckCircle size={28} className="mx-auto mb-2 text-green-600 opacity-60" />
        <p className="text-sm font-medium">No critical incidents in this entry.</p>
        <p className="text-xs mt-1">Critical incident notifications are only generated when a critical IR is logged.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4" id="critical-incident-report">
      {criticals.map((inc, i) => (
        <div key={i} className="bg-card border-2 border-destructive rounded-lg p-6 space-y-4 text-sm">
          <div className="border-b-2 border-destructive pb-3">
            <p className="text-xs text-destructive font-medium uppercase tracking-wide">FaleOfaz · Critical Incident Notification</p>
            <h2 className="text-base font-bold text-foreground mt-0.5">CRITICAL INCIDENT REPORT — R380-600</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Utah DHHS Office of Licensing (OL) — Submit within 1 business day</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              ["Provider", "FaleOfaz"],
              ["Person PID", entry.personPid],
              ["Staff Involved", entry.staffName],
              ["Date of Incident", fmtDate(entry.date)],
              ["Time of Incident", inc.timeOfIncident ? fmtTime(inc.timeOfIncident) : "See description"],
              ["Date Discovered", fmtDate(entry.date)],
              ["Incident Type", inc.type],
              ["Report Date", fmtDate(new Date().toISOString().split("T")[0])],
            ].map(([label, val]) => (
              <div key={label} className="bg-muted/40 rounded p-2">
                <p className="text-xs text-muted-foreground font-medium">{label}</p>
                <p className="text-sm font-semibold">{val}</p>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Descriptive Summary of Incident</p>
            <div className="bg-muted/30 rounded p-3 text-sm">{inc.description}</div>
          </div>

          {inc.actionsTaken && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Actions Taken / Actions Planned</p>
              <div className="bg-muted/30 rounded p-3 text-sm">{inc.actionsTaken}</div>
            </div>
          )}

          {inc.involvedEntities && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Involved Entities</p>
              <div className="bg-muted/30 rounded p-3 text-sm">{inc.involvedEntities}</div>
            </div>
          )}

          <div className="rounded border border-border p-3 text-xs space-y-1">
            <p className="font-semibold text-foreground mb-1">Compliance Checklist (R380-600-7(16))</p>
            {[
              [inc.irSubmitted, "Incident report submitted to OL within 1 business day"],
              [inc.notifiedGuardian, "Legal guardian notified within 24 hours of incident"],
              [inc.notifiedSupervisor, "Supervisor/leadership notified"],
              [false, "Witness statements collected and maintained"],
              [false, "OL Provider Portal submission completed"],
            ].map(([done, label]) => (
              <p key={label as string} className={done ? "text-green-600" : "text-muted-foreground"}>
                {done ? "☑" : "☐"} {label as string}
              </p>
            ))}
          </div>

          <div className="border-t pt-2 text-xs text-muted-foreground">
            <p>Contact OL: (801) 538-4242 · hslic.utah.gov</p>
            <p>R380-600 Interpretation Manual: Subsections 380-600-2(11) and 380-600-7(16)</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Leadership Summary ───────────────────────────────────────────────────────
function LeadershipSummary({ entry }: { entry: Entry }) {
  const activities: Activity[] = parse(entry.activitiesJson, []);
  const trips: Trip[] = parse(entry.tripsJson, []);
  const incidents: Incident[] = parse(entry.incidentsJson, []);
  const codes: string[] = parse(entry.serviceCodesJson, []);
  const criticals = incidents.filter(i => i.isCritical);

  return (
    <div className="bg-card border border-border rounded-lg p-6 space-y-4 text-sm" id="leadership-summary">
      <div className="border-b pb-3">
        <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">FaleOfaz · Leadership Summary</p>
        <h2 className="text-base font-bold">Daily Service Summary</h2>
        <p className="text-xs text-muted-foreground">{fmtDate(entry.date)} · {entry.shiftType} · {entry.personPid}</p>
      </div>

      {criticals.length > 0 && (
        <div className="rounded border-2 border-destructive bg-destructive/5 p-3">
          <p className="text-xs font-bold text-destructive">🚨 {criticals.length} CRITICAL INCIDENT(S) — ACTION REQUIRED</p>
          {criticals.map((inc, i) => (
            <p key={i} className="text-xs text-destructive/80 mt-0.5">• {inc.type}: {inc.description.slice(0, 80)}...</p>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div><span className="text-muted-foreground">Staff:</span> <strong>{entry.staffName}</strong></div>
        <div><span className="text-muted-foreground">Shift:</span> <strong>{fmtTime(entry.shiftStart)} – {fmtTime(entry.shiftEnd)}</strong></div>
        <div><span className="text-muted-foreground">Services:</span> <strong>{codes.join(", ") || "—"}</strong></div>
        <div><span className="text-muted-foreground">Mileage:</span> <strong>{entry.totalMileage?.toFixed(1) || 0} mi</strong></div>
        <div><span className="text-muted-foreground">Trips:</span> <strong>{trips.length}</strong></div>
        <div><span className="text-muted-foreground">Incidents:</span> <strong>{incidents.length} ({criticals.length} critical)</strong></div>
        <div><span className="text-muted-foreground">Meds given:</span> <strong>{entry.medsGiven ? "Yes" : "No"}</strong></div>
        <div><span className="text-muted-foreground">MARS:</span> <strong>{entry.marsCompleted ? "Completed" : entry.medsGiven ? "NOT completed" : "N/A"}</strong></div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">Activities</p>
        <p className="text-xs">{activities.map(a => a.description).filter(Boolean).join(" → ") || "None recorded"}</p>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">Behavior Overview</p>
        <p className="text-xs text-foreground">{entry.behaviorSummary || "No behavior summary."}</p>
      </div>

      {incidents.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">Incidents Summary</p>
          {incidents.map((inc, i) => (
            <div key={i} className={`text-xs p-2 rounded mb-1 ${inc.isCritical ? "bg-destructive/10 text-destructive" : "bg-muted/40"}`}>
              <strong>{inc.isCritical ? "⚠ CRITICAL" : "IR"}:</strong> {inc.type} — IR submitted: {inc.irSubmitted ? "Yes" : "No"} · Guardian notified: {inc.notifiedGuardian ? "Yes" : "No"}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── EVV Trip Log ─────────────────────────────────────────────────────────────
function EvvTripLog({ entry }: { entry: Entry }) {
  const trips: Trip[] = parse(entry.tripsJson, []);
  const codes: string[] = parse(entry.serviceCodesJson, []);

  if (trips.length === 0) {
    return (
      <div className="bg-muted/40 rounded-lg p-8 text-center text-muted-foreground">
        <Car size={28} className="mx-auto mb-2 opacity-30" />
        <p className="text-sm font-medium">No trips logged in this entry.</p>
        <p className="text-xs mt-1">EVV trip logs are generated from MTP entries.</p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-lg p-6 space-y-4 text-sm" id="evv-trip-log">
      <div className="border-b pb-3">
        <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">FaleOfaz · EVV / MTP Trip Log</p>
        <h2 className="text-base font-bold">Electronic Visit Verification — Trip Record</h2>
        <p className="text-xs text-muted-foreground">21st Century Cures Act · Utah Medicaid EVV Compliant</p>
      </div>

      {/* EVV Header Fields */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs bg-muted/30 rounded p-3">
        {[
          ["Type of Service", codes.join(", ") || "MTP"],
          ["Person PID", entry.personPid],
          ["Date of Service", fmtDate(entry.date)],
          ["Staff / Provider", entry.staffName],
          ["Total Mileage", `${entry.totalMileage?.toFixed(1) || 0} mi`],
          ["Record Created", format(new Date(), "MMM d, yyyy h:mm a")],
        ].map(([label, val]) => (
          <div key={label}>
            <p className="text-muted-foreground">{label}</p>
            <p className="font-semibold">{val}</p>
          </div>
        ))}
      </div>

      {/* Trip table */}
      <table className="w-full text-xs border border-border rounded overflow-hidden">
        <thead className="bg-primary text-primary-foreground">
          <tr>
            <th className="text-left px-3 py-2">#</th>
            <th className="text-left px-3 py-2">Driver</th>
            <th className="text-left px-3 py-2">Pick-up Time</th>
            <th className="text-left px-3 py-2">Pick-up Location</th>
            <th className="text-left px-3 py-2">Drop-off Time</th>
            <th className="text-left px-3 py-2">Drop-off Location</th>
            <th className="text-left px-3 py-2">Mileage</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {trips.map((trip, i) => (
            <tr key={i} className="hover:bg-muted/30">
              <td className="px-3 py-2">{i + 1}</td>
              <td className="px-3 py-2">{trip.driverName || entry.staffName}</td>
              <td className="px-3 py-2 font-medium">{fmtTime(trip.pickupTime)}</td>
              <td className="px-3 py-2">{trip.pickupLocation}</td>
              <td className="px-3 py-2 font-medium">{fmtTime(trip.dropoffTime)}</td>
              <td className="px-3 py-2">{trip.dropoffLocation}</td>
              <td className="px-3 py-2">{trip.mileage || 0} mi</td>
            </tr>
          ))}
          <tr className="bg-muted/40 font-semibold">
            <td colSpan={6} className="px-3 py-2 text-right">Total Mileage:</td>
            <td className="px-3 py-2">{entry.totalMileage?.toFixed(1) || 0} mi</td>
          </tr>
        </tbody>
      </table>

      {/* EVV Compliance fields */}
      <div className="rounded border border-border p-3 text-xs space-y-1">
        <p className="font-semibold text-foreground mb-1">EVV Required Data Elements (21st Century Cures Act)</p>
        {[
          ["✓ Type of service performed", codes.join(", ") || "MTP"],
          ["✓ Individual receiving service", `PID: ${entry.personPid}`],
          ["✓ Date of service", fmtDate(entry.date)],
          ["✓ Location of service delivery", trips[0]?.pickupLocation || "See trip log"],
          ["✓ Individual providing service", entry.staffName],
          ["✓ Time service begins", fmtTime(trips[0]?.pickupTime || entry.shiftStart)],
          ["✓ Time service ends", fmtTime(trips[trips.length - 1]?.dropoffTime || entry.shiftEnd)],
          ["✓ Date of record creation", format(new Date(), "MMM d, yyyy")],
        ].map(([field, value]) => (
          <p key={field as string} className="flex gap-2">
            <span className="text-green-600 shrink-0">{(field as string).slice(0, 1)}</span>
            <span className="text-muted-foreground">{(field as string).slice(2)}: </span>
            <span className="font-medium">{value as string}</span>
          </p>
        ))}
      </div>

      <div className="border-t pt-2 text-xs text-muted-foreground">
        Staff Signature: _________________________ &nbsp; Date: ____________
      </div>
    </div>
  );
}

// ─── DSP Cheat Sheet ──────────────────────────────────────────────────────────
function CheatSheet({ entry }: { entry: Entry }) {
  return (
    <div className="bg-card border border-border rounded-lg p-6 text-sm" id="cheat-sheet">
      <div className="border-b pb-3 mb-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">FaleOfaz · DSP Reference</p>
        <h2 className="text-base font-bold">DSP Note Cheat Sheet</h2>
        <p className="text-xs text-muted-foreground">Staff quick-reference for compliant DSPD/DHHS documentation</p>
      </div>

      <div className="grid md:grid-cols-2 gap-5 text-xs">
        <div className="space-y-3">
          <div>
            <p className="font-semibold text-foreground mb-1 text-sm">Every note must include:</p>
            <ul className="space-y-0.5 text-muted-foreground">
              <li>☐ Client PID (not full name)</li>
              <li>☐ Your full staff name</li>
              <li>☐ Shift type and start/end date-time</li>
              <li>☐ Activities in time order</li>
              <li>☐ Behavior summary (3rd person, past tense)</li>
              <li>☐ Medications given + MARS status</li>
              <li>☐ Any incidents (real ones only)</li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-foreground mb-1">Behavior note — write it right:</p>
            <div className="space-y-1">
              <p className="text-green-700 dark:text-green-400">✅ "Client was calm and participated in scheduled activities with staff support. Client needed one reminder to transition from leisure time to lunch, then followed direction."</p>
              <p className="text-destructive">❌ "He was non-compliant." / "She was attention-seeking."</p>
              <p className="text-destructive">❌ First person (I, we, my) or other clients' names</p>
              <p className="text-destructive">❌ PII: SSN, DOB, Medicaid ID, address, phone</p>
            </div>
          </div>
        </div>
        <div className="space-y-3">
          <div>
            <p className="font-semibold text-foreground mb-1">MTP Transportation (routine):</p>
            <ul className="text-muted-foreground space-y-0.5">
              <li>• Only pick-up + drop-off times and locations</li>
              <li>• Typical: 8:45am pickup, 3:00pm drop-off</li>
              <li>• Add detail ONLY if transport problem occurred</li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-foreground mb-1">Incident reporting threshold:</p>
            <ul className="text-muted-foreground space-y-0.5">
              <li>• Fall with injury · ER/urgent care visit</li>
              <li>• Medication error · Abuse allegation</li>
              <li>• Elopement · Restraint · Law enforcement</li>
              <li>• Missing client · Significant medical emergency</li>
            </ul>
          </div>
          <div className="bg-destructive/8 rounded border border-destructive/30 p-2">
            <p className="font-bold text-destructive text-xs mb-1">Critical Incident Timelines (R380-600):</p>
            <p className="text-destructive/80">• OL report: within <strong>1 business day</strong></p>
            <p className="text-destructive/80">• Guardian notification: within <strong>24 hours</strong></p>
            <p className="text-destructive/80">• Division notification: <strong>immediately</strong> (if DHHS contract)</p>
            <p className="text-destructive/80">• OL Phone: (801) 538-4242</p>
          </div>
          <div>
            <p className="font-semibold text-foreground mb-1">Common service codes:</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-muted-foreground">
              <p><strong>CO1-3</strong> Community Outings</p>
              <p><strong>DSG</strong> Day Services Group</p>
              <p><strong>DSI</strong> Day Services Individual</p>
              <p><strong>DTP</strong> Day Training Program</p>
              <p><strong>MTP</strong> Medical Transportation</p>
              <p><strong>RHS</strong> Residential Habilitation</p>
              <p><strong>HHS</strong> Home Health Services</p>
              <p><strong>PPS</strong> Personal Preparation Support</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Export helpers ───────────────────────────────────────────────────────────
function exportToExcel(entry: Entry) {
  const activities: Activity[] = parse(entry.activitiesJson, []);
  const trips: Trip[] = parse(entry.tripsJson, []);
  const incidents: Incident[] = parse(entry.incidentsJson, []);
  const codes: string[] = parse(entry.serviceCodesJson, []);

  const wb = XLSX.utils.book_new();

  // Summary sheet
  const summary = [
    ["FaleOfaz SAS Daily Entry Report"],
    [],
    ["Date", entry.date],
    ["Person PID", entry.personPid],
    ["Staff", entry.staffName],
    ["Shift Type", entry.shiftType],
    ["Shift Start", entry.shiftStart],
    ["Shift End", entry.shiftEnd],
    ["Service Codes", codes.join(", ")],
    ["Total Mileage (mi)", entry.totalMileage || 0],
    ["Medications Given", entry.medsGiven ? "Yes" : "No"],
    ["MARS Completed", entry.marsCompleted ? "Yes" : "No"],
    [],
    ["Behavior Summary"],
    [entry.behaviorSummary || ""],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), "Summary");

  // Activities
  const actRows = [["Time", "Activity"], ...activities.map(a => [a.time, a.description])];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(actRows), "Activities");

  // Trips
  if (trips.length > 0) {
    const tripRows = [
      ["Driver", "Person PID", "Date", "Pick-up Time", "Pick-up Location", "Drop-off Time", "Drop-off Location", "Mileage", "Purpose"],
      ...trips.map(t => [t.driverName || entry.staffName, entry.personPid, entry.date, t.pickupTime, t.pickupLocation, t.dropoffTime, t.dropoffLocation, t.mileage || 0, t.purpose || ""]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(tripRows), "EVV Trip Log");
  }

  // Incidents
  if (incidents.length > 0) {
    const incRows = [
      ["Type", "Date", "Time", "Description", "Actions Taken", "Involved Entities", "Critical", "IR Submitted", "Guardian Notified", "Supervisor Notified"],
      ...incidents.map(i => [i.type, entry.date, i.timeOfIncident || "", i.description, i.actionsTaken || "", i.involvedEntities || "", i.isCritical ? "YES" : "No", i.irSubmitted ? "Yes" : "No", i.notifiedGuardian ? "Yes" : "No", i.notifiedSupervisor ? "Yes" : "No"]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(incRows), "Incident Reports");
  }

  XLSX.writeFile(wb, `FaleOfaz_Entry_${entry.personPid}_${entry.date}.xlsx`);
}

function printSection(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(`
    <html><head>
    <title>FO Daily Notes Report</title>
    <style>
      body { font-family: Inter, sans-serif; font-size: 11pt; color: #1a1a2e; margin: 20px; }
      h2 { font-size: 14pt; } h3 { font-size: 12pt; }
      table { border-collapse: collapse; width: 100%; }
      th, td { border: 1px solid #ccc; padding: 5px 8px; text-align: left; font-size: 10pt; }
      th { background: #1a3a6e; color: white; }
      .badge-critical { color: #c00; font-weight: bold; }
      .text-muted-foreground { color: #666; }
    </style>
    </head><body>${el.innerHTML}</body></html>
  `);
  win.document.close();
  win.print();
}

// ─── Main EntryDetail Page ────────────────────────────────────────────────────
export default function EntryDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: entry, isLoading } = useQuery<Entry>({
    queryKey: ["/api/entries", parseInt(id!)],
    queryFn: async () => {
      const res = await fetch(`/api/entries/${id}`);
      return res.json();
    },
  });

  if (isLoading) return <div className="max-w-3xl mx-auto space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 w-full" /></div>;
  if (!entry) return <div className="text-center py-12 text-muted-foreground">Entry not found.</div>;

  const incidents: Incident[] = parse(entry.incidentsJson, []);
  const hasCritical = incidents.some(i => i.isCritical);

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/">
          <Button variant="ghost" size="sm" className="gap-1.5"><ArrowLeft size={14} /> Back</Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold">Entry Reports</h1>
          <p className="text-xs text-muted-foreground">PID: <span className="mono font-semibold">{entry.personPid}</span> · {entry.date} · {entry.shiftType}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => exportToExcel(entry)} data-testid="btn-export-excel">
            <FileSpreadsheet size={13} /> Excel
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => printSection("daily-report")} data-testid="btn-print-daily">
            <Printer size={13} /> Print Daily
          </Button>
          {hasCritical && (
            <Button variant="destructive" size="sm" className="gap-1.5 text-xs" onClick={() => printSection("critical-incident-report")} data-testid="btn-print-critical">
              <AlertTriangle size={13} /> Print Critical IR
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="daily">
        <TabsList className="grid grid-cols-5 w-full">
          <TabsTrigger value="daily" data-testid="tab-daily">Daily Report</TabsTrigger>
          <TabsTrigger value="leadership" data-testid="tab-leadership">Leadership</TabsTrigger>
          <TabsTrigger value="evv" data-testid="tab-evv">EVV / Trip Log</TabsTrigger>
          <TabsTrigger value="critical" data-testid="tab-critical" className={hasCritical ? "text-destructive" : ""}>
            {hasCritical ? "⚠ Critical IR" : "Critical IR"}
          </TabsTrigger>
          <TabsTrigger value="cheatsheet" data-testid="tab-cheatsheet">Cheat Sheet</TabsTrigger>
        </TabsList>
        <TabsContent value="daily" className="mt-3"><DailyReport entry={entry} /></TabsContent>
        <TabsContent value="leadership" className="mt-3"><LeadershipSummary entry={entry} /></TabsContent>
        <TabsContent value="evv" className="mt-3"><EvvTripLog entry={entry} /></TabsContent>
        <TabsContent value="critical" className="mt-3"><CriticalIncidentNotification entry={entry} /></TabsContent>
        <TabsContent value="cheatsheet" className="mt-3"><CheatSheet entry={entry} /></TabsContent>
      </Tabs>
    </div>
  );
}
