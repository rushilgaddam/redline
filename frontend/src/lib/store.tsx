import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Camera, ScanLine } from "lucide-react";
import { api } from "./api";
import { useInboxSocket } from "./ws";
import type { DrawingSummary, Flag, User } from "./types";

interface Toast {
  id: string;
  flag: Flag;
  drawingLabel: string;
}

interface StoreState {
  drawings: DrawingSummary[];
  users: User[];
  flags: Flag[];
  loading: boolean;
  connected: boolean;
  refreshDrawings: () => Promise<void>;
  upsertFlag: (f: Flag) => void;
  userById: (id: string | null | undefined) => User | undefined;
  drawingById: (id: string | undefined) => DrawingSummary | undefined;
}

const StoreContext = createContext<StoreState | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [drawings, setDrawings] = useState<DrawingSummary[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [flags, setFlags] = useState<Flag[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const load = useCallback(async () => {
    const [d, u, f] = await Promise.all([api.drawings(), api.users(), api.flags()]);
    setDrawings(d);
    setUsers(u);
    setFlags(f);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const upsertFlag = useCallback((f: Flag) => {
    setFlags((prev) => {
      const idx = prev.findIndex((x) => x.id === f.id);
      if (idx === -1) return [...prev, f];
      const next = [...prev];
      next[idx] = f;
      return next;
    });
  }, []);

  useInboxSocket(
    (evt) => {
      upsertFlag(evt.payload);
      if (evt.event === "flag_created") {
        const id = crypto.randomUUID();
        const d = drawings.find((dd) => dd.id === evt.payload.drawing_id);
        const drawingLabel = d ? `${d.drawing_number} Rev ${d.revision}` : "";
        setToasts((t) => [...t, { id, flag: evt.payload, drawingLabel }]);
        setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5500);
      }
    },
    (isConnected) => setConnected(isConnected),
  );

  const userById = useCallback((id: string | null | undefined) => users.find((u) => u.id === id), [users]);
  const drawingById = useCallback((id: string | undefined) => drawings.find((d) => d.id === id), [drawings]);

  const value = useMemo<StoreState>(
    () => ({ drawings, users, flags, loading, connected, refreshDrawings: load, upsertFlag, userById, drawingById }),
    [drawings, users, flags, loading, connected, load, upsertFlag, userById, drawingById],
  );

  return (
    <StoreContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-50 flex flex-col gap-2">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 40, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.96 }}
              className="pointer-events-auto flex w-72 items-start gap-2.5 rounded-xl border border-ink-600 bg-ink-850/95 p-3 shadow-2xl backdrop-blur-md"
            >
              <div className="mt-0.5 rounded-md bg-signal-coral/15 p-1.5 text-signal-coral">
                {t.flag.source === "sms" ? <Camera size={13} /> : <ScanLine size={13} />}
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-300">
                  New flag · {t.drawingLabel}
                </div>
                <div className="truncate text-[12.5px] text-ink-100">{t.flag.note}</div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within DataProvider");
  return ctx;
}
