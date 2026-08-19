import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, Check, ChevronDown, HardHat, Loader2, Wrench } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useSession } from "../lib/session";
import { useStore } from "../lib/store";
import { api } from "../lib/api";
import { Avatar } from "../components/Avatar";
import type { Site, User } from "../lib/types";

type Mode = "signin" | "register";
type FormRole = "engineer" | "reviewer" | "technician";

const ROLE_LABEL: Record<FormRole, string> = { engineer: "Engineer", reviewer: "Reviewer", technician: "Technician" };

export function LoginPage() {
  const { engineers, setCurrentEngineer, loading } = useSession();
  const { refreshDrawings } = useStore();
  const navigate = useNavigate();

  const [mode, setMode] = useState<Mode>("signin");
  const [role, setRole] = useState<FormRole>("engineer");
  const [sites, setSites] = useState<Site[]>([]);
  const [identifier, setIdentifier] = useState("");
  const [name, setName] = useState("");
  const [discipline, setDiscipline] = useState("");
  const [title, setTitle] = useState("");
  const [selectedSiteIds, setSelectedSiteIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDemoAccess, setShowDemoAccess] = useState(false);

  useEffect(() => {
    api.sites().then(setSites);
  }, []);

  function reset() {
    setIdentifier("");
    setName("");
    setDiscipline("");
    setTitle("");
    setSelectedSiteIds([]);
    setError(null);
  }

  async function afterAuth(user: User) {
    await refreshDrawings();
    if (user.role === "technician") {
      navigate("/technician", { state: { technicianId: user.id } });
    } else {
      setCurrentEngineer(user);
      navigate("/inbox");
    }
  }

  async function submitSignIn(e: React.FormEvent) {
    e.preventDefault();
    if (!identifier.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const user = await api.login({ role: role === "reviewer" ? "engineer" : role, identifier });
      afterAuth(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't sign in");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !identifier.trim() || selectedSiteIds.length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const user = await api.register({
        role,
        name,
        email: role === "technician" ? undefined : identifier,
        phone: role === "technician" ? identifier : undefined,
        discipline: discipline || undefined,
        title: title || undefined,
        site_ids: selectedSiteIds,
      });
      afterAuth(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create account");
    } finally {
      setSubmitting(false);
    }
  }

  const isTechnician = role === "technician";

  return (
    <div className="relative flex min-h-screen w-screen items-center justify-center overflow-hidden bg-ink-950 bg-grain py-10">
      <div className="pointer-events-none absolute inset-0">
        <div className="blob h-[420px] w-[420px] -translate-x-1/2 bg-signal-coral/[0.09]" style={{ top: "-8%", left: "22%" }} />
        <div className="blob h-[380px] w-[380px] bg-signal-teal/[0.08]" style={{ bottom: "-10%", right: "14%", animationDelay: "-6s" }} />
        <div className="blob h-[320px] w-[320px] bg-signal-blue/[0.06]" style={{ top: "38%", right: "30%", animationDelay: "-11s" }} />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(37,99,235,0.05),transparent_60%)]" />

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-sm px-6"
      >
        <div className="mb-7 flex flex-col items-center text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.7, rotate: -8 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-signal-coral/40 bg-signal-coral/10 shadow-[var(--shadow-glow-coral)]"
          >
            <div className="h-5 w-5 rounded-full border-[3px] border-signal-coral" />
          </motion.div>
          <h1 className="text-2xl font-bold tracking-tight text-ink-50">Redline</h1>
          <p className="mt-1.5 max-w-xs text-[13px] text-ink-400">
            A technician texts a photo of a drawing. The engineer of record answers.
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="glass-panel rounded-2xl p-5"
        >
          <div className="mb-4 flex rounded-lg border border-ink-700 bg-ink-850/60 p-0.5">
            {(["signin", "register"] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => {
                  setMode(m);
                  reset();
                }}
                className={`flex-1 rounded-md py-1.5 text-[12.5px] font-semibold transition-colors ${
                  mode === m ? "bg-ink-800 text-ink-50" : "text-ink-400 hover:text-ink-200"
                }`}
              >
                {m === "signin" ? "Sign in" : "Create account"}
              </button>
            ))}
          </div>

          <div className="mb-4 grid grid-cols-3 gap-1.5">
            {(["engineer", "reviewer", "technician"] as FormRole[]).map((r) => (
              <button
                key={r}
                onClick={() => {
                  setRole(r);
                  setIdentifier("");
                  setError(null);
                }}
                className={`flex flex-col items-center gap-1 rounded-lg border px-2 py-2 text-center transition-colors ${
                  role === r ? "border-signal-blue/50 bg-signal-blue/10 text-signal-blue" : "border-ink-700 bg-ink-850/40 text-ink-400 hover:border-ink-500"
                }`}
              >
                {r === "technician" ? <Wrench size={14} /> : <HardHat size={14} />}
                <span className="text-[10.5px] font-medium">{ROLE_LABEL[r]}</span>
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {mode === "signin" ? (
              <motion.form
                key="signin"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onSubmit={submitSignIn}
                className="space-y-3"
              >
                <div>
                  <div className="mb-1 text-[11.5px] font-medium text-ink-300">{isTechnician ? "Phone number" : "Work email"}</div>
                  <input
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder={isTechnician ? "555-234-1122" : "you@company.com"}
                    type={isTechnician ? "tel" : "email"}
                    className="w-full rounded-lg border border-ink-600 bg-ink-850 px-3 py-2 text-[13px] text-ink-100 placeholder:text-ink-500 focus:border-signal-blue/50 focus:outline-none"
                  />
                </div>
                {error && (
                  <div className="flex items-start gap-1.5 text-[11.5px] text-signal-coral">
                    <AlertCircle size={13} className="mt-0.5 shrink-0" />
                    {error}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={submitting || !identifier.trim()}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-signal-blue px-4 py-2.5 text-[13px] font-semibold text-white disabled:opacity-50"
                >
                  {submitting && <Loader2 size={14} className="animate-spin" />}
                  Sign in
                </button>
              </motion.form>
            ) : (
              <motion.form
                key="register"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onSubmit={submitRegister}
                className="space-y-3"
              >
                <div>
                  <div className="mb-1 text-[11.5px] font-medium text-ink-300">Full name</div>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Jordan Lee"
                    className="w-full rounded-lg border border-ink-600 bg-ink-850 px-3 py-2 text-[13px] text-ink-100 placeholder:text-ink-500 focus:border-signal-blue/50 focus:outline-none"
                  />
                </div>
                <div>
                  <div className="mb-1 text-[11.5px] font-medium text-ink-300">{isTechnician ? "Phone number" : "Work email"}</div>
                  <input
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder={isTechnician ? "555-234-1122" : "you@company.com"}
                    type={isTechnician ? "tel" : "email"}
                    className="w-full rounded-lg border border-ink-600 bg-ink-850 px-3 py-2 text-[13px] text-ink-100 placeholder:text-ink-500 focus:border-signal-blue/50 focus:outline-none"
                  />
                </div>
                {!isTechnician && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="mb-1 text-[11.5px] font-medium text-ink-300">Discipline</div>
                      <input
                        value={discipline}
                        onChange={(e) => setDiscipline(e.target.value)}
                        placeholder="Electrical"
                        className="w-full rounded-lg border border-ink-600 bg-ink-850 px-2.5 py-2 text-[12.5px] text-ink-100 placeholder:text-ink-500 focus:border-signal-blue/50 focus:outline-none"
                      />
                    </div>
                    <div>
                      <div className="mb-1 text-[11.5px] font-medium text-ink-300">Title</div>
                      <input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Engineer II"
                        className="w-full rounded-lg border border-ink-600 bg-ink-850 px-2.5 py-2 text-[12.5px] text-ink-100 placeholder:text-ink-500 focus:border-signal-blue/50 focus:outline-none"
                      />
                    </div>
                  </div>
                )}
                <div>
                  <div className="mb-1 text-[11.5px] font-medium text-ink-300">Project(s)</div>
                  <div className="space-y-1 rounded-lg border border-ink-600 bg-ink-850 p-1.5">
                    {sites.map((s) => {
                      const checked = selectedSiteIds.includes(s.id);
                      return (
                        <button
                          type="button"
                          key={s.id}
                          onClick={() =>
                            setSelectedSiteIds((prev) =>
                              checked ? prev.filter((id) => id !== s.id) : [...prev, s.id],
                            )
                          }
                          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12.5px] text-ink-200 hover:bg-ink-800"
                        >
                          <span
                            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                              checked ? "border-signal-teal bg-signal-teal text-ink-950" : "border-ink-500"
                            }`}
                          >
                            {checked && <Check size={11} />}
                          </span>
                          {s.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {error && (
                  <div className="flex items-start gap-1.5 text-[11.5px] text-signal-coral">
                    <AlertCircle size={13} className="mt-0.5 shrink-0" />
                    {error}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={submitting || !name.trim() || !identifier.trim() || selectedSiteIds.length === 0}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-signal-teal px-4 py-2.5 text-[13px] font-semibold text-ink-950 disabled:opacity-50"
                >
                  {submitting && <Loader2 size={14} className="animate-spin" />}
                  Create account
                </button>
              </motion.form>
            )}
          </AnimatePresence>
        </motion.div>

        <div className="mt-4">
          <button
            onClick={() => setShowDemoAccess((v) => !v)}
            className="flex w-full items-center justify-center gap-1 text-[11.5px] text-ink-500 hover:text-ink-300"
          >
            Explore as an existing demo user
            <ChevronDown size={12} className={showDemoAccess ? "rotate-180 transition-transform" : "transition-transform"} />
          </button>
          <AnimatePresence>
            {showDemoAccess && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="glass-panel mt-3 space-y-1.5 rounded-2xl p-3">
                  {loading ? (
                    <div className="px-2 py-1 text-[12px] text-ink-500">Loading roster…</div>
                  ) : (
                    engineers.map((eng) => (
                      <button
                        key={eng.id}
                        onClick={() => {
                          setCurrentEngineer(eng);
                          navigate("/inbox");
                        }}
                        className="flex w-full items-center gap-2.5 rounded-xl border border-ink-700 bg-ink-850/60 px-3 py-2 text-left hover:border-signal-blue/30"
                      >
                        <Avatar name={eng.name} color={eng.avatar_color} src={eng.avatar_url} size={28} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[12.5px] font-medium text-ink-100">{eng.name}</div>
                          <div className="truncate text-[10.5px] text-ink-400">{eng.title}</div>
                        </div>
                      </button>
                    ))
                  )}
                  <button
                    onClick={() => navigate("/technician")}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-signal-blue/30 bg-signal-blue/10 px-3 py-2.5 text-[12.5px] font-semibold text-signal-blue"
                  >
                    Open technician simulator
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
