import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, desc } from "drizzle-orm";
import { persons, staff, entries } from "@shared/schema";
import type { InsertPerson, Person, InsertStaff, Staff, InsertEntry, Entry } from "@shared/schema";

const sqlite = new Database(process.env.DATABASE_PATH || "faleofaz.db");
const db = drizzle(sqlite);

// Create tables
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS persons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pid TEXT NOT NULL UNIQUE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    service_codes_json TEXT NOT NULL DEFAULT '[]',
    notes TEXT
  );

  CREATE TABLE IF NOT EXISTS staff (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL,
    role TEXT DEFAULT 'DSP',
    active INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    person_pid TEXT NOT NULL,
    staff_name TEXT NOT NULL,
    shift_type TEXT NOT NULL,
    shift_start TEXT NOT NULL,
    shift_end TEXT NOT NULL,
    service_codes_json TEXT NOT NULL DEFAULT '[]',
    activities_json TEXT NOT NULL DEFAULT '[]',
    behavior_summary TEXT NOT NULL DEFAULT '',
    meds_given INTEGER DEFAULT 0,
    mars_completed INTEGER DEFAULT 0,
    meds_notes TEXT,
    trips_json TEXT NOT NULL DEFAULT '[]',
    total_mileage REAL DEFAULT 0,
    incidents_json TEXT NOT NULL DEFAULT '[]',
    raw_notes TEXT,
    created_at TEXT NOT NULL
  );
`);

export interface IStorage {
  // Persons
  getPersons(): Person[];
  getPerson(id: number): Person | undefined;
  getPersonByPid(pid: string): Person | undefined;
  createPerson(data: InsertPerson): Person;
  updatePerson(id: number, data: Partial<InsertPerson>): Person | undefined;
  deletePerson(id: number): void;

  // Staff
  getStaff(): Staff[];
  createStaffMember(data: InsertStaff): Staff;
  updateStaff(id: number, data: Partial<InsertStaff>): Staff | undefined;
  deleteStaff(id: number): void;

  // Entries
  getEntries(): Entry[];
  getEntry(id: number): Entry | undefined;
  getEntriesByDate(date: string): Entry[];
  getEntriesByPid(pid: string): Entry[];
  createEntry(data: InsertEntry): Entry;
  updateEntry(id: number, data: Partial<InsertEntry>): Entry | undefined;
  deleteEntry(id: number): void;
}

export const storage: IStorage = {
  // ─── Persons ────────────────────────────────────────────────────────────────
  getPersons() {
    return db.select().from(persons).all();
  },
  getPerson(id) {
    return db.select().from(persons).where(eq(persons.id, id)).get();
  },
  getPersonByPid(pid) {
    return db.select().from(persons).where(eq(persons.pid, pid)).get();
  },
  createPerson(data) {
    return db.insert(persons).values(data).returning().get();
  },
  updatePerson(id, data) {
    return db.update(persons).set(data).where(eq(persons.id, id)).returning().get();
  },
  deletePerson(id) {
    db.delete(persons).where(eq(persons.id, id)).run();
  },

  // ─── Staff ──────────────────────────────────────────────────────────────────
  getStaff() {
    return db.select().from(staff).all();
  },
  createStaffMember(data) {
    return db.insert(staff).values(data).returning().get();
  },
  updateStaff(id, data) {
    return db.update(staff).set(data).where(eq(staff.id, id)).returning().get();
  },
  deleteStaff(id) {
    db.delete(staff).where(eq(staff.id, id)).run();
  },

  // ─── Entries ─────────────────────────────────────────────────────────────────
  getEntries() {
    return db.select().from(entries).orderBy(desc(entries.date)).all();
  },
  getEntry(id) {
    return db.select().from(entries).where(eq(entries.id, id)).get();
  },
  getEntriesByDate(date) {
    return db.select().from(entries).where(eq(entries.date, date)).all();
  },
  getEntriesByPid(pid) {
    return db.select().from(entries).where(eq(entries.personPid, pid)).orderBy(desc(entries.date)).all();
  },
  createEntry(data) {
    return db.insert(entries).values(data).returning().get();
  },
  updateEntry(id, data) {
    return db.update(entries).set(data).where(eq(entries.id, id)).returning().get();
  },
  deleteEntry(id) {
    db.delete(entries).where(eq(entries.id, id)).run();
  },
};
