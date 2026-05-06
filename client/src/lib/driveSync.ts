/**
 * driveSync.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Client-side helper that POSTs the processed session to the server's
 * /api/drive/sync endpoint, which in turn uploads a structured JSON file
 * to Google Drive via the connected external-tool.
 *
 * This is fire-and-forget from the UI — errors are silent (logged only),
 * so Drive issues never block the user's workflow.
 */

import type { ProcessedRow } from "./reportProcessor";
import type { ReviewWarning }  from "@/components/WarningsPanel";

export interface DriveSyncPayload {
  house:       string;   // derived from fileName (e.g. "Cherry", "Fade")
  month:       string;   // YYYY-MM
  fileName:    string;
  rows:        ProcessedRow[];
  warnings:    ReviewWarning[];
  clientList:  string[];
  savedAt:     string;   // ISO timestamp
}

export interface DriveSyncResult {
  ok:            boolean;
  driveFileName: string;
  error?:        string;
}

/**
 * Derives a clean house label from the original uploaded file name.
 * "Cherry-Notes_2026-03.xlsx"  →  "Cherry"
 * "Fade-Notes_abc.xlsx"        →  "Fade"
 */
export function deriveHouseLabel(fileName: string): string {
  // Strip extension, grab first meaningful word
  const stem = fileName.replace(/\.[^.]+$/, "");
  const first = stem.split(/[-_\s]+/)[0] || "House";
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

/**
 * Fire the Drive sync.  Returns the result or null on network failure.
 * Safe to call without await — caller can ignore the return.
 */
export async function syncToDrive(
  payload: DriveSyncPayload
): Promise<DriveSyncResult | null> {
  try {
    const resp = await fetch("/api/drive/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!resp.ok && resp.status !== 207) {
      console.warn("[driveSync] server returned", resp.status);
      return null;
    }

    const data: DriveSyncResult = await resp.json();
    if (data.ok) {
      console.info(`[driveSync] ✓ synced → ${data.driveFileName}`);
    } else {
      console.warn(`[driveSync] partial: ${data.error}`);
    }
    return data;
  } catch (err) {
    // Network failure — completely silent, does not interrupt the user
    console.warn("[driveSync] network error:", err);
    return null;
  }
}

/**
 * Check whether the server can reach Google Drive.
 * Returns true/false. Does not throw.
 */
export async function checkDriveStatus(): Promise<boolean> {
  try {
    const resp = await fetch("/api/drive/status");
    const data = await resp.json();
    return !!data.connected;
  } catch {
    return false;
  }
}
