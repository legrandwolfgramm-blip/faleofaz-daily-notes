/**
 * WarningsPanel.tsx
 * "Warnings to Review" section — shows content-quality warnings (not PID issues)
 * from the validator, lets the user edit flagged entries or mark them reviewed.
 */

import { useState } from "react";
import {
  AlertTriangle, CheckCircle2, ChevronDown, ChevronUp,
  Pencil, Eye, Filter,
} from "lucide-react";
import { ValidationIssue, IssueCategory } from "@/lib/validator";

// ─── Category display metadata ────────────────────────────────────────────────

const CATEGORY_META: Record<IssueCategory | string, { label: string; color: string; bg: string; border: string }> = {
  thin_behavior_summary: {
    label: "Needs clearer summary",
    color: "text-amber-800", bg: "bg-amber-50", border: "border-amber-200",
  },
  missing_activities: {
    label: "Missing data",
    color: "text-red-700", bg: "bg-red-50", border: "border-red-200",
  },
  missing_narrative: {
    label: "Missing data",
    color: "text-red-700", bg: "bg-red-50", border: "border-red-200",
  },
  missing_data: {
    label: "Missing data",
    color: "text-red-700", bg: "bg-red-50", border: "border-red-200",
  },
  dspd_wording: {
    label: "Needs DSPD-compliant wording",
    color: "text-purple-800", bg: "bg-purple-50", border: "border-purple-200",
  },
  narrative_review: {
    label: "Narrative needs review",
    color: "text-blue-800", bg: "bg-blue-50", border: "border-blue-200",
  },
  incident_details: {
    label: "Incident wording/details",
    color: "text-red-800", bg: "bg-red-50", border: "border-red-200",
  },
  ir_no_summary: {
    label: "Incident wording/details",
    color: "text-red-800", bg: "bg-red-50", border: "border-red-200",
  },
  meds_explanation_missing: {
    label: "Missing data",
    color: "text-red-700", bg: "bg-red-50", border: "border-red-200",
  },
  formatting_issue: {
    label: "Formatting issue",
    color: "text-slate-700", bg: "bg-slate-50", border: "border-slate-200",
  },
  incomplete_shift: {
    label: "Missing data",
    color: "text-red-700", bg: "bg-red-50", border: "border-red-200",
  },
  no_client_data: {
    label: "Missing data",
    color: "text-red-700", bg: "bg-red-50", border: "border-red-200",
  },
  unknown_shift: {
    label: "Formatting issue",
    color: "text-slate-700", bg: "bg-slate-50", border: "border-slate-200",
  },
};

function getCategoryMeta(cat: string) {
  return CATEGORY_META[cat] ?? {
    label: "Needs review",
    color: "text-slate-700", bg: "bg-slate-50", border: "border-slate-200",
  };
}

// ─── Reviewable warning row ───────────────────────────────────────────────────

export interface ReviewWarning extends ValidationIssue {
  id: string;          // unique stable key
  resolved: boolean;
}

// Categories that should NOT appear in the review panel (kept in validation flow only)
const EXCLUDED_CATEGORIES = new Set<IssueCategory>([
  "unmatched_client_id",
  "file_structure",
  "orphaned_client_data",
  "date_mismatch",
]);

export function buildReviewWarnings(issues: ValidationIssue[]): ReviewWarning[] {
  return issues
    .filter(i =>
      i.severity === "warning" &&
      !EXCLUDED_CATEGORIES.has(i.category) &&
      (i.clientName || i.rowNumber !== null) // must be row-level
    )
    .map((issue, idx) => ({ ...issue, id: `w-${idx}`, resolved: false }));
}

// ─── Main component ───────────────────────────────────────────────────────────

interface WarningsPanelProps {
  warnings: ReviewWarning[];
  onEdit: (warning: ReviewWarning) => void;
  onMarkResolved: (id: string) => void;
}

const FILTER_OPTIONS = [
  { value: "all", label: "All" },
  { value: "unresolved", label: "Unresolved" },
  { value: "thin_behavior_summary", label: "Needs clearer summary" },
  { value: "dspd_wording", label: "DSPD wording" },
  { value: "missing_activities,missing_narrative,missing_data,incomplete_shift,meds_explanation_missing,no_client_data", label: "Missing data" },
  { value: "incident_details,ir_no_summary", label: "Incident details" },
];

