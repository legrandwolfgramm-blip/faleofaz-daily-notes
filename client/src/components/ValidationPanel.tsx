/**
 * ValidationPanel.tsx
 * Displays pre-generation validation results with grouped issues,
 * severity badges, and a "Generate Anyway" escape hatch for warnings.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2, AlertTriangle, XCircle, Info,
  ChevronDown, ChevronUp, ArrowRight, RefreshCw,
} from "lucide-react";
import type { ValidationResult, ValidationIssue, IssueCategory, IssueSeverity } from "@/lib/validator";

// ─── Category labels ──────────────────────────────────────────────────────────
const CATEGORY_LABELS: Record<IssueCategory, string> = {
  missing_service_code:    "Missing Service Codes",
  incomplete_shift:        "Incomplete Shift Entries",
  unmatched_client_id:     "Missing Client IDs (PIDs)",
  orphaned_client_data:    "Unmatched Client Data",
  ir_no_summary:           "IR Filed Without Summary",
  thin_behavior_summary:   "Incomplete Behavior Summary",
  meds_explanation_missing:"Medication Notes Missing",
  no_client_data:          "No Client Data Found",
  unknown_shift:           "Unknown Shift Type",
  date_mismatch:           "Date Issues",
  file_structure:          "File Structure",
};

// ─── Severity styles ──────────────────────────────────────────────────────────
const SEV_STYLES: Record<IssueSeverity, {
  icon: React.ReactNode;
  bg: string;
  border: string;
  text: string;
  badge: string;
}> = {
  error: {
    icon: <XCircle className="w-4 h-4 text-red-600" />,
    bg: "bg-red-50",
    border: "border-red-200",
    text: "text-red-800",
    badge: "bg-red-100 text-red-700 border border-red-200",
  },
  warning: {
    icon: <AlertTriangle className="w-4 h-4 text-amber-500" />,
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-800",
    badge: "bg-amber-100 text-amber-700 border border-amber-200",
  },
  info: {
    icon: <Info className="w-4 h-4 text-blue-500" />,
    bg: "bg-blue-50",
    border: "border-blue-200",
    text: "text-blue-800",
    badge: "bg-blue-100 text-blue-700 border border-blue-200",
  },
};

// ─── Summary bar ──────────────────────────────────────────────────────────────
function SummaryBar({ result }: { result: ValidationResult }) {
  if (result.errorCount === 0 && result.warningCount === 0 && result.infoCount === 0) {
    return (
      <div className="flex items-center gap-3 px-5 py-4 bg-green-50 border border-green-200 rounded-xl">
        <CheckCircle2 className="w-6 h-6 text-green-600 shrink-0" />
        <div>
          <p className="font-semibold text-green-800">All checks passed</p>
          <p className="text-sm text-green-700">
            {result.rowsChecked} rows checked · {result.clientsFound.length} clients found · No issues detected
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-wrap items-center gap-4 px-5 py-4 rounded-xl border ${
      result.errorCount > 0
        ? "bg-red-50 border-red-200"
        : "bg-amber-50 border-amber-200"
    }`}>
      <div className="flex items-center gap-2">
        {result.errorCount > 0
          ? <XCircle className="w-6 h-6 text-red-600" />
          : <AlertTriangle className="w-6 h-6 text-amber-500" />}
        <div>
          <p className={`font-semibold ${result.errorCount > 0 ? "text-red-800" : "text-amber-800"}`}>
            {result.errorCount > 0
              ? `${result.errorCount} error${result.errorCount !== 1 ? "s" : ""} must be resolved`
              : `${result.warningCount} warning${result.warningCount !== 1 ? "s" : ""} found`}
          </p>
          <p className="text-sm text-slate-600">
            {result.rowsChecked} rows checked · {result.clientsFound.length} clients found
          </p>
        </div>
      </div>
      <div className="flex gap-2 ml-auto flex-wrap">
        {result.errorCount > 0 && (
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-red-100 text-red-700 border border-red-200">
            {result.errorCount} Error{result.errorCount !== 1 ? "s" : ""}
          </span>
        )}
        {result.warningCount > 0 && (
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
            {result.warningCount} Warning{result.warningCount !== 1 ? "s" : ""}
          </span>
        )}
        {result.infoCount > 0 && (
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 border border-blue-200">
            {result.infoCount} Notice{result.infoCount !== 1 ? "s" : ""}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Issue row ────────────────────────────────────────────────────────────────
function IssueRow({ issue }: { issue: ValidationIssue }) {
  const sev = SEV_STYLES[issue.severity];
  return (
    <div className={`flex items-start gap-3 px-4 py-3 border-b last:border-0 ${sev.bg}`}>
      <span className="mt-0.5 shrink-0">{sev.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-0.5">
          {issue.rowNumber && (
            <span className="text-xs font-mono text-slate-500">Row {issue.rowNumber}</span>
          )}
          <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${sev.badge}`}>
            {issue.field}
          </span>
        </div>
        <p className={`text-sm ${sev.text}`}>{issue.message}</p>
        {issue.suggestion && (
          <p className="text-xs text-slate-500 mt-0.5 flex items-start gap-1">
            <ArrowRight className="w-3 h-3 mt-0.5 shrink-0 text-slate-400" />
            {issue.suggestion}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Category group ───────────────────────────────────────────────────────────
function IssueGroup({
  category,
  issues,
}: {
  category: IssueCategory;
  issues: ValidationIssue[];
}) {
  const [open, setOpen] = useState(true);
  const hasErrors   = issues.some(i => i.severity === "error");
  const hasWarnings = issues.some(i => i.severity === "warning");
  const headerColor = hasErrors
    ? "bg-red-100 border-red-200 text-red-800"
    : hasWarnings
    ? "bg-amber-100 border-amber-200 text-amber-800"
    : "bg-blue-100 border-blue-200 text-blue-800";

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden mb-2">
      <button
        className={`w-full flex items-center justify-between px-4 py-2.5 text-left text-sm font-semibold border-b ${headerColor}`}
        onClick={() => setOpen(o => !o)}
      >
        <span>{CATEGORY_LABELS[category]} ({issues.length})</span>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {open && (
        <div>
          {issues.map((issue, i) => (
            <IssueRow key={i} issue={issue} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
interface ValidationPanelProps {
  result: ValidationResult;
  onProceed: () => void;         // user clicks "Generate Reports"
  onReupload: () => void;        // user clicks "Upload Different File"
  onOpenPidEditor: () => void;   // user clicks "Enter Client IDs"
}

export function ValidationPanel({
  result,
  onProceed,
  onReupload,
  onOpenPidEditor,
}: ValidationPanelProps) {
  const [showAll, setShowAll] = useState(false);

  // Group issues by category (exclude info-only PID notices from main list unless showAll)
  const grouped = new Map<IssueCategory, ValidationIssue[]>();
  const filteredIssues = showAll
    ? result.issues
    : result.issues.filter(i => i.severity !== "info");

  for (const issue of filteredIssues) {
    if (!grouped.has(issue.category)) grouped.set(issue.category, []);
    grouped.get(issue.category)!.push(issue);
  }

  const hasAnyIssue = result.errorCount > 0 || result.warningCount > 0 || result.infoCount > 0;
  const allGood = !hasAnyIssue;

  return (
    <div className="mb-6">
      {/* Summary bar */}
      <SummaryBar result={result} />

      {/* Issue groups */}
      {grouped.size > 0 && (
        <div className="mt-4">
          {[...grouped.entries()].map(([cat, issues]) => (
            <IssueGroup key={cat} category={cat} issues={issues} />
          ))}

          {/* Toggle info notices */}
          {result.infoCount > 0 && (
            <button
              className="text-xs text-slate-500 hover:text-slate-700 mt-1 flex items-center gap-1"
              onClick={() => setShowAll(v => !v)}
            >
              <Info className="w-3 h-3" />
              {showAll
                ? "Hide informational notices"
                : `Show ${result.infoCount} informational notice${result.infoCount !== 1 ? "s" : ""}`}
            </button>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="mt-4 flex flex-wrap gap-3 items-center">
        {/* Always show "Generate Reports" — disabled only on hard errors */}
        <Button
          onClick={onProceed}
          disabled={result.errorCount > 0}
          data-testid="btn-generate-reports"
          className="gap-2"
        >
          <CheckCircle2 className="w-4 h-4" />
          {allGood
            ? "Generate Reports"
            : result.errorCount > 0
            ? "Fix Errors to Continue"
            : "Generate Reports Anyway"}
        </Button>

        {/* Enter client IDs shortcut if PIDs are missing */}
        {result.missingPids.length > 0 && (
          <Button
            variant="outline"
            onClick={onOpenPidEditor}
            className="gap-2"
            data-testid="btn-open-pid-editor"
          >
            Enter Client IDs ({result.missingPids.length})
          </Button>
        )}

        <Button
          variant="ghost"
          onClick={onReupload}
          className="gap-2 text-slate-500"
          data-testid="btn-reupload"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Upload Different File
        </Button>

        {result.warningCount > 0 && result.errorCount === 0 && (
          <p className="text-xs text-slate-500 ml-1">
            Reports will generate with warnings noted above — review them before submitting.
          </p>
        )}
      </div>
    </div>
  );
}
