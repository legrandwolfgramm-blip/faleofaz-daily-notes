import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { insertPersonSchema, insertStaffSchema, insertEntrySchema } from "@shared/schema";
import { z } from "zod";
import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

export function registerRoutes(httpServer: Server, app: Express) {
  // ─── Persons ────────────────────────────────────────────────────────────────
  app.get("/api/persons", (_req, res) => {
    res.json(storage.getPersons());
  });
  app.post("/api/persons", (req, res) => {
    const parsed = insertPersonSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error });
    const person = storage.createPerson(parsed.data);
    res.status(201).json(person);
  });
  app.put("/api/persons/:id", (req, res) => {
    const id = parseInt(req.params.id);
    const updated = storage.updatePerson(id, req.body);
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json(updated);
  });
  app.delete("/api/persons/:id", (req, res) => {
    storage.deletePerson(parseInt(req.params.id));
    res.json({ ok: true });
  });

  // ─── Staff ──────────────────────────────────────────────────────────────────
  app.get("/api/staff", (_req, res) => {
    res.json(storage.getStaff());
  });
  app.post("/api/staff", (req, res) => {
    const parsed = insertStaffSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error });
    const member = storage.createStaffMember(parsed.data);
    res.status(201).json(member);
  });
  app.put("/api/staff/:id", (req, res) => {
    const id = parseInt(req.params.id);
    const updated = storage.updateStaff(id, req.body);
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json(updated);
  });
  app.delete("/api/staff/:id", (req, res) => {
    storage.deleteStaff(parseInt(req.params.id));
    res.json({ ok: true });
  });

  // ─── Entries ─────────────────────────────────────────────────────────────────
  app.get("/api/entries", (req, res) => {
    const { date, pid } = req.query;
    if (date) return res.json(storage.getEntriesByDate(date as string));
    if (pid) return res.json(storage.getEntriesByPid(pid as string));
    res.json(storage.getEntries());
  });
  app.get("/api/entries/:id", (req, res) => {
    const entry = storage.getEntry(parseInt(req.params.id));
    if (!entry) return res.status(404).json({ error: "Not found" });
    res.json(entry);
  });
  app.post("/api/entries", (req, res) => {
    const data = {
      ...req.body,
      createdAt: new Date().toISOString(),
    };
    const parsed = insertEntrySchema.safeParse(data);
    if (!parsed.success) return res.status(400).json({ error: parsed.error });
    const entry = storage.createEntry(parsed.data);
    res.status(201).json(entry);
  });
  app.put("/api/entries/:id", (req, res) => {
    const id = parseInt(req.params.id);
    const updated = storage.updateEntry(id, req.body);
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json(updated);
  });
  app.delete("/api/entries/:id", (req, res) => {
    storage.deleteEntry(parseInt(req.params.id));
    res.json({ ok: true });
  });

  // ─── Google Drive Auto-Sync ───────────────────────────────────────────────────────
  /**
   * POST /api/drive/sync
   * Body: { house, month, fileName, rows, warnings, clientList, savedAt }
   *
   * Writes a structured JSON file to a temp path, then calls the
   * external-tool CLI to upload it to Google Drive via export_files.
   * Returns { ok, driveFileName } on success.
   *
   * File naming: FO_<House>_<YYYY-MM>_<YYYY-MM-DD>.json
   * e.g.  FO_Cherry_2026-03_2026-05-04.json
   */
  app.post("/api/drive/sync", async (req, res) => {
    try {
      const { house, month, fileName, rows, warnings, clientList, savedAt } = req.body;

      if (!rows || !Array.isArray(rows)) {
        return res.status(400).json({ error: "rows array is required" });
      }

      // ── Derive house label from fileName if not provided ────────────────────
      const houseLabel: string = house ||
        (fileName || "")
          .replace(/\.[^.]+$/, "")
          .split(/[-_\s]+/)
          .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
          .join("_")
          .slice(0, 30) ||
        "House";

      // ── Derive month label ─────────────────────────────────────────────────
      const monthLabel: string = month ||
        (rows[0]?.date ? rows[0].date.slice(0, 7) : null) ||
        new Date().toISOString().slice(0, 7);

      const dateLabel = new Date().toISOString().slice(0, 10);

      // ── Build drive file name ────────────────────────────────────────────────
      const driveFileName = `FO_${houseLabel}_${monthLabel}_${dateLabel}.json`;

      // ── Build structured payload ─────────────────────────────────────────────
      const payload = {
        schema_version: 2,
        app: "FO Daily Notes Organizer",
        house: houseLabel,
        month: monthLabel,
        synced_at: savedAt || new Date().toISOString(),
        source_file: fileName || "unknown",
        client_list: clientList || [],
        rows,
        warnings: warnings || [],
      };

      // ── Write to temp file (persistent volume on Railway, workspace locally) ────
      const dbDir = process.env.DATABASE_PATH
        ? path.dirname(process.env.DATABASE_PATH)
        : path.join(os.homedir(), "workspace", "faleofaz");
      const syncDir = path.join(dbDir, "drive_sync");
      fs.mkdirSync(syncDir, { recursive: true });
      const tempPath = path.join(syncDir, driveFileName);
      fs.writeFileSync(tempPath, JSON.stringify(payload, null, 2), "utf8");

      // ── Upload via external-tool CLI ────────────────────────────────────────
      // Note: export_files must go through the connector service (not CLI)
      // so we invoke it via the external-tool call subcommand.
      const toolArg = JSON.stringify({
        source_id: "google_drive",
        tool_name: "export_files",
        arguments: { file_paths: [tempPath] },
      });

      let driveResult: any;
      try {
        const stdout = execSync(`external-tool call '${toolArg}'`, {
          timeout: 30000,
          env: { ...process.env },
        }).toString();
        driveResult = JSON.parse(stdout);
      } catch (uploadErr: any) {
        // Upload failed — still return success so the client backup isn't blocked
        console.error("[drive/sync] upload failed:", uploadErr?.message);
        return res.status(207).json({
          ok: false,
          driveFileName,
          error: "File written locally but Drive upload failed: " + (uploadErr?.message || "unknown"),
        });
      }

      // Clean up temp file after successful upload
      try { fs.unlinkSync(tempPath); } catch { /* ignore */ }

      return res.json({ ok: true, driveFileName, driveResult });
    } catch (err: any) {
      console.error("[drive/sync] error:", err);
      return res.status(500).json({ error: err?.message || "Drive sync failed" });
    }
  });

  // GET /api/drive/status — lightweight check that Drive is reachable
  app.get("/api/drive/status", (_req, res) => {
    try {
      const toolArg = JSON.stringify({
        source_id: "files",
        tool_name: "search_files_v2",
        arguments: { queries: ["FO Daily Notes Organizer"], retrieval_mode: "SEARCH" },
      });
      execSync(`external-tool call '${toolArg}'`, { timeout: 10000, env: { ...process.env } });
      res.json({ connected: true });
    } catch {
      res.json({ connected: false });
    }
  });
}
