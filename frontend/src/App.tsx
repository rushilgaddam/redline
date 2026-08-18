import { Navigate, Route, Routes } from "react-router-dom";
import { SessionProvider, useSession } from "./lib/session";
import { DataProvider } from "./lib/store";
import { AppShell } from "./components/layout/AppShell";
import { LoginPage } from "./pages/LoginPage";
import { InboxPage } from "./pages/InboxPage";
import { DrawingsListPage } from "./pages/DrawingsListPage";
import { DrawingPage } from "./pages/DrawingPage";
import { TechnicianSimulatorPage } from "./pages/TechnicianSimulatorPage";

function RequireEngineer({ children }: { children: React.ReactNode }) {
  const { currentEngineer, loading } = useSession();
  if (loading) return null;
  if (!currentEngineer) return <Navigate to="/" replace />;
  return <AppShell>{children}</AppShell>;
}

export default function App() {
  return (
    <SessionProvider>
      <DataProvider>
        <Routes>
          <Route path="/" element={<LoginPage />} />
          <Route path="/technician" element={<TechnicianSimulatorPage />} />
          <Route
            path="/inbox"
            element={
              <RequireEngineer>
                <InboxPage />
              </RequireEngineer>
            }
          />
          <Route
            path="/drawings"
            element={
              <RequireEngineer>
                <DrawingsListPage />
              </RequireEngineer>
            }
          />
          <Route
            path="/drawings/:drawingId"
            element={
              <RequireEngineer>
                <DrawingPage />
              </RequireEngineer>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </DataProvider>
    </SessionProvider>
  );
}
