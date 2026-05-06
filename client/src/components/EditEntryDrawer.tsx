/**
 * EditEntryDrawer.tsx
 * Side drawer for reviewing and editing a flagged report entry.
 * Opens over the AutoReport page when the user clicks "Edit" on a warning.
 */

import { useState, useEffect, useRef } from "react";
import { X, ChevronRight, ChevronLeft, Save, AlertTriangle, CheckCircle2, Lightbulb, Wand2 } from "lucide-react";
import { ReviewWarning } from "./WarningsPanel";
import { EditableFields, SuggestedFix } from "@/lib/validator";

// ─── DSPD compliance tips per category ───────────────────────────────────────

const DSPD_TIPS: Record<string, string[]> = {
  thin_behavior_summary: [
    "Describe the client's mood and affect (calm, anxious, happy, irritable).",
    "Note how the client engaged with activities — willingly, with verbal prompts, with physical guidance.",
    "Mention any staff interactions: what support was provided, how the client responded.",
    "Include whether goals or ISP objectives were worked on and how the client performed.",
    "Note any changes from typical behavior, even positive ones.",
  ],
  dspd_wording: [
    "Replace \"followed prompts\" with specifics: \"Required 2 verbal prompts to transition from lunch\" or \"Completed task independently after one reminder.\"",
    "Replace \"no issues\" with \"Client was cooperative throughout the shift and required no additional interventions.\"",
    "Replace \"did good\" with objective observations: \"Completed all scheduled activities and maintained a calm, cooperative affect throughout the shift.\"",
    "Replace \"was fine\" with behavioral observations: \"Presented with a stable mood, engaged appropriately with staff and peers.\"",
    "Avoid subjective opinions. Stick to observable, measurable behavior.",
  ],
  missing_narrative: [
    "A behavior summary should cover the full shift: what happened, how the client responded, any notable interactions.",
    "Describe the client's mood at the start and end of the shift.",
    "Note engagement level: did the client participate actively or need prompting?",
    "Include any relevant health, safety, or behavioral observations.",
  ],
  missing_activities: [
    "List each activity the client participated in during this shift.",
    "Include community outings, work tasks, meals, recreation, and appointments.",
    "Note approximate times if known (e.g., \"10am — grocery shopping at Walmart\").",
  ],
  incident_details: [
    "Describe what happened: the specific behavior or event, who was involved, and when.",
    "Include what staff did in response and whether the client returned to baseline.",
    "Note if any supervisors, guardians, or on-call staff were contacted.",
    "Document any injuries, property damage, or safety interventions used.",
    "Include the resolution and plan going forward.",
  ],
  ir_no_summary: [
    "The IR summary appears in monthly and quarterly reports — it should be complete.",
    "Include: what happened, client's response, staff response, outcome, and follow-up.",
  ],
};

function getTips(category: string): string[] {
  return DSPD_TIPS[category] ?? [
    "Use objective, specific language that describes observable behavior.",
    "Ensure the note reflects what actually happened during the shift.",
    "Notes should be audit-ready and align with Utah DSPD/DHHS expectations.",
  ];
}

// ─── Field label map ──────────────────────────────────────────────────────────

const FIELD_LABELS: Record<keyof EditableFields, string> = {
  activities:       "Activities (one per line)",
  narrative:        "Behavior Summary / Narrative",
  irDetails:        "Incident Details",
  pickupTime:       "Pick-up Time",
  dropoffTime:      "Drop-off Time",
  pickupLocation:   "Pick-up Location",
  dropoffLocation:  "Drop-off Location",
  mileage:          "Mileage",
  staffName:        "Staff Name",
  serviceCode:      "Service Code",
  date:             "Date",
};

const TEXTAREA_FIELDS = new Set<keyof EditableFields>(["activities", "narrative", "irDetails"]);

// ─── Suggested Fix panel ────────────────────────────────────────────────────

interface SuggestedFixPanelProps {
  fix: SuggestedFix;
  onAccept: (fix: SuggestedFix) => void;
}

