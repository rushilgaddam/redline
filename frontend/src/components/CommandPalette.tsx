import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  ArrowRight,
  BrainCircuit,
  Camera,
  Inbox,
  LayoutGrid,
  ScanLine,
  Search,
  Smartphone,
  UploadCloud,
  UserRound,
} from "lucide-react";
import { useStore } from "../lib/store";
import { useSession } from "../lib/session";
import type { User } from "../lib/types";

interface PaletteItem {
  id: string;
  group: string;
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  keywords?: string;
  action: () => void;
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { drawings, flags, drawingById } = useStore();
  const { engineers, setCurrentEngineer } = useSession();

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const items = useMemo<PaletteItem[]>(() => {
    const nav: PaletteItem[] = [
      { id: "go-inbox", group: "Go to", icon: <Inbox size={15} />, label: "Inbox", action: () => navigate("/inbox") },
      { id: "go-drawings", group: "Go to", icon: <LayoutGrid size={15} />, label: "Drawings", action: () => navigate("/drawings") },
      { id: "go-add", group: "Go to", icon: <UploadCloud size={15} />, label: "Add drawing", action: () => navigate("/drawings/new") },
      { id: "go-knowledge", group: "Go to", icon: <BrainCircuit size={15} />, label: "Site Knowledge", action: () => navigate("/knowledge") },
      { id: "go-tech", group: "Go to", icon: <Smartphone size={15} />, label: "Technician simulator", action: () => navigate("/technician") },
    ];

    const drawingItems: PaletteItem[] = drawings.map((d) => ({
      id: `drawing-${d.id}`,
      group: "Drawings",
      icon: <LayoutGrid size={15} />,
      label: `${d.drawing_number} — ${d.title}`,
      sublabel: `Rev ${d.revision} · ${d.discipline}`,
      keywords: `${d.drawing_number} ${d.title} ${d.discipline}`,
      action: () => navigate(`/drawings/${d.id}`),
    }));

    const activeFlags = flags
      .filter((f) => f.status !== "resolved")
      .sort((a, b) => (a.created_at < b.created_at ? -1 : 1))
      .slice(0, 12);
    const flagItems: PaletteItem[] = activeFlags.map((f) => {
      const d = drawingById(f.drawing_id);
      return {
        id: `flag-${f.id}`,
        group: "Open flags",
        icon: f.source === "sms" ? <Camera size={15} /> : <ScanLine size={15} />,
        label: f.note.slice(0, 70),
        sublabel: d ? `${d.drawing_number} — ${d.title}` : undefined,
        keywords: `${f.note} ${d?.drawing_number ?? ""}`,
        action: () => navigate(`/drawings/${f.drawing_id}?focus=${f.id}`),
      };
    });

    const engineerItems: PaletteItem[] = engineers.map((eng: User) => ({
      id: `eng-${eng.id}`,
      group: "Switch engineer",
      icon: <UserRound size={15} />,
      label: eng.name,
      sublabel: eng.title ?? eng.discipline ?? undefined,
      keywords: `${eng.name} ${eng.discipline ?? ""} switch engineer login`,
      action: () => {
        setCurrentEngineer(eng);
        navigate("/inbox");
      },
    }));

    return [...nav, ...drawingItems, ...flagItems, ...engineerItems];
  }, [drawings, flags, engineers, drawingById, navigate, setCurrentEngineer]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) =>
      `${i.label} ${i.sublabel ?? ""} ${i.keywords ?? ""}`.toLowerCase().includes(q),
    );
  }, [items, query]);

  const groups = useMemo(() => {
    const map = new Map<string, PaletteItem[]>();
    for (const item of filtered) {
      const list = map.get(item.group) ?? [];
      list.push(item);
      map.set(item.group, list);
    }
    return [...map.entries()];
  }, [filtered]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  function runActive() {
    const item = filtered[activeIndex];
    if (item) {
      item.action();
      onClose();
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      runActive();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  }

  let runningIndex = -1;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 pt-[14vh] backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="glass-panel w-full max-w-xl overflow-hidden rounded-2xl shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
          >
            <div className="flex items-center gap-2.5 border-b border-white/10 px-4 py-3">
              <Search size={16} className="shrink-0 text-ink-400" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Jump to a drawing, flag, engineer, or page…"
                className="w-full bg-transparent text-[14px] text-ink-50 placeholder:text-ink-500 focus:outline-none"
              />
              <kbd className="shrink-0 rounded-md border border-ink-600 bg-ink-800 px-1.5 py-0.5 font-mono text-[10px] text-ink-400">
                esc
              </kbd>
            </div>

            <div className="max-h-[55vh] overflow-y-auto p-2">
              {filtered.length === 0 && (
                <div className="px-3 py-8 text-center text-[12.5px] text-ink-500">No matches.</div>
              )}
              {groups.map(([group, groupItems]) => (
                <div key={group} className="mb-1.5">
                  <div className="px-2.5 py-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-ink-500">
                    {group}
                  </div>
                  {groupItems.map((item) => {
                    runningIndex += 1;
                    const idx = runningIndex;
                    const isActive = idx === activeIndex;
                    return (
                      <button
                        key={item.id}
                        onMouseEnter={() => setActiveIndex(idx)}
                        onClick={runActive}
                        className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors ${
                          isActive ? "bg-signal-teal/12 text-ink-50" : "text-ink-200 hover:bg-white/5"
                        }`}
                      >
                        <span className={isActive ? "text-signal-teal" : "text-ink-400"}>{item.icon}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px]">{item.label}</span>
                          {item.sublabel && (
                            <span className="block truncate font-mono text-[10.5px] text-ink-500">{item.sublabel}</span>
                          )}
                        </span>
                        {isActive && <ArrowRight size={13} className="shrink-0 text-signal-teal" />}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            <div className="flex items-center gap-3 border-t border-white/10 px-4 py-2 text-[10.5px] text-ink-500">
              <span className="flex items-center gap-1">
                <kbd className="rounded border border-ink-600 bg-ink-800 px-1">↑↓</kbd> navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="rounded border border-ink-600 bg-ink-800 px-1">↵</kbd> select
              </span>
              <span className="ml-auto flex items-center gap-1 text-signal-coral/70">
                <AlertCircle size={11} /> {flags.filter((f) => f.status === "open").length} open
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
