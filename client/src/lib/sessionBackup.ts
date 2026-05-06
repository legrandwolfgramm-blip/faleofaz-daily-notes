/**
 * sessionBackup.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Handles saving and restoring the full processed report session as a .json
 * backup file.  Since the app runs in a sandboxed iframe, localStorage is not
 * available — we use the browser's File System Access API (with a fallback to
 * a plain <a download> trigger) to write a backup to the user's downloads folder.
 *
 * A backup captures:
 *   - fileName   — original uploaded filename
 *   - savedAt    — ISO timestamp
 *   - version    — schema version (bump when structure changes)
 *   - rows        — the full ProcessedRow[] array
 *   - warnings   — the full ReviewWarning[] array
 *   - clientList — detected client names
 */

import type { ReviewWarning } from "@/components/WarningsPanel";
import type { ProcessedRow } from "./reportProcessor";

export const BACKUP_VERSION = 2;

export interface SessionBackup {
  version:    number;
  savedAt:    string;        // ISO 8601
  fileName:   string;        // original uploaded file name
  rows:       ProcessedRow[];
  warnings:   ReviewWarning[];
  clientList: string[];
}

// ─── Save ─────────────────────────────────────────────────────────────────────

/**
 * Trigger a .json download containing the full session state.
 * The file name is timestamped so multiple backups don't overwrite each other.
 */
export function saveSessionBackup(
  fileName: string,
  rows: ProcessedRow[],
  warnings: ReviewWarning[],
  clientList: string[],
): void {
  const payload: SessionBackup = {
    version: BACKUP_VERSION,
    savedAt: new Date().toISOString(),
    fileName,
    rows,
    warnings,
    clientList,
  };

  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url  = URL.createObjectURL(blob);

  // Build a timestamped filename  e.g.  FO_Backup_2026-05-04_18-30.json
  const now   = new Date();
  const date  = now.toISOString().slice(0, 10);
  const time  = now.toTimeString().slice(0, 5).replace(":", "-");
  const stem  = fileName.replace(/\.[^.]+$/, "").replace(/[^a-z0-9_-]/gi, "_").slice(0, 40);
  const name  = `FO_Backup_${stem}_${date}_${time}.json`;

  const a = document.createElement("a");
  a.href     = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// ─── Restore ──────────────────────────────────────────────────────────────────

/**
 * Parse a File object (dropped or selected by the user) and return a
 * SessionBackup if valid, or throw a descriptive error if not.
 */
export async function loadSessionBackup(file: File): Promise<SessionBackup> {
  if (!file.name.endsWith(".json")) {
    throw new Error("Please select a .json backup file created by this organizer.");
  }

  const text = await file.text();
  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("The file could not be read — it may be corrupted or not a valid JSON file.");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Invalid backup format.");
  }
  if (!Array.isArray(parsed.rows) || !Array.isArray(parsed.warnings)) {
    throw new Error("Backup is missing required data (rows / warnings). It may be from an older version.");
  }

  // Version check — v1 backups don't have clientList; we can auto-derive it
  if (!parsed.clientList) {
    const names = new Set<string>();
    (parsed.rows as any[]).forEach(r => { if (r.clientName) names.add(r.clientName); });
    parsed.clientList = [...names];
  }

  return parsed as SessionBackup;
}
