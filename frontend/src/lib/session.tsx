import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { User } from "./types";
import { api } from "./api";

interface SessionState {
  currentEngineer: User | null;
  engineers: User[];
  loading: boolean;
  setCurrentEngineer: (u: User) => void;
  logout: () => void;
}

const SessionContext = createContext<SessionState | null>(null);

const STORAGE_KEY = "redline.engineer_id";

export function SessionProvider({ children }: { children: ReactNode }) {
  const [engineers, setEngineers] = useState<User[]>([]);
  const [currentEngineer, setCurrentEngineerState] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.users("engineer"), api.users("reviewer")]).then(([eng, rev]) => {
      if (cancelled) return;
      const all = [...eng, ...rev];
      setEngineers(all);
      const savedId = localStorage.getItem(STORAGE_KEY);
      const saved = all.find((u) => u.id === savedId);
      if (saved) setCurrentEngineerState(saved);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<SessionState>(
    () => ({
      currentEngineer,
      engineers,
      loading,
      setCurrentEngineer: (u) => {
        localStorage.setItem(STORAGE_KEY, u.id);
        setCurrentEngineerState(u);
      },
      logout: () => {
        localStorage.removeItem(STORAGE_KEY);
        setCurrentEngineerState(null);
      },
    }),
    [currentEngineer, engineers, loading],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}
