import { useState, useRef, useCallback } from "react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Upload, FileSpreadsheet, AlertTriangle, CheckCircle2,
  FileText, Printer, ChevronDown, ChevronUp, Download, ShieldAlert,
  RotateCcw, Save
} from "lucide-react";
import { processSpreadsheet, ClientReport, ReportRow } from "@/lib/reportProcessor";
import { generateClientDocx } from "@/lib/docxExporter";
import { saveAs } from "file-saver";
import { validateSpreadsheet, ValidationResult, EditableFields } from "@/lib/validator";
import { ValidationPanel } from "@/components/ValidationPanel";
import { WarningsPanel, ReviewWarning, buildReviewWarnings } from "@/components/WarningsPanel";
import { EditEntryDrawer } from "@/components/EditEntryDrawer";
import { saveSessionBackup, loadSessionBackup } from "@/lib/sessionBackup";
import { syncToDrive, checkDriveStatus, deriveHouseLabel, type DriveSyncResult } from "@/lib/driveSync";

// Pre-populated PIDs for known clients — any client not listed here defaults to blank
const KNOWN_PIDS: Record<string, string> = {
  "Brenton Broussard": "0410481480",
  "Parker Brady": "40637150",
  "Gavin Saiz": "",
  "Michael Hauser": "",
  "Seth Hall": "",
};

// Returns PIDs seeded from known list for clients found in data; others default to ""
function buildInitialPids(clientNames: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const name of clientNames) {
    result[name] = KNOWN_PIDS[name] ?? "";
  }
  return result;
}

// ─── FaleOfaz Logo SVG (house icon matching the PDF) ─────────────────────────
function FaleofazLogo({ size = 56 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="80" height="80" rx="8" fill="white" stroke="#e2e8f0" strokeWidth="1.5"/>
      {/* House shape */}
      <polygon points="40,10 70,35 65,35 65,68 15,68 15,35 10,35" fill="#1e3a5f" opacity="0.9"/>
      {/* Heart inside house */}
      <path d="M40 52 C40 52 28 43 28 36 C28 31 32 28 36 30 C38 31 40 34 40 34 C40 34 42 31 44 30 C48 28 52 31 52 36 C52 43 40 52 40 52Z" fill="white"/>
      {/* Door */}
      <rect x="34" y="54" width="12" height="14" rx="6" fill="white" opacity="0.9"/>
    </svg>
  );
}

// ─── Report page header (matches PDF header exactly) ─────────────────────────
function ReportPageHeader({ report, pid }: { report: ClientReport; pid: string }) {
  return (
    <div className="border border-slate-300 rounded-t-lg mb-0 bg-white px-6 py-4 flex items-center justify-between gap-4">
      <FaleofazLogo size={64} />
      <div className="text-center flex-1">
        <div className="font-bold text-slate-900 text-base">Fale Ofaz LLC</div>
        <div className="text-sm text-slate-700">Daily Reports: {report.month} | Code: {report.serviceCodes.join(", ")}</div>
        <div className="text-sm text-slate-700">| Client: {report.clientName} | Client Identification #: {pid || "—"} |</div>
        <div className="text-xs text-slate-500 mt-0.5">Time: AM: Morning | PM: Afternoon&amp;Evening | ON: Overnight</div>
      </div>
      <FaleofazLogo size={64} />
    </div>
  );
}

