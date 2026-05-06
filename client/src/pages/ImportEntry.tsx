import { useState, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Upload, FileText, FileSpreadsheet, File, X, CheckCircle,
  Loader2, AlertTriangle, ChevronRight, Edit3, Wand2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { SERVICE_CODES, SHIFT_TYPES, INCIDENT_TYPES } from "@shared/schema";
import type { Person, Staff, Activity, Trip, Incident } from "@shared/schema";
import { format } from "date-fns";
import * as XLSX from "xlsx";

// ─── File type detection ─────────────────────────────────────────────────────
type FileKind = "xlsx" | "pdf" | "docx" | "txt" | "csv" | "unknown";

function detectKind(file: File): FileKind {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "xlsx" || ext === "xls") return "xlsx";
  if (ext === "pdf") return "pdf";
  if (ext === "docx" || ext === "doc") return "docx";
  if (ext === "txt") return "txt";
  if (ext === "csv") return "csv";
  return "unknown";
}

function fileIcon(kind: FileKind) {
  if (kind === "xlsx" || kind === "csv") return <FileSpreadsheet size={20} className="text-green-600" />;
  if (kind === "pdf") return <FileText size={20} className="text-red-500" />;
  if (kind === "docx") return <File size={20} className="text-blue-500" />;
  return <FileText size={20} className="text-muted-foreground" />;
}

// ─── Text extraction ──────────────────────────────────────────────────────────
async function extractText(file: File, kind: FileKind): Promise<string> {
  if (kind === "txt") {
    return await file.text();
  }

  if (kind === "csv") {
    const raw = await file.text();
    // Turn CSV into readable text for parsing
    const rows = XLSX.utils.sheet_to_json(XLSX.read(raw, { type: "string" }).Sheets[Object.keys(XLSX.read(raw, { type: "string" }).Sheets)[0]], { header: 1 }) as any[][];
    return rows.map(r => r.join("\t")).join("\n");
  }

  if (kind === "xlsx") {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    let text = "";
    for (const sheetName of wb.SheetNames) {
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1 }) as any[][];
      text += `[Sheet: ${sheetName}]\n`;
      text += rows.map((r: any[]) => r.map((c: any) => (c ?? "")).join("\t")).join("\n");
      text += "\n\n";
    }
    return text;
  }

  if (kind === "docx") {
    try {
      const mammoth = await import("mammoth");
      const buf = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer: buf });
      return result.value;
    } catch (e) {
      throw new Error("Could not parse DOCX file. Please try copy-pasting the text instead.");
    }
  }

  if (kind === "pdf") {
    try {
      // Use pdfjs-dist via dynamic import
      const pdfjsLib = await import("pdfjs-dist");
      // Set worker source to CDN to avoid bundling issues
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
      const buf = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
      let text = "";
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map((item: any) => item.str).join(" ") + "\n";
      }
      return text;
    } catch (e) {
      throw new Error("Could not parse PDF. If it's a scanned image PDF, please copy-paste the text instead.");
    }
  }

  throw new Error("Unsupported file type.");
}

// ─── Smart parser — extract structured fields from raw text ──────────────────
interface ParsedFields {
  date?: string;
  personPid?: string;
  staffName?: string;
  shiftType?: string;
  shiftStart?: string;
  shiftEnd?: string;
  serviceCodes: string[];
  activities: Activity[];
  behaviorSummary?: string;
  medsGiven?: boolean;
  marsCompleted?: boolean;
  medsNotes?: string;
  trips: Trip[];
  incidents: Incident[];
}