function SuggestedFixPanel({ fix, onAccept }: SuggestedFixPanelProps) {
  const [accepted, setAccepted] = useState(false);

  const handleAccept = () => {
    onAccept(fix);
    setAccepted(true);
    setTimeout(() => setAccepted(false), 2000);
  };

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-emerald-100 border-b border-emerald-200">
        <div className="flex items-center gap-2">
          <Wand2 className="w-4 h-4 text-emerald-700 shrink-0" />
          <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wide">
            Suggested Fix
          </span>
        </div>
        <button
          onClick={handleAccept}
          className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${
            accepted
              ? "bg-emerald-600 text-white"
              : "bg-emerald-700 text-white hover:bg-emerald-800"
          }`}
        >
          {accepted ? (
            <><CheckCircle2 className="w-3.5 h-3.5" /> Applied</>
          ) : (
            <><CheckCircle2 className="w-3.5 h-3.5" /> Accept fix</>
          )}
        </button>
      </div>

      {/* Fix preview */}
      <div className="px-4 py-3 space-y-2.5">
        {fix.activities && (
          <div>
            <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-1">Activities</p>
            <p className="text-xs text-emerald-900 leading-relaxed whitespace-pre-line font-mono bg-white/60 rounded-md px-2.5 py-2 border border-emerald-100">
              {fix.activities}
            </p>
          </div>
        )}
        {fix.narrative && (
          <div>
            <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-1">Narrative</p>
            <p className="text-xs text-emerald-900 leading-relaxed bg-white/60 rounded-md px-2.5 py-2 border border-emerald-100">
              {fix.narrative}
            </p>
          </div>
        )}
        {fix.irDetails && (
          <div>
            <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-1">Daily Note (IR line)</p>
            <p className="text-xs text-emerald-900 leading-relaxed bg-white/60 rounded-md px-2.5 py-2 border border-emerald-100">
              {fix.irDetails}
            </p>
          </div>
        )}
        <p className="text-xs text-emerald-600 italic">
          Click “Accept fix” to copy this into the fields below, then review and save.
        </p>
      </div>
    </div>
  );
}

// ─── Main drawer ──────────────────────────────────────────────────────────────

interface EditEntryDrawerProps {
  warning: ReviewWarning | null;
  warnings: ReviewWarning[];          // full list, for Save & Next
  onSave: (id: string, fields: EditableFields) => void;
  onClose: () => void;
  onNavigate: (id: string) => void;   // jump to another warning
}

export function EditEntryDrawer({
  warning, warnings, onSave, onClose, onNavigate,
}: EditEntryDrawerProps) {
  const [fields, setFields] = useState<EditableFields>({});
  const [saved, setSaved] = useState(false);
  const firstRef = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);

  // Sync fields when warning changes
  useEffect(() => {
    if (warning) {
      setFields({ ...(warning.editableFields ?? {}) });
      setSaved(false);
    }
  }, [warning?.id]);

  if (!warning) return null;

  const unresolvedWarnings = warnings.filter(w => !w.resolved && w.id !== warning.id);
  const nextUnresolved = unresolvedWarnings[0] ?? null;

  // Index for prev/next navigation within all warnings
  const allIdx = warnings.findIndex(w => w.id === warning.id);
  const prevWarning = allIdx > 0 ? warnings[allIdx - 1] : null;
  const nextWarning = allIdx < warnings.length - 1 ? warnings[allIdx + 1] : null;

  const tips = getTips(warning.category);

  const handleSave = () => {
    onSave(warning.id, fields);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const handleSaveAndNext = () => {
    onSave(warning.id, fields);
    if (nextUnresolved) {
      onNavigate(nextUnresolved.id);
    } else {
      onClose();
    }
  };

  const editableKeys = Object.keys(fields ?? {}).filter(
    k => fields[k as keyof EditableFields] !== undefined
  ) as (keyof EditableFields)[];

  // Determine which fields to show based on warning category
  const visibleFields: (keyof EditableFields)[] = (() => {
    switch (warning.category) {
      case "thin_behavior_summary":
      case "missing_narrative":
        return ["activities", "narrative"];
      case "missing_activities":
        return ["activities", "narrative"];
      case "dspd_wording":
        return ["activities", "narrative"];
      case "incident_details":
      case "ir_no_summary":
        return ["irDetails"];
      case "meds_explanation_missing":
        return ["narrative"];
      case "incomplete_shift":
      case "missing_data":
        return editableKeys;
      default:
        return editableKeys.filter(k => k !== "date" && k !== "serviceCode" && k !== "staffName");
    }
  })();

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-xl bg-white shadow-2xl flex flex-col overflow-hidden">

        {/* Drawer header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/80 shrink-0">
          <div>
            <h2 className="font-semibold text-slate-900 text-base">Edit flagged entry</h2>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {warning.clientName && (
                <span className="text-sm text-slate-700 font-medium">{warning.clientName}</span>
              )}
              {warning.date && (
                <span className="text-xs text-slate-500 font-mono">{warning.date}</span>
              )}
              {warning.serviceCode && (
                <span className="text-xs bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-medium">
                  {warning.serviceCode}
                </span>
              )}
              {warning.staffName && (
                <span className="text-xs text-slate-400">{warning.staffName}</span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 transition-colors p-1 rounded-lg hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Warning summary */}
        <div className="mx-6 mt-4 p-3.5 rounded-lg bg-amber-50 border border-amber-200 shrink-0">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm text-amber-900 font-medium leading-snug">{warning.message}</p>
              {warning.previewText && (
                <p className="text-xs text-amber-700 mt-1 italic">"{warning.previewText}"</p>
              )}
            </div>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">

          {/* ✨ Suggested Fix section — shown when the system has an auto-corrected version */}
          {warning.suggestedFix && (warning.suggestedFix.narrative || warning.suggestedFix.activities || warning.suggestedFix.irDetails) && (
            <SuggestedFixPanel
              fix={warning.suggestedFix}
              onAccept={(fix) => {
                setFields(prev => ({
                  ...prev,
                  ...(fix.narrative   !== undefined ? { narrative:  fix.narrative   } : {}),
                  ...(fix.activities  !== undefined ? { activities: fix.activities  } : {}),
                  ...(fix.irDetails   !== undefined ? { irDetails:  fix.irDetails   } : {}),
                }));
              }}
            />
          )}

          {/* Editable fields */}
          {visibleFields.length > 0 ? (
            visibleFields.map(key => {
              const val = fields[key] ?? "";
              const label = FIELD_LABELS[key] ?? key;
              const isTextarea = TEXTAREA_FIELDS.has(key);

              return (
                <div key={key}>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
                    {label}
                  </label>
                  {isTextarea ? (
                    <textarea
                      className="w-full text-sm text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-2.5 leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)] focus:border-[hsl(var(--primary))] transition-all"
                      rows={key === "narrative" ? 6 : 4}
                      value={val}
                      placeholder={
                        key === "activities"
                          ? "One activity per line\nExample:\nWent to the grocery store\nPracticed personal hygiene with verbal prompts\nWatched a movie in the common room"
                          : key === "narrative"
                          ? "Describe the client's behavior, mood, engagement level, and notable interactions during this shift…"
                          : key === "irDetails"
                          ? "Describe what happened, who was involved, when, staff response, and outcome…"
                          : ""
                      }
                      onChange={e => setFields(f => ({ ...f, [key]: e.target.value }))}
                    />
                  ) : (
                    <input
                      type="text"
                      className="w-full text-sm text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)] focus:border-[hsl(var(--primary))] transition-all"
                      value={val}
                      onChange={e => setFields(f => ({ ...f, [key]: e.target.value }))}
                    />
                  )}
                </div>
              );
            })
          ) : (
            <p className="text-sm text-slate-500 italic">No editable fields for this warning type. Mark it reviewed once you've addressed it in your tracking system.</p>
          )}

          {/* DSPD tips */}
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2.5">
              <Lightbulb className="w-4 h-4 text-blue-600 shrink-0" />
              <span className="text-xs font-semibold text-blue-800 uppercase tracking-wide">DSPD Documentation Tips</span>
            </div>
            <ul className="space-y-1.5">
              {tips.map((tip, i) => (
                <li key={i} className="text-xs text-blue-700 leading-snug flex items-start gap-2">
                  <span className="text-blue-400 mt-0.5 shrink-0">•</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/60 shrink-0 space-y-3">
          {/* Prev / Next navigation */}
          <div className="flex items-center justify-between text-xs text-slate-400">
            <button
              disabled={!prevWarning}
              onClick={() => prevWarning && onNavigate(prevWarning.id)}
              className="flex items-center gap-1 hover:text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Previous
            </button>
            <span className="text-slate-400">
              {allIdx + 1} / {warnings.length}
            </span>
            <button
              disabled={!nextWarning}
              onClick={() => nextWarning && onNavigate(nextWarning.id)}
              className="flex items-center gap-1 hover:text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Next <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                saved
                  ? "bg-green-600 text-white"
                  : "bg-[hsl(var(--primary))] text-white hover:bg-[hsl(var(--primary)/0.9)]"
              }`}
            >
              {saved ? (
                <><CheckCircle2 className="w-4 h-4" /> Saved</>
              ) : (
                <><Save className="w-4 h-4" /> Save changes</>
              )}
            </button>
            {nextUnresolved && (
              <button
                onClick={handleSaveAndNext}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold bg-slate-800 text-white hover:bg-slate-700 transition-all"
              >
                Save &amp; next <ChevronRight className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-lg text-sm font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
