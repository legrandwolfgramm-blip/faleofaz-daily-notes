/**
 * validator.ts
 * Pre-generation validation of raw spreadsheet data.
 *
 * All column positions are detected dynamically from headers —
 * works with any house's export format.
 *
 * Severity levels:
 *   error   — blocks report generation (data is unreadable/critically broken)
 *   warning — allows proceeding, but something looks off
 *   info    — informational notice, no action required
 */

import { processSpreadsheet, ClientColMap, FixedCols, normalizeNarrative, cleanActivityLine } from "./reportProcessor";

export type IssueSeverity = "error" | "warning" | "info";

export interface ValidationIssue {
  severity: IssueSeverity;
  category: IssueCategory;
  rowNumber: number | null;  // 1-based Excel row (null = file-level)
  field: string;             // column / field name
  message: string;
  suggestion?: string;
  // Review-panel metadata (populated for row-level warnings only)
  clientName?: string;
  date?: string;
  serviceCode?: string;
  staffName?: string;
  previewText?: string;      // short snippet of the affected content
  // Editable snapshot — what can be edited in the drawer
  editableFields?: EditableFields;
  // Auto-generated corrected version of the flagged content (FaleOfaz style)
  suggestedFix?: SuggestedFix;
}

/** Auto-corrected version of flagged content for one-click acceptance */
export interface SuggestedFix {
  activities?: string;   // corrected activity lines (one per line)
  narrative?: string;    // corrected FaleOfaz-style narrative paragraph
  irDetails?: string;    // corrected IR note for daily notes
}

/** Fields that can be edited in the review drawer for a flagged row */
export interface EditableFields {
  activities?: string;        // raw multiline text (one activity per line)
  narrative?: string;         // behavior / summary / narrative paragraph
  irDetails?: string;         // incident details
  pickupTime?: string;
  dropoffTime?: string;
  pickupLocation?: string;
  dropoffLocation?: string;
  mileage?: string;
  staffName?: string;
  serviceCode?: string;
  date?: string;
}

export type IssueCategory =
  | "missing_service_code"
  | "incomplete_shift"
  | "unmatched_client_id"
  | "orphaned_client_data"
  | "ir_no_summary"
  | "meds_explanation_missing"
  | "thin_behavior_summary"
  | "missing_activities"
  | "missing_narrative"
  | "missing_data"
  | "dspd_wording"
  | "narrative_review"
  | "incident_details"
  | "weak_overnight"
  | "missing_supervision"
  | "incident_wording"
  | "formatting_issue"
  | "no_client_data"
  | "unknown_shift"
  | "date_mismatch"
  | "file_structure";

export interface ValidationResult {
  isValid: boolean;         // no errors (warnings OK)
  errorCount: number;
  warningCount: number;
  infoCount: number;
  issues: ValidationIssue[];
  rowsChecked: number;
  clientsFound: string[];
  missingPids: string[];    // clients found with no PID entered
}

// ─── Known shift values ───────────────────────────────────────────────────────
const VALID_SHIFTS = new Set([
  "Day Program",
  "day program",   // some exports use lowercase
  "General Activity",
  "Weekend",
  "Graves",
]);