function smartParse(text: string): ParsedFields {
  const result: ParsedFields = { serviceCodes: [], activities: [], trips: [], incidents: [] };
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const lower = text.toLowerCase();

  // ── Date ──
  const dateMatch = text.match(/\b(\d{4}[-/]\d{1,2}[-/]\d{1,2})\b/) ||
    text.match(/\b(\d{1,2}[-/]\d{1,2}[-/]\d{4})\b/) ||
    text.match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)[.,\s]+(\d{1,2})[,\s]+(\d{4})\b/i);
  if (dateMatch) {
    const raw = dateMatch[0];
    const d = new Date(raw);
    if (!isNaN(d.getTime())) result.date = format(d, "yyyy-MM-dd");
  }

  // ── PID ──
  const pidMatch = text.match(/\bPID[:\s#]*([A-Z0-9]{5,12})\b/i) ||
    text.match(/\bperson\s*(?:id|identification|number|#)[:\s]*([A-Z0-9]{5,12})\b/i) ||
    text.match(/\bID[:\s#]*([0-9]{6,10})\b/i);
  if (pidMatch) result.personPid = pidMatch[1].trim();

  // ── Staff ──
  const staffMatch = text.match(/\bstaff(?:\s*name)?[:\s]+([A-Z][a-z]+(?:\s[A-Z][a-z]+){1,2})\b/) ||
    text.match(/\bDSP[:\s]+([A-Z][a-z]+(?:\s[A-Z][a-z]+){1,2})\b/) ||
    text.match(/\bprovider[:\s]+([A-Z][a-z]+(?:\s[A-Z][a-z]+){1,2})\b/i);
  if (staffMatch) result.staffName = staffMatch[1].trim();

  // ── Shift type ──
  if (/day\s*program/i.test(text)) result.shiftType = "Day Program";
  else if (/graves?/i.test(text)) result.shiftType = "Graves";
  else if (/week\s*end/i.test(text)) result.shiftType = "Weekend";
  else if (/evening/i.test(text)) result.shiftType = "Evening";
  else if (/general\s*activity/i.test(text)) result.shiftType = "General Activity";

  // ── Times ──
  const timePattern = /\b(\d{1,2}:\d{2}(?:\s*[ap]m)?)\b/gi;
  const allTimes = [...text.matchAll(timePattern)].map(m => m[1]);

  const startMatch = text.match(/shift\s*start[:\s]+(\d{1,2}:\d{2}(?:\s*[ap]m)?)/i) ||
    text.match(/start(?:ed)?[:\s]+(\d{1,2}:\d{2}(?:\s*[ap]m)?)/i) ||
    text.match(/clock(?:ed)?\s*in[:\s]+(\d{1,2}:\d{2}(?:\s*[ap]m)?)/i);
  if (startMatch) result.shiftStart = normalizeTime(startMatch[1]);

  const endMatch = text.match(/shift\s*end[:\s]+(\d{1,2}:\d{2}(?:\s*[ap]m)?)/i) ||
    text.match(/end(?:ed)?[:\s]+(\d{1,2}:\d{2}(?:\s*[ap]m)?)/i) ||
    text.match(/clock(?:ed)?\s*out[:\s]+(\d{1,2}:\d{2}(?:\s*[ap]m)?)/i);
  if (endMatch) result.shiftEnd = normalizeTime(endMatch[1]);

  // ── Service codes ──
  const knownCodes = ["CO1","CO2","CO3","DSG","DSI","DTP","MTP","HHS","RHS","PPS","RP1","RP6","RP8","TF1","BE1","SFC","IHL"];
  for (const code of knownCodes) {
    if (new RegExp(`\\b${code}\\b`, "i").test(text)) {
      result.serviceCodes.push(code);
    }
  }

  // ── Activities — look for time + activity lines ──
  const activityPattern = /(\d{1,2}:\d{2}(?:\s*[ap]m)?)[:\s\-–]+(.{5,80})/gi;
  const actMatches = [...text.matchAll(activityPattern)];
  if (actMatches.length > 0) {
    result.activities = actMatches.slice(0, 20).map(m => ({
      time: normalizeTime(m[1]),
      description: m[2].trim().replace(/[.]+$/, ""),
    })).filter(a => a.description.length > 3);
  }

  // ── Behavior summary — look for labeled sections ──
  const behaviorSection = text.match(/(?:behavior|behaviour)\s*(?:summary|note|description)?[:\s\-–]+(.{20,1000}?)(?:\n\n|\n[A-Z]|medications?|incident|$)/is) ||
    text.match(/(?:narrative|shift notes?|daily notes?)[:\s\-–]+(.{20,1000}?)(?:\n\n|\n[A-Z]|medications?|incident|$)/is);
  if (behaviorSection) result.behaviorSummary = behaviorSection[1].replace(/\s+/g, " ").trim();

  // ── Medications ──
  result.medsGiven = /\bmed(?:ication)?s?\s*(?:given|administered|provided)\b/i.test(text) ||
    /\bMARS\s*completed\b/i.test(text);
  result.marsCompleted = /\bMARS\s*completed\b/i.test(text) || /\bMARS[:\s]+yes\b/i.test(text);

  const medsNotesMatch = text.match(/med(?:ication)?\s*notes?[:\s\-–]+(.{5,200})/i);
  if (medsNotesMatch) result.medsNotes = medsNotesMatch[1].trim();

  // ── Trips / MTP ──
  const pickupMatch = text.match(/pick[\s\-]?up[:\s]+(\d{1,2}:\d{2}(?:\s*[ap]m)?)[^\n]*?\bat[:\s]+([^\n,;]{3,60})/i) ||
    text.match(/pick[\s\-]?up[:\s]+([^\n]{3,80})/i);
  const dropoffMatch = text.match(/drop[\s\-]?off[:\s]+(\d{1,2}:\d{2}(?:\s*[ap]m)?)[^\n]*?\bat[:\s]+([^\n,;]{3,60})/i) ||
    text.match(/drop[\s\-]?off[:\s]+([^\n]{3,80})/i);
  const mileageMatch = text.match(/mileage[:\s]+([0-9.]+)/i) || text.match(/([0-9.]+)\s*mi(?:les?)/i);

  if (pickupMatch || dropoffMatch) {
    result.trips.push({
      pickupTime: pickupMatch ? normalizeTime(pickupMatch[1]) : "08:45",
      pickupLocation: pickupMatch?.[2]?.trim() || "",
      dropoffTime: dropoffMatch ? normalizeTime(dropoffMatch[1]) : "15:00",
      dropoffLocation: dropoffMatch?.[2]?.trim() || "",
      mileage: mileageMatch ? parseFloat(mileageMatch[1]) : 0,
      driverName: result.staffName || "",
      purpose: "Transport",
    });
  }

  // ── Incidents ──
  const incidentKeywords = ["fall", "er visit", "urgent care", "medication error", "elopement", "restraint", "law enforcement", "missing", "injury", "incident"];
  for (const kw of incidentKeywords) {
    const re = new RegExp(`(?:^|\\n)[^\\n]*${kw}[^\\n]{5,200}`, "gi");
    const match = text.match(re);
    if (match) {
      const desc = match[0].replace(/\n/g, " ").trim();
      const type = kw === "fall" ? "Fall with injury"
        : kw === "er visit" || kw === "urgent care" ? "ER/Urgent care visit"
        : kw === "medication error" ? "Medication error"
        : kw === "elopement" ? "Elopement"
        : kw === "restraint" ? "Restraint used"
        : kw === "law enforcement" ? "Law enforcement contact"
        : "Other";
      // Avoid duplicates
      if (!result.incidents.find(i => i.description.includes(desc.slice(0, 30)))) {
        result.incidents.push({
          type,
          description: desc,
          timeOfIncident: "",
          actionsTaken: "",
          irSubmitted: false,
          notifiedGuardian: false,
          notifiedSupervisor: false,
          involvedEntities: "",
          isCritical: ["fall", "er visit", "urgent care", "elopement", "restraint", "law enforcement", "missing"].includes(kw),
        });
      }
      break; // one incident detection pass is enough for auto-fill
    }
  }

  return result;
}

function normalizeTime(raw: string): string {
  if (!raw) return "";
  raw = raw.trim().toLowerCase();
  const ampm = raw.includes("pm") ? "pm" : raw.includes("am") ? "am" : null;
  const [h, m] = raw.replace(/[apm\s]/g, "").split(":").map(Number);
  if (isNaN(h)) return "";
  let hour = h;
  if (ampm === "pm" && h < 12) hour = h + 12;
  if (ampm === "am" && h === 12) hour = 0;
  return `${String(hour).padStart(2, "0")}:${String(m || 0).padStart(2, "0")}`;
}

// ─── Main component ───────────────────────────────────────────────────────────
type Step = "upload" | "review" | "edit";

export default function ImportEntry() {
  const [, nav] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const dropRef = useRef<HTMLDivElement>(null);

  const { data: persons = [] } = useQuery<Person[]>({ queryKey: ["/api/persons"] });
  const { data: staffList = [] } = useQuery<Staff[]>({ queryKey: ["/api/staff"] });

  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [kind, setKind] = useState<FileKind>("unknown");
  const [rawText, setRawText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState("");
  const [parsed, setParsed] = useState<ParsedFields | null>(null);
  const [dragging, setDragging] = useState(false);

  // Editable fields (pre-filled from parsed)
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [personPid, setPersonPid] = useState("");
  const [staffName, setStaffName] = useState("");
  const [shiftType, setShiftType] = useState("");
  const [shiftStart, setShiftStart] = useState("");
  const [shiftEnd, setShiftEnd] = useState("");
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [behavior, setBehavior] = useState("");
  const [medsGiven, setMedsGiven] = useState(false);
  const [marsCompleted, setMarsCompleted] = useState(false);
  const [medsNotes, setMedsNotes] = useState("");
  const [trips, setTrips] = useState<Trip[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);

  const applyParsed = (p: ParsedFields) => {
    if (p.date) setDate(p.date);
    if (p.personPid) setPersonPid(p.personPid);
    if (p.staffName) setStaffName(p.staffName);
    if (p.shiftType) setShiftType(p.shiftType);
    if (p.shiftStart) setShiftStart(p.shiftStart);
    if (p.shiftEnd) setShiftEnd(p.shiftEnd);
    if (p.serviceCodes.length) setSelectedCodes(p.serviceCodes);
    if (p.activities.length) setActivities(p.activities);
    if (p.behaviorSummary) setBehavior(p.behaviorSummary);
    setMedsGiven(!!p.medsGiven);
    setMarsCompleted(!!p.marsCompleted);
    if (p.medsNotes) setMedsNotes(p.medsNotes);
    if (p.trips.length) setTrips(p.trips);
    if (p.incidents.length) setIncidents(p.incidents);
  };

  const processFile = async (f: File) => {
    const k = detectKind(f);
    setFile(f);
    setKind(k);
    setParsing(true);
    setParseError("");

    try {
      const text = await extractText(f, k);
      setRawText(text);
      const p = smartParse(text);
      setParsed(p);
      applyParsed(p);
      setStep("review");
    } catch (e: any) {
      setParseError(e.message || "Could not parse file.");
      setRawText("");
      setStep("review");
    } finally {
      setParsing(false);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) processFile(f);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) processFile(f);
  }, []);

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragging(true); };
  const handleDragLeave = () => setDragging(false);

  const toggleCode = (code: string) =>
    setSelectedCodes(c => c.includes(code) ? c.filter(x => x !== code) : [...c, code]);

  const totalMileage = trips.reduce((s, t) => s + (t.mileage || 0), 0);

  const saveMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/entries", data),
    onSuccess: async (res) => {
      const entry = await res.json();
      qc.invalidateQueries({ queryKey: ["/api/entries"] });
      toast({ title: "Entry imported", description: "File data imported and saved successfully." });
      nav(`/entry/${entry.id}`);
    },
    onError: () => toast({ title: "Save failed", variant: "destructive" }),
  });

  const handleSave = () => {
    if (!personPid || !staffName || !shiftType || !shiftStart || !shiftEnd || !date) {
      toast({ title: "Required fields missing", description: "Fill in all required fields before saving.", variant: "destructive" });
      return;
    }
    saveMutation.mutate({
      date, personPid, staffName, shiftType, shiftStart, shiftEnd,
      serviceCodesJson: JSON.stringify(selectedCodes),
      activitiesJson: JSON.stringify(activities.filter(a => a.description)),
      behaviorSummary: behavior,
      medsGiven, marsCompleted, medsNotes,
      tripsJson: JSON.stringify(trips),
      totalMileage,
      incidentsJson: JSON.stringify(incidents.filter(i => i.type || i.description)),
      rawNotes: rawText.slice(0, 3000),
    });
  };

  const reparse = () => {
    if (!rawText) return;
    const p = smartParse(rawText);
    setParsed(p);
    applyParsed(p);
    toast({ title: "Re-parsed", description: "Fields updated from text." });
  };

  // ── Render: Upload step ──
  if (step === "upload") {
    return (
      <div className="max-w-2xl mx-auto space-y-5">
        <div>
          <h1 className="text-xl font-bold">Import from File</h1>
          <p className="text-sm text-muted-foreground">Upload an Excel, PDF, Word, or text file — fields auto-fill from your document</p>
        </div>

        {/* Drop zone */}
        <div
          ref={dropRef}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`relative border-2 border-dashed rounded-xl p-12 text-center transition-colors cursor-pointer ${
            dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/40"
          }`}
          onClick={() => document.getElementById("file-input")?.click()}
          data-testid="drop-zone"
        >
          <input
            id="file-input"
            type="file"
            accept=".xlsx,.xls,.csv,.pdf,.docx,.doc,.txt"
            className="hidden"
            onChange={handleFileInput}
            data-testid="file-input"
          />
          {parsing ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 size={36} className="text-primary animate-spin" />
              <p className="text-sm font-medium">Reading file…</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <Upload size={36} className="text-muted-foreground" />
              <div>
                <p className="text-base font-semibold">Drop your file here</p>
                <p className="text-sm text-muted-foreground mt-0.5">or click to browse</p>
              </div>
              <div className="flex gap-2 mt-2 flex-wrap justify-center">
                {[
                  { label: "Excel / CSV", icon: <FileSpreadsheet size={13} className="text-green-600" />, ext: ".xlsx .xls .csv" },
                  { label: "PDF", icon: <FileText size={13} className="text-red-500" />, ext: ".pdf" },
                  { label: "Word", icon: <File size={13} className="text-blue-500" />, ext: ".docx .doc" },
                  { label: "Text", icon: <FileText size={13} className="text-muted-foreground" />, ext: ".txt" },
                ].map(({ label, icon, ext }) => (
                  <div key={label} className="flex items-center gap-1.5 border border-border rounded-full px-3 py-1 text-xs text-muted-foreground">
                    {icon} {label}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* OR: paste text directly */}
        <div className="relative">
          <div className="absolute inset-x-0 top-1/2 flex items-center">
            <div className="flex-1 border-t border-border" />
            <span className="px-3 text-xs text-muted-foreground bg-background">or paste text directly</span>
            <div className="flex-1 border-t border-border" />
          </div>
        </div>

        <Card>
          <CardContent className="p-4 space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Paste Raw Shift Notes</Label>
            <Textarea
              value={rawText}
              onChange={e => setRawText(e.target.value)}
              placeholder={"Paste shift notes, daily logs, or any text here…\n\nExample:\nDate: 04/21/2026\nPID: 87654321\nStaff: Maria Santos\nShift: Day Program 8:00am – 4:00pm\n8:45am – Transported to day program\n12:00pm – Lunch\nBehavior: Client was calm and cooperative…"}
              rows={8}
              className="font-mono text-xs"
              data-testid="textarea-paste"
            />
            <Button
              onClick={() => {
                if (!rawText.trim()) return;
                setParsing(true);
                setTimeout(() => {
                  const p = smartParse(rawText);
                  setParsed(p);
                  applyParsed(p);
                  setParsing(false);
                  setStep("review");
                }, 200);
              }}
              disabled={!rawText.trim() || parsing}
              className="gap-1.5 w-full"
              data-testid="btn-parse-text"
            >
              {parsing ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
              Auto-fill from Text
            </Button>
          </CardContent>
        </Card>

        {/* What gets auto-detected */}
        <Card className="bg-muted/30">
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">What gets auto-detected</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-muted-foreground">
              {[
                "Date", "Person PID", "Staff name", "Shift type",
                "Shift start/end times", "Service codes (CO1, MTP, etc.)",
                "Activities + timestamps", "Behavior summary",
                "Medications & MARS", "Pick-up/drop-off times & locations",
                "Mileage", "Incident type & description",
              ].map(item => (
                <p key={item} className="flex items-center gap-1.5">
                  <CheckCircle size={10} className="text-green-600 shrink-0" /> {item}
                </p>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-3 italic">
              All auto-filled fields are editable before saving. Review everything before submitting.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Render: Review + Edit step ──
  const fieldsFilled = [date, personPid, staffName, shiftType, shiftStart, shiftEnd].filter(Boolean).length;
  const confidence = Math.round((fieldsFilled / 6) * 100);

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <button onClick={() => setStep("upload")} className="text-muted-foreground hover:text-foreground text-sm">← Back</button>
            <span className="text-muted-foreground">/</span>
            <h1 className="text-xl font-bold">Review & Edit Import</h1>
          </div>
          {file && (
            <div className="flex items-center gap-2 mt-0.5">
              {fileIcon(kind)}
              <span className="text-sm text-muted-foreground">{file.name}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                confidence >= 80 ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                : confidence >= 50 ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
              }`}>
                {confidence}% auto-filled
              </span>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          {rawText && (
            <Button variant="outline" size="sm" onClick={reparse} className="gap-1.5 text-xs" data-testid="btn-reparse">
              <Wand2 size={13} /> Re-parse
            </Button>
          )}
          <Button onClick={handleSave} disabled={saveMutation.isPending} data-testid="btn-save-import">
            {saveMutation.isPending ? "Saving…" : "Save & Generate Reports"}
          </Button>
        </div>
      </div>

      {parseError && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/8 p-3 text-xs text-destructive flex items-start gap-2">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Parse error</p>
            <p>{parseError}</p>
            <p className="mt-1">You can still fill the fields manually below.</p>
          </div>
        </div>
      )}

      {/* Parsed text preview */}
      {rawText && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Extracted Text (read-only)</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-36 overflow-y-auto px-4 pb-3">
              <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono leading-relaxed">{rawText.slice(0, 2000)}{rawText.length > 2000 ? "\n…[truncated]" : ""}</pre>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Shift Information */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Shift Information</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Date *</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} data-testid="import-date" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Shift Type *</Label>
              <Select value={shiftType} onValueChange={setShiftType}>
                <SelectTrigger data-testid="import-shift-type"><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>{SHIFT_TYPES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Person PID *</Label>
              <Select value={personPid} onValueChange={setPersonPid}>
                <SelectTrigger data-testid="import-pid"><SelectValue placeholder={personPid || "Select…"} /></SelectTrigger>
                <SelectContent>
                  {persons.map(p => <SelectItem key={p.pid} value={p.pid}><span className="mono">{p.pid}</span> — {p.firstName}</SelectItem>)}
                </SelectContent>
              </Select>
              {!persons.find(p => p.pid === personPid) && (
                <Input value={personPid} onChange={e => setPersonPid(e.target.value)} placeholder="Or type PID" className="mt-1 text-xs mono" />
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Staff Name *</Label>
              <Select value={staffName} onValueChange={setStaffName}>
                <SelectTrigger data-testid="import-staff"><SelectValue placeholder={staffName || "Select…"} /></SelectTrigger>
                <SelectContent>{staffList.map(s => <SelectItem key={s.id} value={s.fullName}>{s.fullName}</SelectItem>)}</SelectContent>
              </Select>
              {!staffList.find(s => s.fullName === staffName) && (
                <Input value={staffName} onChange={e => setStaffName(e.target.value)} placeholder="Or type name" className="mt-1 text-xs" />
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Shift Start *</Label>
              <Input type="time" value={shiftStart} onChange={e => setShiftStart(e.target.value)} data-testid="import-shift-start" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Shift End *</Label>
              <Input type="time" value={shiftEnd} onChange={e => setShiftEnd(e.target.value)} data-testid="import-shift-end" />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Service Codes</Label>
            <div className="flex flex-wrap gap-1.5">
              {SERVICE_CODES.map(code => (
                <button key={code} type="button" onClick={() => toggleCode(code)}
                  className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
                    selectedCodes.includes(code) ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/60"
                  }`}>
                  {code}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Activities */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Activities ({activities.length} detected)</CardTitle>
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1"
              onClick={() => setActivities(a => [...a, { time: "", description: "" }])} data-testid="import-add-activity">
              + Add
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {activities.length === 0 && <p className="text-xs text-muted-foreground italic">No activities detected. Add them manually.</p>}
          {activities.map((act, i) => (
            <div key={i} className="flex gap-2 items-center">
              <Input type="time" value={act.time} onChange={e => setActivities(a => a.map((x, j) => j === i ? { ...x, time: e.target.value } : x))} className="w-28 shrink-0" />
              <Input value={act.description} onChange={e => setActivities(a => a.map((x, j) => j === i ? { ...x, description: e.target.value } : x))} className="flex-1" />
              <button onClick={() => setActivities(a => a.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive transition-colors shrink-0">
                <X size={14} />
              </button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Behavior */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Behavior Summary</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Textarea value={behavior} onChange={e => setBehavior(e.target.value)} rows={4} placeholder="Describe behavior (3rd person, past tense)…" data-testid="import-behavior" />
          <div className="flex gap-4">
            <label className="flex items-center gap-1.5 text-sm cursor-pointer">
              <Checkbox checked={medsGiven} onCheckedChange={v => setMedsGiven(!!v)} />
              Medications given
            </label>
            {medsGiven && (
              <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                <Checkbox checked={marsCompleted} onCheckedChange={v => setMarsCompleted(!!v)} />
                MARS completed
              </label>
            )}
          </div>
          {medsGiven && <Input value={medsNotes} onChange={e => setMedsNotes(e.target.value)} placeholder="Medication notes…" />}
        </CardContent>
      </Card>

      {/* Trips */}
      {trips.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Detected Trips ({trips.length})</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {trips.map((trip, i) => (
              <div key={i} className="rounded-md border border-border p-3 grid grid-cols-2 md:grid-cols-3 gap-2 text-xs bg-muted/20">
                <div className="space-y-1"><Label className="text-xs">Pick-up Time</Label><Input type="time" value={trip.pickupTime} onChange={e => setTrips(t => t.map((x, j) => j === i ? { ...x, pickupTime: e.target.value } : x))} /></div>
                <div className="space-y-1"><Label className="text-xs">Pick-up Location</Label><Input value={trip.pickupLocation} onChange={e => setTrips(t => t.map((x, j) => j === i ? { ...x, pickupLocation: e.target.value } : x))} /></div>
                <div className="space-y-1"><Label className="text-xs">Drop-off Time</Label><Input type="time" value={trip.dropoffTime} onChange={e => setTrips(t => t.map((x, j) => j === i ? { ...x, dropoffTime: e.target.value } : x))} /></div>
                <div className="space-y-1"><Label className="text-xs">Drop-off Location</Label><Input value={trip.dropoffLocation} onChange={e => setTrips(t => t.map((x, j) => j === i ? { ...x, dropoffLocation: e.target.value } : x))} /></div>
                <div className="space-y-1"><Label className="text-xs">Mileage</Label><Input type="number" value={trip.mileage || ""} onChange={e => setTrips(t => t.map((x, j) => j === i ? { ...x, mileage: parseFloat(e.target.value) || 0 } : x))} /></div>
                <div className="space-y-1"><Label className="text-xs">Driver</Label><Input value={trip.driverName || ""} onChange={e => setTrips(t => t.map((x, j) => j === i ? { ...x, driverName: e.target.value } : x))} /></div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Incidents */}
      {incidents.length > 0 && (
        <Card className="border-l-4 border-l-destructive">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-destructive uppercase tracking-wide flex items-center gap-1.5"><AlertTriangle size={13} /> Detected Incidents ({incidents.length})</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {incidents.map((inc, i) => (
              <div key={i} className="rounded-md border border-destructive/30 p-3 space-y-2 text-xs bg-destructive/5">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Type</Label>
                    <Select value={inc.type} onValueChange={v => setIncidents(a => a.map((x, j) => j === i ? { ...x, type: v } : x))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{INCIDENT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Time</Label>
                    <Input type="time" value={inc.timeOfIncident || ""} onChange={e => setIncidents(a => a.map((x, j) => j === i ? { ...x, timeOfIncident: e.target.value } : x))} />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Description</Label>
                  <Textarea value={inc.description} rows={2} onChange={e => setIncidents(a => a.map((x, j) => j === i ? { ...x, description: e.target.value } : x))} />
                </div>
                <div className="flex flex-wrap gap-3 pt-1">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <Checkbox checked={inc.isCritical} onCheckedChange={v => setIncidents(a => a.map((x, j) => j === i ? { ...x, isCritical: !!v } : x))} />
                    <span className="text-xs font-medium text-destructive">Critical IR</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <Checkbox checked={inc.irSubmitted} onCheckedChange={v => setIncidents(a => a.map((x, j) => j === i ? { ...x, irSubmitted: !!v } : x))} />
                    <span className="text-xs">IR submitted</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <Checkbox checked={inc.notifiedGuardian} onCheckedChange={v => setIncidents(a => a.map((x, j) => j === i ? { ...x, notifiedGuardian: !!v } : x))} />
                    <span className="text-xs">Guardian notified</span>
                  </label>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Save */}
      <div className="flex gap-3 justify-end pb-8">
        <Button variant="outline" onClick={() => setStep("upload")}>← Back to Upload</Button>
        <Button onClick={handleSave} disabled={saveMutation.isPending} data-testid="btn-save-import-bottom">
          {saveMutation.isPending ? "Saving…" : "Save & Generate Reports"}
        </Button>
      </div>
    </div>
  );
}