export function WarningsPanel({ warnings, onEdit, onMarkResolved }: WarningsPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [filter, setFilter] = useState("unresolved");

  const unresolvedCount = warnings.filter(w => !w.resolved).length;
  const resolvedCount   = warnings.length - unresolvedCount;

  const filtered = warnings.filter(w => {
    if (filter === "all") return true;
    if (filter === "unresolved") return !w.resolved;
    const cats = filter.split(",");
    return cats.includes(w.category);
  });

  if (warnings.length === 0) return null;

  return (
    <div className="print:hidden mb-5 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      {/* Header */}
      <div
        className="px-5 py-3 border-b border-slate-100 flex items-center justify-between cursor-pointer select-none hover:bg-slate-50 transition-colors"
        onClick={() => setCollapsed(c => !c)}
      >
        <div className="flex items-center gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
          <span className="text-sm font-semibold text-slate-800">Warnings to Review</span>
          {unresolvedCount > 0 ? (
            <span className="text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full">
              {unresolvedCount} unresolved
            </span>
          ) : (
            <span className="text-xs font-semibold bg-green-100 text-green-700 border border-green-200 px-2 py-0.5 rounded-full flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> All resolved
            </span>
          )}
          {resolvedCount > 0 && unresolvedCount > 0 && (
            <span className="text-xs text-slate-400">{resolvedCount} resolved</span>
          )}
        </div>
        <button className="text-slate-400 hover:text-slate-700 transition-colors">
          {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </button>
      </div>

      {!collapsed && (
        <>
          {/* Filter bar */}
          <div className="px-5 py-2.5 border-b border-slate-100 flex items-center gap-2 flex-wrap bg-slate-50/60">
            <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="text-xs text-slate-500 font-medium">Filter:</span>
            {FILTER_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setFilter(opt.value)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                  filter === opt.value
                    ? "bg-[hsl(var(--primary))] text-white border-[hsl(var(--primary))]"
                    : "bg-white text-slate-600 border-slate-200 hover:border-[hsl(var(--primary))]"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Warning rows */}
          {filtered.length === 0 ? (
            <div className="px-5 py-6 text-center text-sm text-slate-400">
              No warnings match this filter.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filtered.map(w => {
                const meta = getCategoryMeta(w.category);
                return (
                  <div
                    key={w.id}
                    className={`px-5 py-3.5 flex items-start gap-4 transition-all ${
                      w.resolved ? "opacity-50 bg-slate-50/40" : "hover:bg-slate-50/60"
                    }`}
                  >
                    {/* Category badge */}
                    <div className="shrink-0 pt-0.5">
                      <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full border ${meta.bg} ${meta.color} ${meta.border}`}>
                        {meta.label}
                      </span>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        {w.clientName && (
                          <span className="text-sm font-semibold text-slate-800">{w.clientName}</span>
                        )}
                        {w.date && (
                          <span className="text-xs text-slate-500 font-mono">{w.date}</span>
                        )}
                        {w.serviceCode && (
                          <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium">
                            {w.serviceCode}
                          </span>
                        )}
                        {w.staffName && (
                          <span className="text-xs text-slate-400">{w.staffName}</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-700 leading-snug">{w.message}</p>
                      {w.previewText && !w.resolved && (
                        <p className="text-xs text-slate-400 mt-0.5 italic truncate max-w-md">
                          "{w.previewText}"
                        </p>
                      )}
                      {w.suggestion && !w.resolved && (
                        <p className="text-xs text-slate-500 mt-1 leading-snug">
                          <span className="font-medium text-slate-600">Tip: </span>{w.suggestion}
                        </p>
                      )}
                      {w.resolved && (
                        <p className="text-xs text-green-600 font-medium mt-0.5 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Resolved
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="shrink-0 flex items-center gap-2 pt-0.5">
                      {!w.resolved && w.editableFields && (
                        <button
                          onClick={() => onEdit(w)}
                          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-[hsl(var(--primary)/0.4)] text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.06)] transition-all"
                        >
                          <Pencil className="w-3 h-3" /> Edit
                        </button>
                      )}
                      {!w.resolved ? (
                        <button
                          onClick={() => onMarkResolved(w.id)}
                          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:border-green-400 hover:text-green-700 hover:bg-green-50 transition-all"
                        >
                          <Eye className="w-3 h-3" /> Mark reviewed
                        </button>
                      ) : (
                        <button
                          onClick={() => onMarkResolved(w.id)}
                          className="text-xs text-slate-400 hover:text-amber-600 transition-colors"
                          title="Undo resolve"
                        >
                          Undo
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Bottom summary */}
          {unresolvedCount === 0 && warnings.length > 0 && (
            <div className="px-5 py-3 border-t border-slate-100 flex items-center gap-2 text-sm text-green-700 bg-green-50/50">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              All warnings resolved — reports are ready to export.
            </div>
          )}
        </>
      )}
    </div>
  );
}
