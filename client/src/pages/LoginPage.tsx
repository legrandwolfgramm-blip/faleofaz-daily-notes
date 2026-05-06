/**
 * LoginPage.tsx  —  Invite-only login gate for FO Daily Notes Organizer
 */
import { useState, FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, Eye, EyeOff } from "lucide-react";

interface LoginPageProps {
  onLogin: (username: string, role: string) => void;
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError]   = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim().toLowerCase(), password }),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Login failed");
        return;
      }
      onLogin(data.username, data.role);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FB] flex flex-col items-center justify-center px-4">
      {/* Card */}
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden">
        {/* Header band */}
        <div className="bg-[#1E3A5F] px-8 py-7 text-white">
          <div className="flex items-center gap-3 mb-1">
            <div className="bg-white/15 rounded-lg p-1.5">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <span className="text-xs font-semibold tracking-widest uppercase opacity-70">
              Invite Only
            </span>
          </div>
          <h1 className="text-xl font-bold mt-2 leading-tight">FO Daily Notes</h1>
          <p className="text-sm opacity-60 mt-0.5">Organizer · Fale Ofaz LLC</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-8 py-7 space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="username" className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Username
            </Label>
            <Input
              id="username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="your.name"
              required
              className="h-10 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Password
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={showPw ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="h-10 text-sm pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                tabIndex={-1}
              >
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-600 font-medium bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <Button
            type="submit"
            disabled={loading || !username || !password}
            className="w-full h-10 bg-[#1E3A5F] hover:bg-[#152d4a] text-white font-semibold"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Signing in…
              </span>
            ) : "Sign in"}
          </Button>

          <p className="text-center text-xs text-slate-400">
            Access is by invitation only.<br />Contact your administrator for an account.
          </p>
        </form>
      </div>

      <p className="mt-6 text-xs text-slate-400">
        Utah DSPD · DHHS R380-80/R380-600
      </p>
    </div>
  );
}