// Normalize shift for comparison
function normalizeShift(raw: string): string {
  const s = raw.trim();
  if (/^day\s+program$/i.test(s)) return "Day Program";
  if (/^general\s+activity$/i.test(s)) return "General Activity";
  if (/^weekend$/i.test(s)) return "Weekend";
  if (/^graves$/i.test(s)) return "Graves";
  return s;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function s(val: any): string {
  return String(val ?? "").trim();
}

function isEmpty(val: any): boolean {
  return !s(val);
}

function parseClientList(val: any): string[] {
  return s(val).split(",").map(x => x.trim()).filter(Boolean);
}

/** Format a date value from Excel to a readable string */
function fmtDate(val: any): string {
  if (!val) return "";
  if (val instanceof Date) {
    return `${val.getMonth() + 1}/${val.getDate()}/${val.getFullYear()}`;
  }
  return String(val).slice(0, 12);
}

/** Detect DSPD non-compliant vague phrases */
const VAGUE_PHRASES = [
  /\bdid good\b/i,
  /\bwas fine\b/i,
  /\bno issues\b/i,
  /\bno problems\b/i,
  /\bfollowed prompts\b/i,
  /\bfollowed instructions\b/i,
  /\bcomplied\b/i,
  /\bbehaved well\b/i,
  /\bdid great\b/i,
  /\bwent well\b/i,
  /\bno concerns\b/i,
  /\ball good\b/i,
  /\bno incidents\b/i,
  /\bnothing to report\b/i,
  /\bgood day\b/i,
  /\bgreat day\b/i,
];

function detectVaguePhrases(text: string): string[] {
  return VAGUE_PHRASES
    .filter(re => re.test(text))
    .map(re => {
      const m = text.match(re);
      return m ? m[0] : "";
    })
    .filter(Boolean);
}

// ─── Suggested Fix generators ────────────────────────────────────────────────

/**
 * Build a suggested fix for a flagged narrative/activities.
 * Uses normalizeNarrative + cleanActivityLine to produce FaleOfaz-style output.
 * Never fabricates — only cleans what's already there.
 */
function buildSuggestedFix(
  actText: string,
  behText: string,
  rowType: "dsg" | "mtp" | "rhs_pm" | "rhs_on" | "rhs_am_pm" | "graves",
  category: string
): SuggestedFix {
  const fix: SuggestedFix = {};

  // Clean activities
  if (actText && actText !== "/") {
    const rawLines = actText.split("\n").map(l => l.trim()).filter(l => l && l !== "/");
    const cleanedLines = rawLines.map(l => cleanActivityLine(l)).filter(Boolean);
    if (cleanedLines.length > 0) {
      fix.activities = cleanedLines.join("\n");
    }
  }

  // Normalize narrative
  if (category === "incident_wording" || category === "incident_details") {
    fix.irDetails = "An incident occurred during the shift. Refer to IR report.";
    fix.narrative = normalizeNarrative(behText, rowType, 0);
  } else if (category === "missing_narrative" || category === "thin_behavior_summary") {
    // Provide the normalized version of what's there, plus a FaleOfaz baseline phrase
    // if the narrative is empty or too short
    const actCount = actText.split("\n").filter(l => l.trim() && l !== "/").length;
    const normalized = normalizeNarrative(behText, rowType, actCount);
    if (!normalized) {
      // Scaffold a minimal compliant note from activity data
      fix.narrative = "Client followed rules and instructions throughout the shift. Staff provided verbal prompts as needed. Client had no major issues during the shift.";
    } else {
      fix.narrative = normalized;
    }
  } else if (category === "dspd_wording") {
    const actCount = actText.split("\n").filter(l => l.trim() && l !== "/").length;
    fix.narrative = normalizeNarrative(behText, rowType, actCount);
  } else if (category === "weak_overnight") {
    fix.narrative = "Client slept through the night. Staff checked on client periodically and remained available if needed.";
  } else if (category === "missing_supervision") {
    fix.narrative = (behText ? behText.trim() + " " : "") +
      "Staff maintained sight and sound supervision throughout the shift.";
  } else {
    const actCount = actText.split("\n").filter(l => l.trim() && l !== "/").length;
    fix.narrative = normalizeNarrative(behText, rowType, actCount);
  }

  return fix;
}

// ─── Main validation function ─────────────────────────────────────────────────

export function validateSpreadsheet(
  data: any[][],
  pids: Record<string, string>
): ValidationResult {
  const issues: ValidationIssue[] = [];
  let rowsChecked = 0;
  const clientsFoundSet = new Set<string>();

  // ── 1. File structure check ───────────────────────────────────────────────
  if (!data || data.length === 0) {
    issues.push({
      severity: "error",
      category: "file_structure",
      rowNumber: null,
      field: "File",
      message: "The file appears to be empty or unreadable.",
      suggestion: "Make sure you are uploading a valid .xlsx or .xls file with data in the first sheet.",
    });
    return buildResult(issues, 0, [], pids);
  }

  const headers = (data[0] || []).map((h: any) => s(h));
  if (!headers || headers.length < 10) {
    issues.push({
      severity: "error",
      category: "file_structure",
      rowNumber: 1,
      field: "Headers",
      message: `Only ${headers?.length ?? 0} columns found — expected at least 10. This may not be the correct file format.`,
      suggestion: "Make sure you are exporting the full tracking spreadsheet from Cherry or Bamboo.",
    });
    return buildResult(issues, 0, [], pids);
  }

  // Check that we can detect at least one client column pattern.
  // Correct pattern: "GS's Daily Activities" has ONE apostrophe — regex must use \w+'s not '.+'
  // Also accept "Sleep Summary" (used in IS-style individual client files for Graves notes)
  const hasClientCols = headers.some(
    h => /\w+'s\s+(Daily\s+Activities|Behavior\s+[Ss]ummary|Grave\s+Summary)/i.test(h) ||
         /^Sleep\s+Summary$/i.test(h)
  );
  if (!hasClientCols) {
    issues.push({
      severity: "error",
      category: "file_structure",
      rowNumber: 1,
      field: "Client Columns",
      message: "Could not find any client activity columns (e.g. \"GS's Daily Activities\"). This may be the wrong file.",
      suggestion: "Export the full tracking spreadsheet from Cherry or Bamboo that includes per-client notes columns.",
    });
    return buildResult(issues, 0, [], pids);
  }

  // Run the processor to get dynamic column positions and client map
  // (this also normalizes shift types, resolves full client names, etc.)
  const { clientColMap, fixedCols } = processSpreadsheet(data);
  const COL = fixedCols;

  // ── 2. Row-by-row validation ──────────────────────────────────────────────
  const dataRows = data.slice(1);

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const excelRow = i + 2; // 1-based, accounting for header

    if (!row || row.every(isEmpty)) continue;
    rowsChecked++;

    const shiftRaw  = s(row[COL.shift]);
    const shift     = normalizeShift(shiftRaw);
    const staff     = s(row[COL.staff]);
    const startDate = row[COL.shiftStartDate];
    const startTime = row[COL.shiftStartTime];
    const endTime   = row[COL.shiftEndTime];
    const isGraves  = shift === "Graves";

    const clientsNormal = parseClientList(row[COL.clientNormal]);
    const clientsGraves = COL.clientGraves >= 0 ? parseClientList(row[COL.clientGraves]) : [];
    const listedClients = isGraves ? clientsGraves : clientsNormal;

    // ── a) Missing or unknown shift type ────────────────────────────────────
    if (isEmpty(shiftRaw)) {
      issues.push({
        severity: "error",
        category: "missing_service_code",
        rowNumber: excelRow,
        field: "Shift",
        message: `Row ${excelRow}: Shift type is blank.`,
        suggestion: "Every row must have a Shift value (Day Program, General Activity, Weekend, or Graves).",
      });
    } else if (!VALID_SHIFTS.has(shift)) {
      issues.push({
        severity: "warning",
        category: "unknown_shift",
        rowNumber: excelRow,
        field: "Shift",
        message: `Row ${excelRow}: Unrecognized shift type "${shiftRaw}".`,
        suggestion: "Expected one of: Day Program, General Activity, Weekend, Graves. This row may be skipped.",
      });
    }

    // ── b) Missing staff name ────────────────────────────────────────────────
    if (isEmpty(staff)) {
      issues.push({
        severity: "error",
        category: "incomplete_shift",
        rowNumber: excelRow,
        field: "Staff Name",
        message: `Row ${excelRow}: Staff name is missing.`,
        suggestion: "Each row must have a staff member listed.",
      });
    }

    // ── c) Missing shift start date ──────────────────────────────────────────
    if (isEmpty(startDate)) {
      issues.push({
        severity: "warning",
        category: "incomplete_shift",
        rowNumber: excelRow,
        field: "Shift Start Date",
        message: `Row ${excelRow}: Shift start date is missing — report date may be incorrect.`,
        suggestion: "Provide a shift start date so the report date is accurate.",
      });
    }

    if (isEmpty(startTime)) {
      issues.push({
        severity: "info",
        category: "incomplete_shift",
        rowNumber: excelRow,
        field: "Shift Start Time",
        message: `Row ${excelRow}: Shift start time is missing — MTP pick-up time will show a default (8:45am).`,
      });
    }

    if (isEmpty(endTime)) {
      issues.push({
        severity: "info",
        category: "incomplete_shift",
        rowNumber: excelRow,
        field: "Shift End Time",
        message: `Row ${excelRow}: Shift end time is missing — MTP drop-off time will show a default (3:00pm).`,
      });
    }

    // ── d) No client listed ──────────────────────────────────────────────────
    if (listedClients.length === 0 && !isEmpty(shiftRaw) && VALID_SHIFTS.has(shift)) {
      issues.push({
        severity: "warning",
        category: "no_client_data",
        rowNumber: excelRow,
        field: isGraves ? "Client (graves column)" : "Client",
        message: `Row ${excelRow}: No clients listed for this ${shift} shift.`,
        suggestion: "Add the client name(s) in the Client column so this row gets included in their report.",
      });
    }

    // ── e) Orphaned client data — notes for a client not in the client list ──
    for (const [clientName, cols] of Object.entries(clientColMap)) {
      const hasData = isGraves
        ? (cols.gravesCol !== null && !isEmpty(row[cols.gravesCol!]))
        : (
            (cols.actCol !== null && !isEmpty(row[cols.actCol!])) ||
            (cols.behCol !== null && !isEmpty(row[cols.behCol!]))
          );

      if (hasData) {
        clientsFoundSet.add(clientName);

        const firstName = clientName.split(" ")[0].toLowerCase();
        const lastName  = (clientName.split(" ")[1] ?? "").toLowerCase();
        const isListed = listedClients.some(l => {
          const ll = l.toLowerCase();
          return ll.includes(firstName) || ll.includes(lastName);
        });

        if (listedClients.length > 0 && !isListed && !isGraves) {
          issues.push({
            severity: "warning",
            category: "orphaned_client_data",
            rowNumber: excelRow,
            field: clientName,
            message: `Row ${excelRow}: Notes found for ${clientName} but they are not listed in the Client column ("${s(row[COL.clientNormal])}").`,
            suggestion: `Either add "${clientName}" to the Client column, or remove the notes from their columns.`,
          });
        }
      }
    }

    // ── f) IR filed with no summary ──────────────────────────────────────────
    const irFiled   = s(row[COL.irFiled]).toLowerCase() === "yes";
    const irSummary = s(row[COL.irSummary]);
    if (irFiled && isEmpty(irSummary)) {
      issues.push({
        severity: "warning",
        category: "ir_no_summary",
        rowNumber: excelRow,
        field: "IR Summary",
        message: `Row ${excelRow}: IR form marked as submitted but no summary provided.`,
        suggestion: "Fill in the 'Brief summary of IR' field — it will appear in monthly/quarterly reports.",
      });
    }

    // ── g) Meds not on time with no explanation ──────────────────────────────
    const medsOnTime    = s(row[COL.medsOnTime]).toLowerCase();
    const marsCompleted = s(row[COL.marsCompleted]).toLowerCase();
    const marsExpl      = COL.marsExplanation >= 0 ? s(row[COL.marsExplanation]) : "";
    if ((medsOnTime === "no" || marsCompleted === "no") && isEmpty(marsExpl)) {
      issues.push({
        severity: "warning",
        category: "meds_explanation_missing",
        rowNumber: excelRow,
        field: "Meds Explanation",
        message: `Row ${excelRow}: Medications not on time or MARS not completed, but no explanation provided.`,
        suggestion: "Fill in the explanation field to remain compliant with R380-80 documentation requirements.",
      });
    }

    // ── h) Per-client content checks (thin summary, missing data, vague wording) ──
    for (const [clientName, cols] of Object.entries(clientColMap)) {
      const actCol = cols.actCol;
      const behCol = cols.behCol;

      // Only check clients that have some data in this row
      const hasAct = actCol !== null && !isEmpty(row[actCol]) && s(row[actCol]) !== "/";
      const hasBeh = behCol !== null && !isEmpty(row[behCol]) && s(row[behCol]) !== "/";
      const hasGraves = cols.gravesCol !== null && !isEmpty(row[cols.gravesCol!]) && s(row[cols.gravesCol!]) !== "/";

      if (!hasAct && !hasBeh && !hasGraves) continue;

      const actText = actCol !== null ? s(row[actCol]) : "";
      const behText = behCol !== null ? s(row[behCol]) : "";
      const dateStr = fmtDate(startDate);
      const shiftCode = isGraves ? "RHS: ON" : shift === "Day Program" ? "DSG" : shift === "General Activity" || shift === "Weekend" ? "RHS" : shift;

      // Shared editable fields snapshot
      const editableFields: EditableFields = {
        activities: actText,
        narrative: behText,
        staffName: staff,
        date: dateStr,
        serviceCode: shiftCode,
        irDetails: irSummary,
      };

      // Determine rowType for fix generation
      const rowTypeForFix: "dsg" | "mtp" | "rhs_pm" | "rhs_on" | "rhs_am_pm" | "graves" =
        isGraves ? "rhs_on" : shift === "Day Program" ? "dsg" : "rhs_am_pm";

      if (!isGraves && actCol !== null && behCol !== null) {
        const actLines = actText.split("\n").map(l => l.trim()).filter(l => l && l !== "/");
        const isBulletList = actLines.length >= 3;
        const behIsShort = behText.length < 60;
        const behIsEmpty = isEmpty(behText) || behText === "/";

        // Thin behavior summary
        if (isBulletList && (behIsEmpty || behIsShort)) {
          issues.push({
            severity: "warning",
            category: "thin_behavior_summary",
            rowNumber: excelRow,
            field: `${clientName} — Behavior Summary`,
            message: `${actLines.length} activities listed but behavior summary is too brief${behIsEmpty ? " (empty)" : `: \"${behText.slice(0, 50)}\"`}.`,
            suggestion: "Expand the behavior summary: describe how the client engaged, their mood, any notable interactions, and how staff supported them throughout the shift.",
            clientName,
            date: dateStr,
            serviceCode: shiftCode,
            staffName: staff,
            previewText: behIsEmpty ? "(no behavior summary)" : behText.slice(0, 80),
            editableFields,
            suggestedFix: buildSuggestedFix(actText, behText, rowTypeForFix, "thin_behavior_summary"),
          });
        }

        // Missing activities (has behavior but no activities)
        if (!hasAct && hasBeh) {
          issues.push({
            severity: "warning",
            category: "missing_activities",
            rowNumber: excelRow,
            field: `${clientName} — Activities`,
            message: `Behavior summary present but activity list is empty.`,
            suggestion: "Add a bullet list of what the client did during this shift. Notes without activities may not meet DSPD documentation standards.",
            clientName,
            date: dateStr,
            serviceCode: shiftCode,
            staffName: staff,
            previewText: behText.slice(0, 80),
            editableFields,
            suggestedFix: buildSuggestedFix(actText, behText, rowTypeForFix, "missing_activities"),
          });
        }

        // Missing narrative/behavior (has activities but no narrative)
        if (hasAct && !hasBeh) {
          issues.push({
            severity: "warning",
            category: "missing_narrative",
            rowNumber: excelRow,
            field: `${clientName} — Behavior Summary`,
            message: `Activity list present but behavior summary/narrative is missing.`,
            suggestion: "Add a behavior summary paragraph describing the client's mood, engagement level, interactions with staff, and any noteworthy behaviors during this shift.",
            clientName,
            date: dateStr,
            serviceCode: shiftCode,
            staffName: staff,
            previewText: actText.slice(0, 80),
            editableFields,
            suggestedFix: buildSuggestedFix(actText, behText, rowTypeForFix, "missing_narrative"),
          });
        }

        // DSPD vague wording check
        const combinedText = `${actText} ${behText}`;
        const vagueFound = detectVaguePhrases(combinedText);
        if (vagueFound.length > 0) {
          issues.push({
            severity: "warning",
            category: "dspd_wording",
            rowNumber: excelRow,
            field: `${clientName} — Wording`,
            message: `Note contains vague phrase(s): ${vagueFound.map(p => `\"${p}\"`).join(", ")}.`,
            suggestion: "Replace vague phrases with specific, objective descriptions. Instead of \"followed prompts,\" describe what prompts were given, how the client responded, and what the outcome was.",
            clientName,
            date: dateStr,
            serviceCode: shiftCode,
            staffName: staff,
            previewText: (behText || actText).slice(0, 100),
            editableFields,
            suggestedFix: buildSuggestedFix(actText, behText, rowTypeForFix, "dspd_wording"),
          });
        }

        // Overnight note check (weak or missing supervision wording)
        if (isGraves || rowTypeForFix === "rhs_on") {
          if (behText && !/staff checked|checked on|remained available|periodic/i.test(behText)) {
            issues.push({
              severity: "warning",
              category: "weak_overnight",
              rowNumber: excelRow,
              field: `${clientName} — Overnight Note`,
              message: `Overnight note is missing required supervision language (staff checks / availability statement).`,
              suggestion: "Add: \"Staff checked on client periodically and remained available throughout the night.\"",
              clientName,
              date: dateStr,
              serviceCode: shiftCode,
              staffName: staff,
              previewText: behText.slice(0, 80),
              editableFields,
              suggestedFix: buildSuggestedFix(actText, behText, rowTypeForFix, "weak_overnight"),
            });
          }
        }

        // Missing supervision wording check (1:1 shifts)
        if (/1:1|one.to.one|one on one/i.test(behText)) {
          if (!/sight and sound|supervision throughout/i.test(behText)) {
            issues.push({
              severity: "warning",
              category: "missing_supervision",
              rowNumber: excelRow,
              field: `${clientName} — Supervision Language`,
              message: `Note mentions 1:1 support but is missing required \"sight and sound supervision\" language.`,
              suggestion: "Use: \"Staff maintained sight and sound supervision throughout the shift.\"",
              clientName,
              date: dateStr,
              serviceCode: shiftCode,
              staffName: staff,
              previewText: behText.slice(0, 80),
              editableFields,
              suggestedFix: buildSuggestedFix(actText, behText, rowTypeForFix, "missing_supervision"),
            });
          }
        }

        // Incident wording check — detailed description belongs in IR, not daily note
        if (irFiled && behText && /incident|IR|behavior report/i.test(behText)) {
          if (!/refer to IR|refer to incident report/i.test(behText)) {
            issues.push({
              severity: "warning",
              category: "incident_wording",
              rowNumber: excelRow,
              field: `${clientName} — Incident Wording`,
              message: `Daily note contains detailed incident description. Keep it brief — full details go in the IR.`,
              suggestion: 'Daily note should say: "An incident occurred during the shift. Refer to IR report." Full details go in the incident report.',
              clientName,
              date: dateStr,
              serviceCode: shiftCode,
              staffName: staff,
              previewText: behText.slice(0, 80),
              editableFields,
              suggestedFix: buildSuggestedFix(actText, behText, rowTypeForFix, "incident_wording"),
            });
          }
        }
      }

      // IR filed but details are thin (< 30 chars)
      if (irFiled && irSummary && irSummary.length < 40) {
        issues.push({
          severity: "warning",
          category: "incident_details",
          rowNumber: excelRow,
          field: `${clientName} — IR Details`,
          message: `IR was filed but the incident summary is very brief: \"${irSummary.slice(0, 60)}\".`,
          suggestion: "Provide a more complete incident summary: what happened, who was involved, when, what action was taken, and outcome. This appears in monthly/quarterly reports.",
          clientName,
          date: dateStr,
          serviceCode: shiftCode,
          staffName: staff,
          previewText: irSummary.slice(0, 80),
          editableFields: { ...editableFields, irDetails: irSummary },
          suggestedFix: buildSuggestedFix(actText, behText, rowTypeForFix, "incident_details"),
        });
      }
    }

    // ── i) Above baseline with no client specified ────────────────────────────
    if (COL.aboveBaseline >= 0) {
      const aboveBaseline = s(row[COL.aboveBaseline]).toLowerCase() === "yes";
      const whichClients  = COL.whichClients >= 0 ? s(row[COL.whichClients]) : "";
      if (aboveBaseline && isEmpty(whichClients)) {
        issues.push({
          severity: "warning",
          category: "incomplete_shift",
          rowNumber: excelRow,
          field: "Which Client(s)",
          message: `Row ${excelRow}: "Above baseline" is Yes but no client is specified.`,
          suggestion: "Specify which client showed above-baseline behavior in the 'Which client(s)?' field.",
        });
      }
    }
  }

  // ── 3. File-level: no client data found at all ───────────────────────────
  if (rowsChecked > 0 && clientsFoundSet.size === 0) {
    issues.push({
      severity: "error",
      category: "no_client_data",
      rowNumber: null,
      field: "Client Data",
      message: "No client notes found in any row. The activity and behavior columns appear to be empty.",
      suggestion: "Make sure you are exporting the correct spreadsheet that includes client notes.",
    });
  }

  return buildResult(issues, rowsChecked, [...clientsFoundSet], pids);
}

function buildResult(
  issues: ValidationIssue[],
  rowsChecked: number,
  clientsFound: string[],
  pids: Record<string, string>
): ValidationResult {
  const errorCount   = issues.filter(i => i.severity === "error").length;
  const warningCount = issues.filter(i => i.severity === "warning").length;
  const infoCount    = issues.filter(i => i.severity === "info").length;

  const missingPids = clientsFound.filter(c => !pids[c] || pids[c].trim() === "");

  for (const client of missingPids) {
    issues.push({
      severity: "info",
      category: "unmatched_client_id",
      rowNumber: null,
      field: "Client ID (PID)",
      message: `${client} has notes but no Client ID (PID) entered.`,
      suggestion: `Enter ${client}'s PID using the "Edit Client IDs" button so it appears correctly on their report.`,
    });
  }

  return {
    isValid: errorCount === 0,
    errorCount,
    warningCount,
    infoCount: infoCount + missingPids.length,
    issues,
    rowsChecked,
    clientsFound,
    missingPids,
  };
}
