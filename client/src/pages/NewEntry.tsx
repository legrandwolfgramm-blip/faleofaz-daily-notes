import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Car, AlertTriangle, ChevronDown, ChevronUp, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { SERVICE_CODES, SHIFT_TYPES, INCIDENT_TYPES } from "@shared/schema";
import type { Person, Staff, Activity, Trip, Incident } from "@shared/schema";
import { format } from "date-fns";

const COMMON_ACTIVITIES = [
  "Morning routine", "Breakfast", "Day Program", "Lunch", "Dinner",
  "Hygiene", "Medication", "Community outing", "Recreation", "Bed time",
  "Evening routine", "Personal care", "Doctor appointment", "Grocery shopping"
];

export default function NewEntry() {
  const [, nav] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: persons = [] } = useQuery<Person[]>({ queryKey: ["/api/persons"] });
  const { data: staffList = [] } = useQuery<Staff[]>({ queryKey: ["/api/staff"] });

  // Form state
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [personPid, setPersonPid] = useState("");
  const [staffName, setStaffName] = useState("");
  const [shiftType, setShiftType] = useState<string>("");
  const [shiftStart, setShiftStart] = useState("");
  const [shiftEnd, setShiftEnd] = useState("");
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [activities, setActivities] = useState<Activity[]>([{ time: "", description: "" }]);
  const [behavior, setBehavior] = useState("");
  const [medsGiven, setMedsGiven] = useState(false);
  const [marsCompleted, setMarsCompleted] = useState(false);
  const [medsNotes, setMedsNotes] = useState("");
  const [trips, setTrips] = useState<Trip[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [rawNotes, setRawNotes] = useState("");
  const [showCheatSheet, setShowCheatSheet] = useState(false);

  const toggleCode = (code: string) => {
    setSelectedCodes((c) => c.includes(code) ? c.filter(x => x !== code) : [...c, code]);
  };

  // Activities
  const addActivity = (preset?: string) => {
    setActivities((a) => [...a, { time: "", description: preset || "" }]);
  };
  const updateActivity = (i: number, field: keyof Activity, val: string) => {
    setActivities((a) => a.map((act, idx) => idx === i ? { ...act, [field]: val } : act));
  };
  const removeActivity = (i: number) => setActivities((a) => a.filter((_, idx) => idx !== i));

  // Trips
  const addTrip = () => setTrips((t) => [...t, { pickupTime: "08:45", pickupLocation: "", dropoffTime: "15:00", dropoffLocation: "", mileage: 0, driverName: staffName, purpose: "Day Program transport" }]);
  const updateTrip = (i: number, field: keyof Trip, val: any) => {
    setTrips((t) => t.map((tr, idx) => idx === i ? { ...tr, [field]: val } : tr));
  };
  const removeTrip = (i: number) => setTrips((t) => t.filter((_, idx) => idx !== i));

  // Incidents
  const addIncident = () => setIncidents((inc) => [...inc, { type: "", description: "", timeOfIncident: "", actionsTaken: "", irSubmitted: false, notifiedGuardian: false, notifiedSupervisor: false, involvedEntities: "", isCritical: false }]);
  const updateIncident = (i: number, field: keyof Incident, val: any) => {
    setIncidents((inc) => inc.map((item, idx) => idx === i ? { ...item, [field]: val } : item));
  };
  const removeIncident = (i: number) => setIncidents((inc) => inc.filter((_, idx) => idx !== i));

  const totalMileage = trips.reduce((sum, t) => sum + (t.mileage || 0), 0);

  const mutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/entries", data),
    onSuccess: async (res) => {
      const entry = await res.json();
      qc.invalidateQueries({ queryKey: ["/api/entries"] });
      toast({ title: "Entry saved", description: "Daily entry created successfully." });
      nav(`/entry/${entry.id}`);
    },
    onError: () => toast({ title: "Error", description: "Could not save entry.", variant: "destructive" }),
  });

  const handleSubmit = () => {
    if (!personPid || !staffName || !shiftType || !shiftStart || !shiftEnd || !date) {
      toast({ title: "Required fields missing", description: "Please fill in all required fields.", variant: "destructive" });
      return;
    }
    mutation.mutate({
      date,
      personPid,
      staffName,
      shiftType,
      shiftStart,
      shiftEnd,
      serviceCodesJson: JSON.stringify(selectedCodes),
      activitiesJson: JSON.stringify(activities.filter(a => a.description)),
      behaviorSummary: behavior,
      medsGiven,
      marsCompleted,
      medsNotes,
      tripsJson: JSON.stringify(trips),
      totalMileage,
      incidentsJson: JSON.stringify(incidents.filter(i => i.type || i.description)),
      rawNotes,
    });
  };

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">New Daily Entry</h1>
          <p className="text-sm text-muted-foreground">Enter shift notes — reports auto-format to DSPD/DHHS standards</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowCheatSheet(s => !s)} className="gap-1.5">
          <HelpCircle size={14} />
          {showCheatSheet ? "Hide" : "Cheat Sheet"}
        </Button>
      </div>

      {/* Cheat Sheet Panel */}
      {showCheatSheet && (
        <Card className="border-l-4 border-l-secondary bg-secondary/5 text-xs">
          <CardContent className="p-4 grid md:grid-cols-2 gap-3">
            <div>
              <p className="font-semibold text-secondary mb-1">What every note needs</p>
              <ul className="space-y-0.5 text-muted-foreground">
                <li>• Client PID and staff full name</li>
                <li>• Shift type and start/end times</li>
                <li>• Activities in time order</li>
                <li>• Behavior summary (3rd person, past tense)</li>
                <li>• Meds + MARS if medications were given</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-secondary mb-1">Behavior note tips</p>
              <ul className="space-y-0.5 text-muted-foreground">
                <li>• ✅ "Client was calm and accepted redirection"</li>
                <li>• ❌ "He was non-compliant" / "attention-seeking"</li>
                <li>• Include: mood, participation, staff support</li>
                <li>• Say "peer" not other clients' names</li>
                <li>• Say "staff" not staff names in narrative</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-secondary mb-1">MTP transport (routine)</p>
              <ul className="space-y-0.5 text-muted-foreground">
                <li>• Only pick-up + drop-off times/locations needed</li>
                <li>• Typical: 8:45am pickup, 3:00pm drop-off</li>
                <li>• Add extra detail only if transport problem occurred</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-secondary mb-1">Critical incident threshold</p>
              <ul className="space-y-0.5 text-muted-foreground">
                <li>• Fall with injury · ER/urgent care visit</li>
                <li>• Medication error · Abuse allegation</li>
                <li>• Elopement · Restraint · Law enforcement</li>
                <li>• <strong>OL report within 1 business day</strong></li>
                <li>• <strong>Guardian notification within 24 hours</strong></li>
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Section 1: Who / When */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Shift Information</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label htmlFor="date">Date *</Label>
              <Input id="date" type="date" value={date} onChange={e => setDate(e.target.value)} data-testid="input-date" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="shift-type">Shift Type *</Label>
              <Select value={shiftType} onValueChange={setShiftType}>
                <SelectTrigger id="shift-type" data-testid="select-shift-type">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  {SHIFT_TYPES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="person-pid">Person PID *</Label>
              <div className="flex gap-1">
                <Select value={personPid} onValueChange={setPersonPid}>
                  <SelectTrigger id="person-pid" data-testid="select-person-pid">
                    <SelectValue placeholder="Select person..." />
                  </SelectTrigger>
                  <SelectContent>
                    {persons.map(p => (
                      <SelectItem key={p.pid} value={p.pid}>
                        <span className="mono">{p.pid}</span> — {p.firstName} {p.lastName}
                      </SelectItem>
                    ))}
                    {persons.length === 0 && <SelectItem value="_none" disabled>No persons — add in Persons tab</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
              {personPid === "" && (
                <Input placeholder="Or type PID manually" onBlur={e => e.target.value && setPersonPid(e.target.value)} className="mt-1 text-xs" />
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label htmlFor="staff-name">Staff Name *</Label>
              <Select value={staffName} onValueChange={setStaffName}>
                <SelectTrigger id="staff-name" data-testid="select-staff-name">
                  <SelectValue placeholder="Select staff..." />
                </SelectTrigger>
                <SelectContent>
                  {staffList.map(s => <SelectItem key={s.id} value={s.fullName}>{s.fullName}</SelectItem>)}
                  {staffList.length === 0 && <SelectItem value="_none" disabled>No staff — add in Staff tab</SelectItem>}
                </SelectContent>
              </Select>
              {staffName === "" && (
                <Input placeholder="Or type name manually" onBlur={e => e.target.value && setStaffName(e.target.value)} className="mt-1 text-xs" />
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="shift-start">Shift Start *</Label>
              <Input id="shift-start" type="time" value={shiftStart} onChange={e => setShiftStart(e.target.value)} data-testid="input-shift-start" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="shift-end">Shift End *</Label>
              <Input id="shift-end" type="time" value={shiftEnd} onChange={e => setShiftEnd(e.target.value)} data-testid="input-shift-end" />
            </div>
          </div>

          {/* Service codes */}
          <div className="space-y-2">
            <Label>Service Codes</Label>
            <div className="flex flex-wrap gap-1.5">
              {SERVICE_CODES.map(code => (
                <button
                  key={code}
                  type="button"
                  data-testid={`code-${code}`}
                  onClick={() => toggleCode(code)}
                  className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
                    selectedCodes.includes(code)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:border-primary/60 hover:text-foreground"
                  }`}
                >
                  {code}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 2: Activities */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Activities (Time Order)</CardTitle>
            <Button variant="outline" size="sm" onClick={() => addActivity()} className="gap-1 h-7 text-xs" data-testid="btn-add-activity">
              <Plus size={12} /> Add
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {/* Quick add presets */}
          <div className="flex flex-wrap gap-1 mb-2">
            {COMMON_ACTIVITIES.map(a => (
              <button key={a} type="button" onClick={() => addActivity(a)}
                className="px-2 py-0.5 rounded text-xs border border-border text-muted-foreground hover:border-secondary hover:text-foreground transition-colors">
                + {a}
              </button>
            ))}
          </div>

          {activities.map((act, i) => (
            <div key={i} className="flex gap-2 items-start">
              <Input type="time" value={act.time} onChange={e => updateActivity(i, "time", e.target.value)}
                className="w-28 shrink-0" data-testid={`activity-time-${i}`} />
              <Input value={act.description} onChange={e => updateActivity(i, "description", e.target.value)}
                placeholder="Activity description..." className="flex-1" data-testid={`activity-desc-${i}`} />
              <Button variant="ghost" size="icon" onClick={() => removeActivity(i)} className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive">
                <Trash2 size={14} />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Section 3: Behavior Summary */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Behavior Summary</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={behavior}
            onChange={e => setBehavior(e.target.value)}
            placeholder="Describe client's behavior, mood, participation, and response to support. Use 3rd person/past tense. Say 'staff' not staff names. Say 'peer' not client names."
            rows={4}
            data-testid="textarea-behavior"
          />
          <div className="flex items-start gap-4">
            <div className="flex items-center gap-2">
              <Checkbox id="meds-given" checked={medsGiven} onCheckedChange={v => setMedsGiven(!!v)} data-testid="checkbox-meds-given" />
              <Label htmlFor="meds-given" className="text-sm">Medications given</Label>
            </div>
            {medsGiven && (
              <div className="flex items-center gap-2">
                <Checkbox id="mars-done" checked={marsCompleted} onCheckedChange={v => setMarsCompleted(!!v)} data-testid="checkbox-mars" />
                <Label htmlFor="mars-done" className="text-sm">MARS completed</Label>
              </div>
            )}
          </div>
          {medsGiven && (
            <Input value={medsNotes} onChange={e => setMedsNotes(e.target.value)} placeholder="Medication notes (optional)" data-testid="input-meds-notes" />
          )}
        </CardContent>
      </Card>

      {/* Section 4: MTP Trip Log */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">MTP Trip Log</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">For DTP/MTP service codes — pick-up/drop-off required</p>
            </div>
            <Button variant="outline" size="sm" onClick={addTrip} className="gap-1 h-7 text-xs" data-testid="btn-add-trip">
              <Car size={12} /> Add Trip
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {trips.length === 0 && (
            <p className="text-xs text-muted-foreground italic">No trips logged. Add a trip if MTP/DTP services were provided.</p>
          )}
          {trips.map((trip, i) => (
            <div key={i} className="border border-border rounded-lg p-3 space-y-2 bg-muted/30">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold badge-mtp rounded px-2 py-0.5">Trip {i + 1}</span>
                <Button variant="ghost" size="icon" onClick={() => removeTrip(i)} className="h-7 w-7 text-muted-foreground hover:text-destructive">
                  <Trash2 size={12} />
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Pick-up Time *</Label>
                  <Input type="time" value={trip.pickupTime} onChange={e => updateTrip(i, "pickupTime", e.target.value)} data-testid={`trip-pickup-time-${i}`} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Pick-up Location *</Label>
                  <Input value={trip.pickupLocation} onChange={e => updateTrip(i, "pickupLocation", e.target.value)} placeholder="e.g. Residence" data-testid={`trip-pickup-loc-${i}`} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Drop-off Time *</Label>
                  <Input type="time" value={trip.dropoffTime} onChange={e => updateTrip(i, "dropoffTime", e.target.value)} data-testid={`trip-dropoff-time-${i}`} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Drop-off Location *</Label>
                  <Input value={trip.dropoffLocation} onChange={e => updateTrip(i, "dropoffLocation", e.target.value)} placeholder="e.g. Day Program" data-testid={`trip-dropoff-loc-${i}`} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Driver Name</Label>
                  <Input value={trip.driverName || ""} onChange={e => updateTrip(i, "driverName", e.target.value)} data-testid={`trip-driver-${i}`} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Mileage</Label>
                  <Input type="number" value={trip.mileage || ""} onChange={e => updateTrip(i, "mileage", parseFloat(e.target.value) || 0)} placeholder="0.0" data-testid={`trip-mileage-${i}`} />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Purpose / Notes (only if transport issue occurred)</Label>
                <Input value={trip.purpose || ""} onChange={e => updateTrip(i, "purpose", e.target.value)} placeholder="Day Program transport (leave blank if routine)" data-testid={`trip-purpose-${i}`} />
              </div>
              {(trip.vehicleIssue || "") !== "" && (
                <div className="space-y-1">
                  <Label className="text-xs text-destructive">Vehicle/Transport Issue</Label>
                  <Input value={trip.vehicleIssue || ""} onChange={e => updateTrip(i, "vehicleIssue", e.target.value)} data-testid={`trip-vehicle-issue-${i}`} />
                </div>
              )}
            </div>
          ))}
          {trips.length > 0 && (
            <p className="text-xs text-muted-foreground">Total mileage: <strong>{totalMileage.toFixed(1)} mi</strong></p>
          )}
        </CardContent>
      </Card>

      {/* Section 5: Incidents */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Incident Reports</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Only log if an actual incident occurred</p>
            </div>
            <Button variant="outline" size="sm" onClick={addIncident} className="gap-1 h-7 text-xs" data-testid="btn-add-incident">
              <AlertTriangle size={12} /> Add Incident
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {incidents.length === 0 && (
            <p className="text-xs text-muted-foreground italic">No incidents to report for this shift.</p>
          )}
          {incidents.map((inc, i) => (
            <div key={i} className={`border rounded-lg p-3 space-y-2 ${inc.isCritical ? "border-destructive bg-destructive/5" : "border-border bg-muted/30"}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-semibold rounded px-2 py-0.5 ${inc.isCritical ? "badge-critical" : "badge-warning"}`}>
                    {inc.isCritical ? "⚠ Critical IR" : "Incident"} {i + 1}
                  </span>
                </div>
                <Button variant="ghost" size="icon" onClick={() => removeIncident(i)} className="h-7 w-7 text-muted-foreground hover:text-destructive">
                  <Trash2 size={12} />
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Incident Type *</Label>
                  <Select value={inc.type} onValueChange={v => updateIncident(i, "type", v)}>
                    <SelectTrigger data-testid={`incident-type-${i}`}><SelectValue placeholder="Select type..." /></SelectTrigger>
                    <SelectContent>
                      {INCIDENT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Time of Incident</Label>
                  <Input type="time" value={inc.timeOfIncident || ""} onChange={e => updateIncident(i, "timeOfIncident", e.target.value)} data-testid={`incident-time-${i}`} />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Description *</Label>
                <Textarea value={inc.description} onChange={e => updateIncident(i, "description", e.target.value)}
                  placeholder="Describe what happened objectively. Include what was observed, heard, or discovered." rows={2} data-testid={`incident-desc-${i}`} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Actions Taken</Label>
                <Textarea value={inc.actionsTaken || ""} onChange={e => updateIncident(i, "actionsTaken", e.target.value)}
                  placeholder="What steps were taken? Who was called? What care was provided?" rows={2} data-testid={`incident-actions-${i}`} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Involved Entities (law enforcement, CPS, APS, EMS, etc.)</Label>
                <Input value={inc.involvedEntities || ""} onChange={e => updateIncident(i, "involvedEntities", e.target.value)} data-testid={`incident-entities-${i}`} />
              </div>

              <div className="flex flex-wrap gap-4 pt-1">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <Checkbox checked={inc.isCritical} onCheckedChange={v => updateIncident(i, "isCritical", !!v)} data-testid={`incident-critical-${i}`} />
                  <span className="text-xs font-medium text-destructive">Mark as Critical Incident (R380-600)</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <Checkbox checked={inc.irSubmitted} onCheckedChange={v => updateIncident(i, "irSubmitted", !!v)} data-testid={`incident-ir-submitted-${i}`} />
                  <span className="text-xs">IR submitted to OL</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <Checkbox checked={inc.notifiedGuardian} onCheckedChange={v => updateIncident(i, "notifiedGuardian", !!v)} data-testid={`incident-guardian-${i}`} />
                  <span className="text-xs">Guardian notified (24hr)</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <Checkbox checked={inc.notifiedSupervisor} onCheckedChange={v => updateIncident(i, "notifiedSupervisor", !!v)} data-testid={`incident-supervisor-${i}`} />
                  <span className="text-xs">Supervisor notified</span>
                </label>
              </div>

              {inc.isCritical && (
                <div className="rounded bg-destructive/10 border border-destructive/30 p-2 text-xs text-destructive space-y-0.5">
                  <p className="font-semibold">⚠ R380-600 Critical Incident Requirements:</p>
                  <p>• OL report due within <strong>1 business day</strong> of occurrence</p>
                  <p>• Guardian notification within <strong>24 hours</strong></p>
                  <p>• Division must be notified immediately if client is under DHHS contract</p>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Section 6: Raw Notes */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Raw Notes (Optional)</CardTitle></CardHeader>
        <CardContent>
          <Textarea value={rawNotes} onChange={e => setRawNotes(e.target.value)}
            placeholder="Paste raw shift notes here for reference. These will be stored but not shown in formatted reports."
            rows={3} data-testid="textarea-raw-notes" />
        </CardContent>
      </Card>

      {/* Submit */}
      <div className="flex gap-3 justify-end pb-8">
        <Button variant="outline" onClick={() => nav("/")} data-testid="btn-cancel">Cancel</Button>
        <Button onClick={handleSubmit} disabled={mutation.isPending} data-testid="btn-submit-entry">
          {mutation.isPending ? "Saving..." : "Save Entry & Generate Reports"}
        </Button>
      </div>
    </div>
  );
}
