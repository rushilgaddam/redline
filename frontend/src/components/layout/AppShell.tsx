import { NavLink, useNavigate } from "react-router-dom";
import { Inbox, LayoutGrid, Smartphone, ChevronDown, Radio, UploadCloud, Search, BrainCircuit, FolderKanban } from "lucide-react";
import { motion } from "framer-motion";
import clsx from "clsx";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useSession } from "../../lib/session";
import { Avatar } from "../Avatar";
import { ProfilePhotoButton } from "../ProfilePhotoButton";
import { CommandPalette } from "../CommandPalette";

function NavItem({ to, icon, label }: { to: string; icon: ReactNode; label: string }) {
  return (
    <NavLink
      to={to}
      end={to === "/drawings"}
      className={({ isActive }) =>
        clsx(
          "relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors",
          isActive ? "text-ink-50" : "text-ink-400 hover:bg-ink-850 hover:text-ink-100",
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <motion.span
              layoutId="nav-active-pill"
              className="absolute inset-0 rounded-lg bg-ink-800"
              transition={{ type: "spring", stiffness: 500, damping: 34 }}
            />
          )}
          <span className={clsx("relative z-10", isActive && "text-signal-teal")}>{icon}</span>
          <span className="relative z-10">{label}</span>
        </>
      )}
    </NavLink>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { currentEngineer, engineers, setCurrentEngineer, logout } = useSession();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="flex h-screen w-screen bg-ink-950 text-ink-100">
      <aside className="flex w-56 shrink-0 flex-col border-r border-ink-700 bg-ink-900/60 px-3 py-4">
        <div className="mb-5 flex items-center gap-2 px-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md border border-signal-coral/40 bg-signal-coral/10">
            <div className="h-2.5 w-2.5 rounded-full border-2 border-signal-coral" />
          </div>
          <span className="text-[15px] font-bold tracking-tight text-ink-50">Redline</span>
        </div>

        <motion.button
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => setPaletteOpen(true)}
          className="mb-4 flex items-center gap-2 rounded-lg border border-ink-700 bg-ink-850/60 px-2.5 py-1.5 text-left text-ink-400 transition-colors hover:border-ink-500 hover:text-ink-200"
        >
          <Search size={13} />
          <span className="flex-1 text-[12px]">Search…</span>
          <kbd className="rounded border border-ink-600 bg-ink-800 px-1.5 py-0.5 font-mono text-[9.5px] text-ink-400">
            ⌘K
          </kbd>
        </motion.button>

        <nav className="flex flex-col gap-0.5">
          <NavItem to="/inbox" icon={<Inbox size={16} />} label="Inbox" />
          <NavItem to="/projects" icon={<FolderKanban size={16} />} label="Projects" />
          <NavItem to="/drawings" icon={<LayoutGrid size={16} />} label="Drawings" />
          <NavItem to="/drawings/new" icon={<UploadCloud size={16} />} label="Add drawing" />
          <NavItem to="/knowledge" icon={<BrainCircuit size={16} />} label="Site Knowledge" />
        </nav>

        <div className="mt-auto space-y-2">
          <motion.button
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate("/technician")}
            className="flex w-full items-center gap-2 rounded-lg border border-ink-700 px-3 py-2 text-[12px] font-medium text-ink-300 transition-colors hover:border-signal-blue/40 hover:text-signal-blue"
          >
            <Smartphone size={14} />
            Technician simulator
          </motion.button>

          <div className="relative">
            <div
              role="button"
              tabIndex={0}
              onClick={() => setSwitcherOpen((v) => !v)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSwitcherOpen((v) => !v);
                }
              }}
              className="flex w-full cursor-pointer items-center gap-2 rounded-lg border border-ink-700 bg-ink-850 px-2.5 py-2 text-left transition hover:border-ink-500"
            >
              {currentEngineer && <ProfilePhotoButton user={currentEngineer} size={26} />}
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12.5px] font-semibold text-ink-100">
                  {currentEngineer?.name ?? "Select engineer"}
                </div>
                <div className="truncate text-[10.5px] text-ink-400">{currentEngineer?.discipline}</div>
              </div>
              <ChevronDown size={13} className="text-ink-400" />
            </div>
            {switcherOpen && (
              <div className="absolute bottom-full left-0 mb-2 w-full overflow-hidden rounded-lg border border-ink-600 bg-ink-850 shadow-2xl">
                {engineers.map((eng) => (
                  <button
                    key={eng.id}
                    onClick={() => {
                      setCurrentEngineer(eng);
                      setSwitcherOpen(false);
                    }}
                    className="flex w-full items-center gap-2 px-2.5 py-2 text-left transition hover:bg-ink-700"
                  >
                    <Avatar name={eng.name} color={eng.avatar_color} src={eng.avatar_url} size={24} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12px] font-medium text-ink-100">{eng.name}</div>
                      <div className="truncate text-[10px] text-ink-400">{eng.title}</div>
                    </div>
                    {eng.out_of_office && (
                      <span className="rounded-full bg-signal-amber/15 px-1.5 py-0.5 text-[9px] font-medium text-signal-amber">
                        OOO
                      </span>
                    )}
                  </button>
                ))}
                <button
                  onClick={() => {
                    logout();
                    navigate("/");
                    setSwitcherOpen(false);
                  }}
                  className="w-full border-t border-ink-700 px-2.5 py-2 text-left text-[11.5px] text-ink-400 hover:bg-ink-700"
                >
                  Switch role…
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-hidden">{children}</main>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}

export function LiveDot({ connected }: { connected: boolean }) {
  return (
    <span
      className={clsx(
        "flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[10.5px]",
        connected ? "border-signal-teal/30 text-signal-teal" : "border-ink-600 text-ink-400",
      )}
    >
      <Radio size={10} />
      {connected ? "live" : "connecting…"}
    </span>
  );
}
