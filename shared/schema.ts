import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ─── Auth ──────────────────────────────────────────────────────────────────────
export const users = sqliteTable("users", {
  id:           integer("id").primaryKey({ autoIncrement: true }),
  username:     text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role:         text("role").notNull().default("user"),   // "admin" | "user"
  createdAt:    text("created_at").notNull(),
  lastLoginAt:  text("last_login_at"),
  active:       integer("active").notNull().default(1),   // 1 = active, 0 = revoked
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  passwordHash: true,
  role: true,
});

// ─── Service Codes ────────────────────────────────────────────────────────────
export const SERVICE_CODES = [
  "CO1", "CO2", "CO3", "DSG", "DSI", "DTP", "MTP", "HHS", "RHS",
  "PPS", "RP1", "RP6", "RP8", "TF1", "BE1", "SFC", "IHL", "OTHER"
] as const;
export type ServiceCode = typeof SERVICE_CODES[number];

export const SHIFT_TYPES = ["Day Program", "General Activity", "Weekend", "Graves", "Evening"] as const;
export type ShiftType = typeof SHIFT_TYPES[number];

export const INCIDENT_TYPES = [
  "Fall with injury", "ER/Urgent care visit", "Medication error",
  "Abuse allegation", "Elopement", "Restraint used", "Law enforcement contact",
  "Serious threat", "Major property damage", "Missing client",
  "Significant medical emergency", "Death", "Seizure", "Sexual misconduct",
  "Fire/Emergency relocation", "Unauthorized substance", "Other"
] as const;

// ─── Persons (Clients) ────────────────────────────────────────────────────────
export const persons = sqliteTable("persons", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  pid: text("pid").notNull().unique(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  serviceCodesJson: text("service_codes_json").notNull().default("[]"),
  notes: text("notes"),
});
export const insertPersonSchema = createInsertSchema(persons).omit({ id: true });
export type InsertPerson = z.infer<typeof insertPersonSchema>;
export type Person = typeof persons.$inferSelect;

// ─── Staff ────────────────────────────────────────────────────────────────────
export const staff = sqliteTable("staff", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  fullName: text("full_name").notNull(),
  role: text("role").default("DSP"),
  active: integer("active", { mode: "boolean" }).default(true),
});
export const insertStaffSchema = createInsertSchema(staff).omit({ id: true });
export type InsertStaff = z.infer<typeof insertStaffSchema>;
export type Staff = typeof staff.$inferSelect;

// ─── Activity Entry ───────────────────────────────────────────────────────────
export const activitySchema = z.object({
  time: z.string(),
  description: z.string(),
});
export type Activity = z.infer<typeof activitySchema>;

// ─── Incident ─────────────────────────────────────────────────────────────────
export const incidentSchema = z.object({
  type: z.string(),
  description: z.string(),
  timeOfIncident: z.string().optional(),
  actionsTaken: z.string().optional(),
  irSubmitted: z.boolean().default(false),
  notifiedGuardian: z.boolean().default(false),
  notifiedSupervisor: z.boolean().default(false),
  involvedEntities: z.string().optional(),
  isCritical: z.boolean().default(false),
});
export type Incident = z.infer<typeof incidentSchema>;

// ─── Trip / MTP Log ───────────────────────────────────────────────────────────
export const tripSchema = z.object({
  pickupTime: z.string(),
  pickupLocation: z.string(),
  dropoffTime: z.string(),
  dropoffLocation: z.string(),
  mileage: z.number().optional(),
  purpose: z.string().optional(),
  driverName: z.string().optional(),
  vehicleIssue: z.string().optional(),
});
export type Trip = z.infer<typeof tripSchema>;

// ─── Daily Entry (the main note-input record) ─────────────────────────────────
export const entries = sqliteTable("entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  date: text("date").notNull(),
  personPid: text("person_pid").notNull(),
  staffName: text("staff_name").notNull(),
  shiftType: text("shift_type").notNull(),
  shiftStart: text("shift_start").notNull(),
  shiftEnd: text("shift_end").notNull(),
  serviceCodesJson: text("service_codes_json").notNull().default("[]"),
  activitiesJson: text("activities_json").notNull().default("[]"),
  behaviorSummary: text("behavior_summary").notNull().default(""),
  medsGiven: integer("meds_given", { mode: "boolean" }).default(false),
  marsCompleted: integer("mars_completed", { mode: "boolean" }).default(false),
  medsNotes: text("meds_notes"),
  tripsJson: text("trips_json").notNull().default("[]"),
  totalMileage: real("total_mileage").default(0),
  incidentsJson: text("incidents_json").notNull().default("[]"),
  rawNotes: text("raw_notes"),
  createdAt: text("created_at").notNull(),
});
export const insertEntrySchema = createInsertSchema(entries).omit({ id: true });
export type InsertEntry = z.infer<typeof insertEntrySchema>;
export type Entry = typeof entries.$inferSelect;
