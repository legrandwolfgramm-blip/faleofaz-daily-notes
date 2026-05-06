/**
 * auth.ts  —  JWT + bcrypt auth for FO Daily Notes Organizer
 * ─────────────────────────────────────────────────────────────────────────────
 * - Passwords hashed with bcrypt (cost 12)
 * - Session tokens are httpOnly cookies (JWT, 7-day expiry)
 * - Admin role: full access + user management
 * - User role: app access only
 * - Admin is seeded on first boot with username "admin" + passcode from env
 */

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import Database from "better-sqlite3";
import * as path from "node:path";
import * as os from "node:os";

const JWT_SECRET = process.env.JWT_SECRET || "fo-notes-organizer-secret-2026";
const JWT_EXPIRY = "7d";
const COOKIE_NAME = "fo_session";

// ─── DB reference (same db as storage.ts) ─────────────────────────────────────
const DB_PATH = process.env.DATABASE_PATH ||
  path.join(process.cwd(), "faleofaz.db");

function getDb(): Database.Database {
  return new Database(DB_PATH);
}

// ─── Bootstrap: ensure users table exists + seed admin ────────────────────────
export function initAuth(): void {
  const db = getDb();

  // Create users table if it doesn't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      username       TEXT    NOT NULL UNIQUE,
      password_hash  TEXT    NOT NULL,
      role           TEXT    NOT NULL DEFAULT 'user',
      created_at     TEXT    NOT NULL,
      last_login_at  TEXT,
      active         INTEGER NOT NULL DEFAULT 1
    )
  `);

  // Seed admin account if no users exist
  const count = (db.prepare("SELECT COUNT(*) as n FROM users").get() as any).n;
  if (count === 0) {
    const adminPass = process.env.ADMIN_PASSWORD || "1801";
    const hash = bcrypt.hashSync(adminPass, 12);
    db.prepare(`
      INSERT INTO users (username, password_hash, role, created_at, active)
      VALUES (?, ?, 'admin', ?, 1)
    `).run("admin", hash, new Date().toISOString());
    console.info("[auth] Seeded admin account — username: admin");
  }

  db.close();
}

// ─── Token helpers ─────────────────────────────────────────────────────────────
export interface JWTPayload {
  userId: number;
  username: string;
  role: string;
}

function signToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch {
    return null;
  }
}

function setSessionCookie(res: Response, token: string): void {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
    path: "/",
  });
}

// ─── Auth middleware ───────────────────────────────────────────────────────────
export interface AuthRequest extends Request {
  user?: JWTPayload;
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const payload = verifyToken(token);
  if (!payload) {
    res.clearCookie(COOKIE_NAME);
    res.status(401).json({ error: "Session expired" });
    return;
  }
  // Quick active-check from db
  const db = getDb();
  const user = db.prepare("SELECT active FROM users WHERE id = ?").get(payload.userId) as any;
  db.close();
  if (!user || !user.active) {
    res.clearCookie(COOKIE_NAME);
    res.status(403).json({ error: "Account revoked" });
    return;
  }
  req.user = payload;
  next();
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
  requireAuth(req, res, () => {
    if (req.user?.role !== "admin") {
      res.status(403).json({ error: "Admin only" });
      return;
    }
    next();
  });
}

// ─── Auth route handlers ───────────────────────────────────────────────────────

/** POST /api/auth/login  { username, password } */
export function handleLogin(req: Request, res: Response): void {
  const { username, password } = req.body || {};
  if (!username || !password) {
    res.status(400).json({ error: "Username and password required" });
    return;
  }
  const db = getDb();
  const user = db.prepare(
    "SELECT id, username, password_hash, role, active FROM users WHERE username = ?"
  ).get(username.trim().toLowerCase()) as any;
  db.close();

  if (!user || !user.active) {
    res.status(401).json({ error: "Invalid username or password" });
    return;
  }
  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) {
    res.status(401).json({ error: "Invalid username or password" });
    return;
  }

  // Update last_login_at
  const db2 = getDb();
  db2.prepare("UPDATE users SET last_login_at = ? WHERE id = ?")
    .run(new Date().toISOString(), user.id);
  db2.close();

  const token = signToken({ userId: user.id, username: user.username, role: user.role });
  setSessionCookie(res, token);
  res.json({ ok: true, username: user.username, role: user.role });
}

/** POST /api/auth/logout */
export function handleLogout(_req: Request, res: Response): void {
  res.clearCookie(COOKIE_NAME, { path: "/" });
  res.json({ ok: true });
}

/** GET /api/auth/me */
export function handleMe(req: AuthRequest, res: Response): void {
  if (!req.user) { res.status(401).json({ error: "Not authenticated" }); return; }
  res.json({ username: req.user.username, role: req.user.role });
}

/** GET /api/admin/users  — list all users (admin only) */
export function handleListUsers(_req: Request, res: Response): void {
  const db = getDb();
  const rows = db.prepare(
    "SELECT id, username, role, created_at, last_login_at, active FROM users ORDER BY id"
  ).all();
  db.close();
  res.json(rows);
}

/** POST /api/admin/users  — create user (admin only) */
export function handleCreateUser(req: Request, res: Response): void {
  const { username, password, role } = req.body || {};
  if (!username || !password) {
    res.status(400).json({ error: "Username and password required" });
    return;
  }
  const safeRole = role === "admin" ? "admin" : "user";
  const hash = bcrypt.hashSync(password, 12);
  const db = getDb();
  try {
    db.prepare(
      "INSERT INTO users (username, password_hash, role, created_at, active) VALUES (?, ?, ?, ?, 1)"
    ).run(username.trim().toLowerCase(), hash, safeRole, new Date().toISOString());
    res.status(201).json({ ok: true, username: username.trim().toLowerCase() });
  } catch (e: any) {
    if (e?.message?.includes("UNIQUE")) {
      res.status(409).json({ error: "Username already exists" });
    } else {
      res.status(500).json({ error: e?.message });
    }
  } finally {
    db.close();
  }
}

/** PATCH /api/admin/users/:id  — update password or active status (admin only) */
export function handleUpdateUser(req: Request, res: Response): void {
  const { id } = req.params;
  const { password, active } = req.body || {};
  const db = getDb();
  try {
    if (password !== undefined) {
      const hash = bcrypt.hashSync(password, 12);
      db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hash, Number(id));
    }
    if (active !== undefined) {
      db.prepare("UPDATE users SET active = ? WHERE id = ?").run(active ? 1 : 0, Number(id));
    }
    res.json({ ok: true });
  } finally {
    db.close();
  }
}

/** DELETE /api/admin/users/:id  — delete user (admin only, cannot delete self) */
export function handleDeleteUser(req: AuthRequest, res: Response): void {
  const targetId = Number(req.params.id);
  if (targetId === req.user?.userId) {
    res.status(400).json({ error: "Cannot delete your own account" });
    return;
  }
  const db = getDb();
  db.prepare("DELETE FROM users WHERE id = ?").run(targetId);
  db.close();
  res.json({ ok: true });
}
