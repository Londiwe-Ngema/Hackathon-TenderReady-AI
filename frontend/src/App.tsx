import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "./components/Layout";
import { Spinner } from "./components/ui";
import { currentUser, type SessionUser } from "./lib/auth";
import { ClientDetail } from "./pages/ClientDetail";
import { Clients } from "./pages/Clients";
import { CompliancePack } from "./pages/CompliancePack";
import { Dashboard } from "./pages/Dashboard";
import { Login } from "./pages/Login";
import { Readiness } from "./pages/Readiness";
import { Settings } from "./pages/Settings";
import { TenderReport } from "./pages/TenderReport";

export function App() {
  const [user, setUser] = useState<SessionUser | null | undefined>(undefined);
  const qc = useQueryClient();
  const refresh = () => currentUser().then(setUser);

  useEffect(() => {
    void refresh();
  }, []);

  if (user === undefined) return <Spinner label="Starting TenderReady…" />;
  if (!user) return <Login onSignedIn={refresh} />;

  return (
    <Routes>
      <Route
        element={
          <Layout
            user={user}
            onSignedOut={() => {
              qc.clear();
              setUser(null);
            }}
          />
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="clients" element={<Clients />} />
        <Route path="clients/:clientId" element={<ClientDetail />} />
        <Route path="tenders/:tenderId" element={<TenderReport />} />
        <Route path="tenders/:tenderId/pack" element={<CompliancePack />} />
        <Route path="readiness" element={<Readiness />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