// ─── Single report row ────────────────────────────────────────────────────────
function ReportTableRow({ row }: { row: ReportRow }) {
  const isMTP    = row.rowType === "mtp";
  const isGraves = row.rowType === "rhs_on";
  const isAbove  = row.isAboveBaseline;
  const isThin   = row.thinSummary;

  const rowBg = isAbove
    ? "bg-orange-50"
    : isMTP
    ? "bg-blue-50/40"
    : isGraves
    ? "bg-slate-50/60"
    : isThin
    ? "bg-amber-50/60"
    : "bg-white";

  return (
    <tr className={`${rowBg} border-b border-slate-200 align-top`}>
      {/* Date */}
      <td className="px-3 py-2 border-r border-slate-200 whitespace-nowrap text-sm font-medium text-slate-800 w-24">
        {row.date}
      </td>
      {/* Code */}
      <td className="px-3 py-2 border-r border-slate-200 w-28">
        <span className={`text-sm font-semibold ${
          isMTP ? "text-blue-800" :
          isGraves ? "text-slate-600" :
          "text-slate-900"
        }`}>{row.code}</span>
      </td>
      {/* Staff */}
      <td className="px-3 py-2 border-r border-slate-200 w-44 text-sm text-slate-700">
        {row.staffOnDuty}
      </td>
      {/* Behavior/Activity */}
      <td className="px-3 py-2 text-sm text-slate-800">
        {row.activities.length > 0 && (
          <div className="mb-1">
            {row.activities.map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>
        )}
        {row.narrative && (
          <div className={isAbove ? "text-orange-900" : ""}>
            {row.narrative.split("\n\n").map((p, i) => (
              <p key={i} className={i > 0 ? "mt-1" : ""}>{p.trim()}</p>
            ))}
          </div>
        )}
        {isThin && (
          <div className="mt-1 flex items-center gap-1 text-amber-700 text-xs font-medium">
            <span>⚠</span>
            <span>Behavior summary needs more detail — staff should expand this note.</span>
          </div>
        )}
        {row.irSubmitted && (
          <div className="mt-1 text-red-700 text-xs font-medium">IR report submitted.</div>
        )}
      </td>
    </tr>
  );
}

// ─── Full client report table (matches PDF layout) ───────────────────────────
function ClientReportTable({
  report,
  pid,
  onExportDocx,
  exporting,
}: {
  report: ClientReport;
  pid: string;
  onExportDocx: () => void;
  exporting: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const incidentRows = report.rows.filter(r => r.irSubmitted);
  const aboveRows = report.rows.filter(r => r.isAboveBaseline);

  return (
    <div className="mb-10 print:mb-6 print:break-before-page" id={`report-${report.clientInitials}`}>
      {/* Action bar (screen only) */}
      <div className="print:hidden flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-slate-800">{report.clientName}</span>
          {incidentRows.length > 0 && (
            <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full font-medium">
              {incidentRows.length} IR
            </span>
          )}
          {aboveRows.length > 0 && (
            <span className="bg-orange-100 text-orange-700 text-xs px-2 py-0.5 rounded-full font-medium">
              ⚠ {aboveRows.length} above baseline
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onExportDocx}
            disabled={exporting}
            data-testid={`btn-docx-${report.clientInitials}`}
            className="text-xs text-slate-400 hover:text-[hsl(var(--primary))] flex items-center gap-1 transition-colors disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5" />
            {exporting ? "Exporting…" : ".docx"}
          </button>
          <span className="text-slate-200 select-none">|</span>
          <button
            onClick={() => setCollapsed(c => !c)}
            className="text-slate-400 hover:text-slate-700 transition-colors"
            data-testid={`collapse-${report.clientInitials}`}
          >
            {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="border border-slate-300 rounded-lg overflow-hidden shadow-sm print:shadow-none print:rounded-none print:border-slate-400">
          {/* PDF-style header */}
          <ReportPageHeader report={report} pid={pid} />

          {/* Table */}
          <table className="w-full border-collapse text-sm">
            {/* Yellow header row */}
            <thead>
              <tr style={{ backgroundColor: "#FACC15" }}>
                <th className="text-left px-3 py-2 font-bold text-slate-900 w-24 border border-yellow-500">Date</th>
                <th className="text-left px-3 py-2 font-bold text-slate-900 w-28 border border-yellow-500">Code</th>
                <th className="text-left px-3 py-2 font-bold text-slate-900 w-44 border border-yellow-500">Staff on duty</th>
                <th className="text-left px-3 py-2 font-bold text-slate-900 border border-yellow-500">Behavior/Activity</th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map((row, i) => (
                <ReportTableRow key={i} row={row} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function AutoReport() {
  const [reports, setReports] = useState<ClientReport[]>([]);
  const [pids, setPids] = useState<Record<string, string>>({});
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [showPidEdit, setShowPidEdit] = useState(false);
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [exportingDocx, setExportingDocx] = useState<string | null>(null);
  // Validation state
  const [rawData, setRawData] = useState<any[][] | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [stage, setStage] = useState<"upload" | "validate" | "reports">("upload");
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Review warnings state
  const [reviewWarnings, setReviewWarnings] = useState<ReviewWarning[]>([]);
  const [editingWarning, setEditingWarning] = useState<ReviewWarning | null>(null);
  // Export confirmation dialog
  const [showExportConfirm, setShowExportConfirm] = useState<"docx" | "excel" | "print" | null>(null);
  // Backup / restore
  const [restoreError, setRestoreError] = useState("");
  const [lastBackupTime, setLastBackupTime] = useState<string | null>(null);
  const [isRestoringDrag, setIsRestoringDrag] = useState(false);
  const restoreInputRef = useRef<HTMLInputElement>(null);
  // Drive sync status
  const [driveSync, setDriveSync] = useState<{ status: "idle" | "syncing" | "ok" | "error"; fileName?: string; error?: string }>({
    status: "idle",
  });

  const processFile = useCallback(async (file: File) => {
    setError("");
    setLoading(true);
    setReports([]);
    setValidationResult(null);
    setRawData(null);
    setStage("upload");
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array", cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data: any[][] = XLSX.utils.sheet_to_json(ws, {
        header: 1,
        raw: true,
        cellDates: true,
      });
      // Run validation first
      const vResult = validateSpreadsheet(data, pids);
      setRawData(data);
      setFileName(file.name);
      setValidationResult(vResult);
      // Seed PIDs for clients found in this file
      if (vResult.clientsFound.length > 0) {
        setPids(prev => ({
          ...buildInitialPids(vResult.clientsFound),
          ...prev, // keep any PIDs the user already entered this session
        }));
      }
      // If no errors, go directly to reports (warnings will appear in review panel)
      if (vResult.errorCount === 0) {
        generateReports(data, vResult);
      } else {
        setStage("validate");
      }
    } catch (e: any) {
      setError("Could not read file: " + (e?.message || String(e)));
    } finally {
      setLoading(false);
    }
  }, [pids]);

  const generateReports = useCallback((data: any[][], vResult?: ValidationResult) => {
    const { reports: result } = processSpreadsheet(data);
    if (result.length === 0) {
      setError("No client data found. Make sure the file uses the standard FaleOfaz/Cherry tracking format.");
      setStage("upload");
      return;
    }
    const builtWarnings = vResult ? buildReviewWarnings(vResult.issues) : [];
    setReports(result);
    setSelectedClients(result.map(r => r.clientName));
    setReviewWarnings(builtWarnings);
    setStage("reports");
    // Auto-save local backup + Drive sync immediately after a successful process
    setTimeout(async () => {
      const clientList = result.map(r => r.clientName);
      const allRows    = result.flatMap(r => r.rows);
      const savedAt    = new Date().toISOString();

      // 1. Local .json download (best-effort)
      try {
        saveSessionBackup(fileName || "FO_Session", allRows, builtWarnings, clientList);
        setLastBackupTime(new Date().toLocaleTimeString());
      } catch { /* ignore */ }

      // 2. Google Drive auto-sync (fire-and-forget, never blocks UI)
      const house = deriveHouseLabel(fileName || "House");
      const month = allRows[0]?.date?.slice(0, 7) || new Date().toISOString().slice(0, 7);
      setDriveSync({ status: "syncing" });
      const driveResult = await syncToDrive({
        house, month,
        fileName: fileName || "FO_Session",
        rows: allRows,
        warnings: builtWarnings,
        clientList,
        savedAt,
      });
      if (driveResult?.ok) {
        setDriveSync({ status: "ok", fileName: driveResult.driveFileName });
      } else {
        setDriveSync({ status: "error", error: driveResult?.error || "Drive sync failed" });
      }
    }, 400);
  }, [fileName]);

  const handleProceedFromValidation = useCallback(() => {
    if (rawData) generateReports(rawData, validationResult ?? undefined);
  }, [rawData, validationResult, generateReports]);

  const handleReset = useCallback(() => {
    setReports([]);
    setFileName("");
    setError("");
    setRawData(null);
    setValidationResult(null);
    setStage("upload");
    setReviewWarnings([]);
    setEditingWarning(null);
    setShowExportConfirm(null);
  }, []);

  // ── Backup / restore handlers ──────────────────────────────────────────
  const handleManualBackup = useCallback(async () => {
    if (!reports.length) return;
    const clientList = reports.map(r => r.clientName);
    const allRows    = reports.flatMap(r => r.rows);
    const savedAt    = new Date().toISOString();

    // Local backup
    try {
      saveSessionBackup(fileName || "FO_Session", allRows, reviewWarnings, clientList);
      setLastBackupTime(new Date().toLocaleTimeString());
    } catch (e: any) {
      setError("Local backup failed: " + (e?.message || String(e)));
    }

    // Drive sync
    const house = deriveHouseLabel(fileName || "House");
    const month = allRows[0]?.date?.slice(0, 7) || new Date().toISOString().slice(0, 7);
    setDriveSync({ status: "syncing" });
    const driveResult = await syncToDrive({
      house, month,
      fileName: fileName || "FO_Session",
      rows: allRows,
      warnings: reviewWarnings,
      clientList,
      savedAt,
    });
    if (driveResult?.ok) {
      setDriveSync({ status: "ok", fileName: driveResult.driveFileName });
    } else {
      setDriveSync({ status: "error", error: driveResult?.error || "Drive sync failed" });
    }
  }, [reports, fileName, reviewWarnings]);

  const handleRestoreFile = useCallback(async (file: File) => {
    setRestoreError("");
    try {
      const backup = await loadSessionBackup(file);
      // Reconstruct ClientReport[] from flat rows by grouping on clientName
      const grouped: Record<string, ClientReport> = {};
      for (const row of backup.rows) {
        if (!grouped[row.clientName]) {
          grouped[row.clientName] = {
            clientName: row.clientName,
            clientInitials: row.clientName.split(" ").map((p: string) => p[0]).join(""),
            month: row.date ? row.date.slice(0, 7) : "",
            rows: [],
            serviceCodes: [],
            hasIR: false,
          };
        }
        grouped[row.clientName].rows.push(row);
        if (row.irSubmitted) grouped[row.clientName].hasIR = true;
        const code = row.code;
        if (code && !grouped[row.clientName].serviceCodes.includes(code)) {
          grouped[row.clientName].serviceCodes.push(code);
        }
      }
      const restored = Object.values(grouped);
      setReports(restored);
      setSelectedClients(restored.map(r => r.clientName));
      setReviewWarnings(backup.warnings);
      setFileName(backup.fileName);
      setLastBackupTime(new Date(backup.savedAt).toLocaleTimeString());
      setStage("reports");
    } catch (e: any) {
      setRestoreError(e?.message || "Could not restore session.");
    }
  }, []);

  // ── Warning review handlers ──────────────────────────────────────────────
  const handleMarkResolved = useCallback((id: string) => {
    setReviewWarnings(prev =>
      prev.map(w => w.id === id ? { ...w, resolved: !w.resolved } : w)
    );
  }, []);

  const handleSaveWarningEdit = useCallback((id: string, fields: EditableFields) => {
    // Update the warning's editableFields and mark it resolved
    setReviewWarnings(prev =>
      prev.map(w =>
        w.id === id
          ? { ...w, editableFields: { ...(w.editableFields ?? {}), ...fields }, resolved: true }
          : w
      )
    );
    // Sync edits back into the live report rows for that client/date/code
    const warning = reviewWarnings.find(w => w.id === id);
    if (warning?.clientName && fields) {
      setReports(prev => prev.map(report => {
        if (report.clientName !== warning.clientName) return report;
        return {
          ...report,
          rows: report.rows.map(row => {
            if (row.date !== warning.date || row.code !== warning.serviceCode) return row;
            const updatedActivities = fields.activities
              ? fields.activities.split("\n").map(l => l.trim()).filter(Boolean).map(l =>
                  l.startsWith("-") ? l : "-" + l
                )
              : row.activities;
            const updatedNarrative = fields.narrative !== undefined ? fields.narrative : row.narrative;
            const actLen = updatedActivities.length;
            const narLen = updatedNarrative.length;
            return {
              ...row,
              activities: updatedActivities,
              narrative: updatedNarrative,
              thinSummary: actLen >= 3 && narLen < 60,
            };
          }),
        };
      }));
    }
  }, [reviewWarnings]);

  const unresolvedWarningCount = reviewWarnings.filter(w => !w.resolved).length;

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = "";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const handleExportSingleDocx = async (report: ClientReport) => {
    setExportingDocx(report.clientName);
    try {
      const blob = await generateClientDocx(report, pids[report.clientName] || "");
      const safeName = report.clientName.replace(/ /g, "_");
      const safeDate = report.dateRange.replace(/[^a-zA-Z0-9]/g, "_");
      saveAs(blob, `FaleOfaz_${safeName}_${safeDate}.docx`);
    } catch (e: any) {
      setError("Word export error: " + (e?.message || String(e)));
    }
    setExportingDocx(null);
  };

  const doExportAllDocx = async () => {
    const toExport = reports.filter(r => selectedClients.includes(r.clientName));
    for (const report of toExport) {
      await handleExportSingleDocx(report);
      await new Promise(r => setTimeout(r, 300));
    }
  };

  const handleExportAllDocx = () => {
    if (unresolvedWarningCount > 0) { setShowExportConfirm("docx"); return; }
    doExportAllDocx();
  };

  const handleExportExcel = () => {
    if (unresolvedWarningCount > 0) { setShowExportConfirm("excel"); return; }
    doExportExcel();
  };

  const doExportExcel = () => {
    if (!reports.length) return;
    const wb = XLSX.utils.book_new();
    for (const report of reports.filter(r => selectedClients.includes(r.clientName))) {
      const rows = report.rows.map(row => ({
        Date: row.date,
        Code: row.code,
        "Staff on Duty": row.staffOnDuty,
        Activities: row.activities.join("; "),
        "Behavior/Narrative": row.narrative,
        "Above Baseline": row.isAboveBaseline ? "Yes" : "No",
        "IR Filed": row.irSubmitted ? "Yes" : "No",
        "IR Summary": row.irSummary,
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      // Auto-size columns
      ws["!cols"] = [
        { wch: 12 }, { wch: 14 }, { wch: 22 }, { wch: 40 }, { wch: 60 }, { wch: 14 }, { wch: 10 }, { wch: 40 },
      ];
      XLSX.utils.book_append_sheet(wb, ws, report.clientInitials.slice(0, 31));
    }
    XLSX.writeFile(wb, `FaleOfaz_Reports_${fileName.replace(/\.(xlsx?|csv)/i, "")}.xlsx`);
  };

  const handleExportCSV = () => {
    if (!reports.length) return;
    const allRows: any[] = [];
    for (const report of reports.filter(r => selectedClients.includes(r.clientName))) {
      for (const row of report.rows) {
        allRows.push({
          Client: report.clientName,
          "Client ID": pids[report.clientName] || "",
          Date: row.date,
          Code: row.code,
          "Staff on Duty": row.staffOnDuty,
          Activities: row.activities.join("; "),
          "Behavior/Narrative": row.narrative,
          "Above Baseline": row.isAboveBaseline ? "Yes" : "No",
          "IR Filed": row.irSubmitted ? "Yes" : "No",
          "IR Summary": row.irSummary,
        });
      }
    }
    const ws = XLSX.utils.json_to_sheet(allRows);
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    saveAs(blob, `FaleOfaz_Reports_${fileName.replace(/\.(xlsx?|csv)/i, "")}.csv`);
  };

  const visibleReports = reports.filter(r => selectedClients.includes(r.clientName));

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 print:px-0 print:py-0 print:max-w-none">

      {/* Page title — hidden when printing */}
      <div className="print:hidden mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Upload &amp; Organize Notes</h1>
        <p className="text-slate-500 text-sm mt-1">
          Upload your Excel tracking file. Raw notes are automatically organized, audited, and formatted into DSPD-compliant daily reports for each client, ready to export as Word or PDF.
        </p>
      </div>

      {/* Upload zone */}
      {stage === "upload" && (
        <div className="print:hidden">
          <div
            className={`border-2 border-dashed rounded-2xl p-16 text-center cursor-pointer transition-all select-none ${
              isDragging
                ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.04)] scale-[1.01]"
                : "border-slate-300 hover:border-[hsl(var(--primary))] hover:bg-slate-50"
            }`}
            onDrop={onDrop}
            onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onClick={() => fileInputRef.current?.click()}
            data-testid="drop-zone"
          >
            <div className="flex justify-center mb-5">
              <div className="w-20 h-20 rounded-2xl bg-[hsl(var(--primary)/0.08)] flex items-center justify-center">
                <FileSpreadsheet className="w-10 h-10 text-[hsl(var(--primary))]" />
              </div>
            </div>
            <p className="text-xl font-semibold text-slate-800 mb-2">
              {loading ? "Processing your file…" : "Drop your Excel file here"}
            </p>
            <p className="text-slate-500 mb-6 text-sm">
              Accepts .xlsx or .xls files exported from your Cherry / Bamboo tracking system
            </p>
            <Button variant="outline" className="pointer-events-none px-6">
              <Upload className="w-4 h-4 mr-2" /> Browse Files
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={onFileChange}
              data-testid="file-input"
            />
          </div>

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {loading && (
            <div className="mt-6 flex flex-col items-center gap-3 text-slate-500 text-sm">
              <div className="w-8 h-8 border-3 border-[hsl(var(--primary))] border-t-transparent rounded-full animate-spin" />
              Reading spreadsheet and generating reports…
            </div>
          )}

          {/* — Restore session zone — */}
          {!loading && (
            <div className="mt-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="flex-1 h-px bg-slate-200" />
                <span className="text-xs text-slate-400 font-medium uppercase tracking-wide">or restore a saved session</span>
                <div className="flex-1 h-px bg-slate-200" />
              </div>
              <div
                className={`border-2 border-dashed rounded-xl px-6 py-5 text-center cursor-pointer transition-all select-none ${
                  isRestoringDrag
                    ? "border-emerald-400 bg-emerald-50"
                    : "border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/40"
                }`}
                onDrop={async e => {
                  e.preventDefault();
                  setIsRestoringDrag(false);
                  const file = e.dataTransfer.files[0];
                  if (file) await handleRestoreFile(file);
                }}
                onDragOver={e => { e.preventDefault(); setIsRestoringDrag(true); }}
                onDragLeave={() => setIsRestoringDrag(false)}
                onClick={() => restoreInputRef.current?.click()}
              >
                <div className="flex items-center justify-center gap-2.5 text-sm text-slate-500">
                  <RotateCcw className="w-4 h-4 text-emerald-600" />
                  <span>Drop a <span className="font-semibold text-emerald-700">FO_Backup_…json</span> file here, or <span className="text-emerald-700 underline">browse</span></span>
                </div>
                {restoreError && (
                  <p className="mt-2 text-xs text-red-600 font-medium">{restoreError}</p>
                )}
              </div>
              <input
                ref={restoreInputRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={async e => {
                  const file = e.target.files?.[0];
                  if (file) await handleRestoreFile(file);
                  e.target.value = "";
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* Validation stage */}
      {stage === "validate" && validationResult && (
        <div className="print:hidden">
          {/* File info bar */}
          <div className="mb-4 flex items-center gap-3 text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
            <FileSpreadsheet className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="font-medium text-slate-800">{fileName}</span>
            <span className="text-slate-400">·</span>
            <span>{validationResult.rowsChecked} rows · {validationResult.clientsFound.length} clients</span>
          </div>
          <ValidationPanel
            result={validationResult}
            onProceed={handleProceedFromValidation}
            onReupload={handleReset}
            onOpenPidEditor={() => setShowPidEdit(true)}
          />
          {/* PID editor (shown inline if opened from validation panel) */}
          {showPidEdit && (
            <div className="mb-5 bg-white border border-slate-200 rounded-xl p-5">
              <h3 className="font-semibold text-slate-800 mb-3 text-sm">Client Identification Numbers</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {validationResult.clientsFound.map(clientName => (
                  <div key={clientName}>
                    <Label className="text-xs text-slate-500 mb-1 block">{clientName}</Label>
                    <Input
                      value={pids[clientName] || ""}
                      onChange={e => setPids(p => ({ ...p, [clientName]: e.target.value }))}
                      placeholder="Enter PID…"
                      className={`h-8 text-sm ${
                        !pids[clientName] ? "border-amber-300 focus:ring-amber-400" : ""
                      }`}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Results */}
      {stage === "reports" && reports.length > 0 && (
        <>
          {/* ── File info bar ── */}
          <div className="print:hidden mb-4 flex items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl px-5 py-3 shadow-sm">
            <div className="flex items-center gap-3 min-w-0">
              <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
              <div className="min-w-0">
                <div className="font-semibold text-slate-900 text-sm flex items-center gap-2 flex-wrap">
                  <span className="truncate max-w-xs">{fileName}</span>
                  <span className="text-slate-400 font-normal">·</span>
                  <span className="text-slate-600 font-normal">{reports.length} clients · {reports.reduce((s, r) => s + r.rows.length, 0)} rows</span>
                  {unresolvedWarningCount > 0 ? (
                    <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> {unresolvedWarningCount} to review
                    </span>
                  ) : reviewWarnings.length > 0 ? (
                    <span className="text-xs font-normal text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> All reviewed
                    </span>
                  ) : (
                    <span className="text-xs font-normal text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> No issues
                    </span>
                  )}
                </div>
                <button className="text-xs text-[hsl(var(--primary))] hover:underline mt-0.5" onClick={handleReset}>
                  Upload a different file
                </button>
              </div>
            </div>
            <Button size="sm" variant="ghost" className="h-8 text-xs shrink-0" onClick={() => setShowPidEdit(v => !v)}>
              Edit Client IDs
            </Button>
          </div>

          {/* ── Export panel ── */}
          <div className="print:hidden mb-5 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
              <Download className="w-4 h-4 text-slate-500" />
              <span className="text-sm font-semibold text-slate-800">Export Reports</span>
              <span className="text-xs text-slate-400 ml-1">
                {selectedClients.length === reports.length
                  ? `All ${reports.length} clients`
                  : `${selectedClients.length} of ${reports.length} clients selected`}
              </span>
              {/* Drive sync badge + Save backup button */}
              <div className="ml-auto flex items-center gap-2">
                {/* Drive sync status */}
                {driveSync.status === "syncing" && (
                  <span className="text-xs text-blue-500 font-medium flex items-center gap-1">
                    <div className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                    Syncing to Drive…
                  </span>
                )}
                {driveSync.status === "ok" && (
                  <span
                    className="text-xs text-emerald-600 font-medium flex items-center gap-1"
                    title={`Saved to Drive as ${driveSync.fileName}`}
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    Drive synced
                  </span>
                )}
                {driveSync.status === "error" && (
                  <span
                    className="text-xs text-amber-600 font-medium flex items-center gap-1"
                    title={driveSync.error}
                  >
                    <AlertTriangle className="w-3 h-3" />
                    Drive unavailable
                  </span>
                )}
                {lastBackupTime && (
                  <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
                    <Save className="w-3 h-3" />
                    Local {lastBackupTime}
                  </span>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleManualBackup}
                  className="h-7 text-xs gap-1.5 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                >
                  <Save className="w-3.5 h-3.5" /> Save backup
                </Button>
              </div>
            </div>
            <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Word / .docx */}
              <button
                onClick={handleExportAllDocx}
                disabled={!!exportingDocx || selectedClients.length === 0}
                data-testid="btn-export-all-docx"
                className="group flex items-center gap-4 rounded-lg border border-slate-200 px-4 py-3.5 text-left hover:border-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.03)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="w-9 h-9 rounded-lg bg-blue-50 group-hover:bg-blue-100 flex items-center justify-center shrink-0 transition-colors">
                  <FileText className="w-5 h-5 text-blue-700" />
                </div>
                <div>
                  <div className="font-semibold text-slate-800 text-sm">
                    {exportingDocx ? "Exporting…" : "Word (.docx)"}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">One file per client, formatted daily report</div>
                </div>
              </button>

              {/* Excel */}
              <button
                onClick={handleExportExcel}
                disabled={selectedClients.length === 0}
                data-testid="btn-export-excel"
                className="group flex items-center gap-4 rounded-lg border border-slate-200 px-4 py-3.5 text-left hover:border-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.03)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="w-9 h-9 rounded-lg bg-green-50 group-hover:bg-green-100 flex items-center justify-center shrink-0 transition-colors">
                  <FileSpreadsheet className="w-5 h-5 text-green-700" />
                </div>
                <div>
                  <div className="font-semibold text-slate-800 text-sm">Excel (.xlsx)</div>
                  <div className="text-xs text-slate-500 mt-0.5">All clients in one spreadsheet</div>
                </div>
              </button>

              {/* Print / PDF */}
              <button
                onClick={() => {
                  if (unresolvedWarningCount > 0) { setShowExportConfirm("print"); return; }
                  window.print();
                }}
                data-testid="btn-print"
                className="group flex items-center gap-4 rounded-lg border border-slate-200 px-4 py-3.5 text-left hover:border-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.03)] transition-all"
              >
                <div className="w-9 h-9 rounded-lg bg-slate-100 group-hover:bg-slate-200 flex items-center justify-center shrink-0 transition-colors">
                  <Printer className="w-5 h-5 text-slate-600" />
                </div>
                <div>
                  <div className="font-semibold text-slate-800 text-sm">Print / PDF</div>
                  <div className="text-xs text-slate-500 mt-0.5">Print or save as PDF via browser</div>
                </div>
              </button>
            </div>
          </div>

          {/* ── Warnings to Review ── */}
          <div data-panel="warnings">
          <WarningsPanel
            warnings={reviewWarnings}
            onEdit={w => setEditingWarning(w)}
            onMarkResolved={handleMarkResolved}
          />
          </div>

          {/* ── Export confirmation dialog ── */}
          {showExportConfirm && (
            <div className="print:hidden fixed inset-0 bg-black/40 z-30 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                    <ShieldAlert className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 text-base">Unresolved warnings</h3>
                    <p className="text-sm text-slate-600 mt-1">
                      You still have <strong>{unresolvedWarningCount} {unresolvedWarningCount === 1 ? "entry" : "entries"}</strong> that may need wording, formatting, or missing-data review.
                    </p>
                    <p className="text-sm text-slate-600 mt-1">
                      Resolve them first for audit-ready reports, or export anyway.
                    </p>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => {
                      setShowExportConfirm(null);
                      // Scroll to warnings
                      document.querySelector('[data-panel="warnings"]')?.scrollIntoView({ behavior: "smooth" });
                    }}
                    className="w-full py-2.5 rounded-lg bg-[hsl(var(--primary))] text-white text-sm font-semibold hover:bg-[hsl(var(--primary)/0.9)] transition-all"
                  >
                    Resolve before export
                  </button>
                  <button
                    onClick={() => {
                      const type = showExportConfirm;
                      setShowExportConfirm(null);
                      if (type === "docx") doExportAllDocx();
                      else if (type === "excel") doExportExcel();
                      else if (type === "print") window.print();
                    }}
                    className="w-full py-2.5 rounded-lg border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-all"
                  >
                    Export anyway
                  </button>
                  <button
                    onClick={() => setShowExportConfirm(null)}
                    className="text-xs text-slate-400 hover:text-slate-600 py-1 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Edit entry drawer ── */}
          <EditEntryDrawer
            warning={editingWarning}
            warnings={reviewWarnings.filter(w => !!w.editableFields)}
            onSave={handleSaveWarningEdit}
            onClose={() => setEditingWarning(null)}
            onNavigate={id => {
              const w = reviewWarnings.find(w => w.id === id);
              if (w) setEditingWarning(w);
            }}
          />

          {/* PID editor */}
          {showPidEdit && (
            <div className="print:hidden mb-5 bg-white border border-slate-200 rounded-xl p-5">
              <h3 className="font-semibold text-slate-800 mb-3 text-sm">Client Identification Numbers</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {reports.map(r => (
                  <div key={r.clientName}>
                    <Label className="text-xs text-slate-500 mb-1 block">{r.clientName}</Label>
                    <Input
                      value={pids[r.clientName] || ""}
                      onChange={e => setPids(p => ({ ...p, [r.clientName]: e.target.value }))}
                      placeholder="Enter PID…"
                      className="h-8 text-sm"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Client selector */}
          <div className="print:hidden mb-5 flex flex-wrap gap-2 items-center">
            <span className="text-xs text-slate-500 font-medium uppercase tracking-wide mr-1">Show:</span>
            {reports.map(r => {
              const active = selectedClients.includes(r.clientName);
              const hasIR = r.rows.some(row => row.irSubmitted);
              return (
                <button
                  key={r.clientName}
                  onClick={() => setSelectedClients(prev =>
                    prev.includes(r.clientName)
                      ? prev.filter(c => c !== r.clientName)
                      : [...prev, r.clientName]
                  )}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                    active
                      ? "bg-[hsl(var(--primary))] text-white border-[hsl(var(--primary))]"
                      : "bg-white text-slate-600 border-slate-300 hover:border-[hsl(var(--primary))]"
                  }`}
                  data-testid={`toggle-${r.clientInitials}`}
                >
                  {r.clientName.split(" ").map(w => w[0]).join(".")} {r.clientName.split(" ")[0]}
                  {hasIR && <span className="ml-1.5 bg-red-500 text-white text-xs px-1.5 rounded-full">IR</span>}
                </button>
              );
            })}
          </div>

          {/* Per-client report tables */}
          {visibleReports.map(report => (
            <ClientReportTable
              key={report.clientName}
              report={report}
              pid={pids[report.clientName] || ""}
              onExportDocx={() => handleExportSingleDocx(report)}
              exporting={exportingDocx === report.clientName}
            />
          ))}
        </>
      )}
    </div>
  );
}
