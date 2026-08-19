import { Navigate, Route, Routes } from "react-router-dom";
import { SessionProvider, useSession } from "./lib/session";
import { DataProvider } from "./lib/store";
import { AppShell } from "./components/layout/AppShell";
import { LoginPage } from "./pages/LoginPage";
import { InboxPage } from "./pages/InboxPage";
import { DrawingsListPage } from "./pages/DrawingsListPage";
import { DrawingPage } from "./pages/DrawingPage";
import { AddDrawingPage } from "./pages/AddDrawingPage";
import { RegionEditorPage } from "./pages/RegionEditorPage";
import { SiteKnowledgePage } from "./pages/SiteKnowledgePage";
import { TechnicianSimulatorPage } from "./pages/TechnicianSimulatorPage";
import { ProjectsListPage } from "./pages/ProjectsListPage";
import { SiteDetailPage } from "./pages/SiteDetailPage";
import { SiteOverviewTab } from "./pages/SiteOverviewTab";
import { SiteActivityTab } from "./pages/SiteActivityTab";
import { SiteSettingsTab } from "./pages/SiteSettingsTab";

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
            path="/drawings/new"
            element={
              <RequireEngineer>
                <AddDrawingPage />
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
          <Route
            path="/drawings/:drawingId/regions"
            element={
              <RequireEngineer>
                <RegionEditorPage />
              </RequireEngineer>
            }
          />
          <Route
            path="/knowledge"
            element={
              <RequireEngineer>
                <SiteKnowledgePage />
              </RequireEngineer>
            }
          />
          <Route
            path="/projects"
            element={
              <RequireEngineer>
                <ProjectsListPage />
              </RequireEngineer>
            }
          />
          <Route
            path="/projects/:siteId"
            element={
              <RequireEngineer>
                <SiteDetailPage />
              </RequireEngineer>
            }
          >
            <Route index element={<SiteOverviewTab />} />
            <Route path="activity" element={<SiteActivityTab />} />
            <Route path="settings" element={<SiteSettingsTab />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </DataProvider>
    </SessionProvider>
  );
}
