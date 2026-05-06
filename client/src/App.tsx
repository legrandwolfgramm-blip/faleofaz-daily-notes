import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import EntryDetail from "./pages/EntryDetail";
import Reports from "./pages/Reports";
import Persons from "./pages/Persons";
import StaffPage from "./pages/StaffPage";
import AutoReport from "./pages/AutoReport";
import NotFound from "./pages/not-found";

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router hook={useHashLocation}>
        <Layout>
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/entry/import" component={AutoReport} />
            <Route path="/entry/:id" component={EntryDetail} />
            <Route path="/reports" component={Reports} />
            <Route path="/persons" component={Persons} />
            <Route path="/staff" component={StaffPage} />
            <Route component={NotFound} />
          </Switch>
        </Layout>
      </Router>
      <Toaster />
    </QueryClientProvider>
  );
}
