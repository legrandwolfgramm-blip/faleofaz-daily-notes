/**
 * AdminPanel.tsx  —  User management for FO Daily Notes Organizer
 * Admin can: create new user accounts, reset passwords, revoke/restore access, delete users
 */
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  UserPlus, Trash2, ShieldCheck, ShieldOff, KeyRound,
  RefreshCw, Users, CheckCircle2, AlertTriangle
} from "lucide-react";

interface User {
  id: number;
  username: string;
  role: string;
  created_at: string;
  last_login_at: string | null;
  active: number;
}

interface AdminPanelProps {
  currentUsername: string;
}

export default function AdminPanel({ currentUsername }: AdminPanelProps) {
  const [users, setUsers]     = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  // New user form
  const [newUser, setNewUser]     = useState({ username: "", password: "", role: "user" });
  const [creating, setCreating]   = useState(false);
  const [createError, setCreateError] = useState("");
  const [createOk, setCreateOk]   = useState("");

  // Password reset
  const [resetId, setResetId]     = useState<number | null>(null);
  const [resetPw, setResetPw]     = useState("");
  const [resetting, setResetting] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/users", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load users");
      setUsers(await res.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleCreate = async () => {
    setCreateError(""); setCreateOk("");
    if (!newUser.username || !newUser.password) { setCreateError("Username and password required"); return; }
    setCreating(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newUser),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) { setCreateError(data.error || "Failed"); return; }
      setCreateOk(`Account created for ${data.username}`);
      setNewUser({ username: "", password: "", role: "user" });
      fetchUsers();
    } finally { setCreating(false); }
  };

  const handleToggleActive = async (user: User) => {
    await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !user.active }),
      credentials: "include",
    });
    fetchUsers();
  };

  const handleResetPassword = async (userId: number) => {
    if (!resetPw) return;
    setResetting(true);
    await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: resetPw }),
      credentials: "include",
    });
    setResetId(null); setResetPw(""); setResetting(false);
    fetchUsers();
  };

  const handleDelete = async (userId: number, uname: string) => {
    if (!confirm(`Delete account "${uname}"? This cannot be undone.`)) return;
    await fetch(`/api/admin/users/${userId}`, { method: "DELETE", credentials: "include" });
    fetchUsers();
  };

  const fmt = (iso: string | null) => iso
    ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "Never";

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900">User Management</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Manage who has access to the FO Daily Notes Organizer.
        </p>
      </div>

      {/* Create user */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-slate-500" />
          <span className="text-sm font-semibold text-slate-800">Invite New User</span>
        </div>
        <div className="px-5 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-500">Username</Label>
              <Input
                placeholder="e.g. jsmith"
                value={newUser.username}
                onChange={e => setNewUser(v => ({ ...v, username: e.target.value.toLowerCase() }))}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-500">Initial Password</Label>
              <Input
                type="password"
                placeholder="••••••••"
                value={newUser.password}
                onChange={e => setNewUser(v => ({ ...v, password: e.target.value }))}
                className="h-9 text-sm"
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <input
                type="radio" name="role" value="user"
                checked={newUser.role === "user"}
                onChange={() => setNewUser(v => ({ ...v, role: "user" }))}
                className="accent-[#1E3A5F]"
              />
              <span className="text-slate-700">Staff (view + upload)</span>
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <input
                type="radio" name="role" value="admin"
                checked={newUser.role === "admin"}
                onChange={() => setNewUser(v => ({ ...v, role: "admin" }))}
                className="accent-[#1E3A5F]"
              />
              <span className="text-slate-700">Admin (full access)</span>
            </label>
          </div>
          {createError && (
            <p className="text-xs text-red-600 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> {createError}
            </p>
          )}
          {createOk && (
            <p className="text-xs text-emerald-600 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> {createOk}
            </p>
          )}
          <Button
            onClick={handleCreate}
            disabled={creating}
            className="bg-[#1E3A5F] hover:bg-[#152d4a] text-white h-9 text-sm px-5"
          >
            {creating ? "Creating…" : "Create account"}
          </Button>
        </div>
      </div>

      {/* User list */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
          <Users className="w-4 h-4 text-slate-500" />
          <span className="text-sm font-semibold text-slate-800">Active Accounts</span>
          <button onClick={fetchUsers} className="ml-auto text-slate-400 hover:text-slate-600">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {loading ? (
          <div className="px-5 py-8 text-center text-sm text-slate-400">Loading…</div>
        ) : error ? (
          <div className="px-5 py-8 text-center text-sm text-red-500">{error}</div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {users.map(user => (
              <li key={user.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-slate-800">{user.username}</span>
                      <Badge
                        variant="outline"
                        className={user.role === "admin"
                          ? "text-[10px] border-[#1E3A5F] text-[#1E3A5F] bg-blue-50"
                          : "text-[10px] text-slate-500"}
                      >
                        {user.role}
                      </Badge>
                      {!user.active && (
                        <Badge variant="outline" className="text-[10px] border-red-300 text-red-500 bg-red-50">
                          Revoked
                        </Badge>
                      )}
                      {user.username === currentUsername && (
                        <Badge variant="outline" className="text-[10px] border-emerald-300 text-emerald-600 bg-emerald-50">
                          You
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Joined {fmt(user.created_at)} · Last login {fmt(user.last_login_at)}
                    </p>

                    {/* Inline password reset */}
                    {resetId === user.id && (
                      <div className="flex items-center gap-2 mt-2">
                        <Input
                          type="password"
                          placeholder="New password"
                          value={resetPw}
                          onChange={e => setResetPw(e.target.value)}
                          className="h-8 text-xs w-44"
                        />
                        <Button
                          size="sm"
                          onClick={() => handleResetPassword(user.id)}
                          disabled={resetting || !resetPw}
                          className="h-8 text-xs bg-[#1E3A5F] text-white"
                        >
                          Set
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => { setResetId(null); setResetPw(""); }} className="h-8 text-xs">
                          Cancel
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  {user.username !== currentUsername && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => { setResetId(user.id); setResetPw(""); }}
                        title="Reset password"
                        className="p-1.5 text-slate-400 hover:text-[#1E3A5F] hover:bg-slate-50 rounded-lg transition-colors"
                      >
                        <KeyRound className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleToggleActive(user)}
                        title={user.active ? "Revoke access" : "Restore access"}
                        className={`p-1.5 rounded-lg transition-colors ${
                          user.active
                            ? "text-slate-400 hover:text-amber-500 hover:bg-amber-50"
                            : "text-slate-400 hover:text-emerald-600 hover:bg-emerald-50"
                        }`}
                      >
                        {user.active ? <ShieldOff className="w-3.5 h-3.5" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => handleDelete(user.id, user.username)}
                        title="Delete account"
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
