import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { useState, useEffect } from "react";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import EntryDetail from "./pages/EntryDetail";
import Reports from "./pages/Reports";
import Persons from "./pages/Persons";
import StaffPage from "./pages/StaffPage";
import AutoReport from "./pages/AutoReport";
import AdminPanel from "./pages/AdminPanel";
import LoginPage from "./pages/LoginPage";
import NotFound from "./pages/not-found";

// ─── Auth state ───────────────────────────────────────────────────────────────
interface AuthUser { username: string; role: string; }

export default function App() {
  const [authUser, setAuthUser] = useState<AuthUser | null | undefined>(undefined);
  // undefined = loading, null = not logged in, object = logged in

  // Check if we already have a valid session cookie on mount
  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(data => setAuthUser(data ? { username: data.username, role: data.role } : null))
      .catch(() => setAuthUser(null));
  }, []);

  // Loading splash
  if (authUser === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F9FB]">
        <div className="flex flex-col items-center gap-3 text-slate-400 text-sm">
          <div className="w-7 h-7 border-2 border-[#1E3A5F] border-t-transparent rounded-full animate-spin" />
          Loading…
        </div>
      </div>
    );
  }

  // Not logged in → show login gate
  if (!authUser) {
    return (
      <>
        <LoginPage onLogin={(username, role) => setAuthUser({ username, role })} />
        <Toaster />
      </>
    );
  }

  // Logged in → full app
  return (
    <QueryClientProvider client={queryClient}>
      <Router hook={useHashLocation}>
        <Layout
          currentUser={authUser}
          onLogout={() => {
            fetch("/api/auth/logout", { method: "POST", credentials: "include" });
            setAuthUser(null);
          }}
        >
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/entry/import" component={AutoReport} />
            <Route path="/entry/:id" component={EntryDetail} />
            <Route path="/reports" component={Reports} />
            <Route path="/persons" component={Persons} />
            <Route path="/staff" component={StaffPage} />
            {authUser.role === "admin" && (
              <Route path="/admin">
                {() => <AdminPanel currentUsername={authUser.username} />}
              </Route>
            )}
            <Route component={NotFound} />
          </Switch>
        </Layout>
      </Router>
      <Toaster />
    </QueryClientProvider>
  );
}
