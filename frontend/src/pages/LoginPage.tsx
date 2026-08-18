import { useNavigate } from "react-router-dom";
import { HardHat, Wrench } from "lucide-react";
import { useSession } from "../lib/session";
import { Avatar } from "../components/Avatar";

export function LoginPage() {
  const { engineers, setCurrentEngineer, loading } = useSession();
  const navigate = useNavigate();

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-ink-950 bg-grain">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(45,230,196,0.06),transparent_60%)]" />
      <div className="relative w-full max-w-3xl px-6">
        <div className="mb-10 flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-signal-coral/40 bg-signal-coral/10">
            <div className="h-5 w-5 rounded-full border-[3px] border-signal-coral" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-ink-50">Redline</h1>
          <p className="mt-1.5 max-w-md text-[13px] text-ink-400">
            A technician texts a photo of a drawing. The engineer of record answers. Pick a view to explore.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-2xl border border-ink-700 bg-ink-900/60 p-5">
            <div className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-ink-100">
              <HardHat size={16} className="text-signal-teal" />
              Engineer web app
            </div>
            <p className="mb-4 text-[12px] leading-relaxed text-ink-400">
              A passive inbox. Pick an engineer identity to see the flags routed to them.
            </p>
            {loading ? (
              <div className="text-[12px] text-ink-500">Loading roster…</div>
            ) : (
              <div className="space-y-1.5">
                {engineers.map((eng) => (
                  <button
                    key={eng.id}
                    onClick={() => {
                      setCurrentEngineer(eng);
                      navigate("/inbox");
                    }}
                    className="flex w-full items-center gap-2.5 rounded-xl border border-ink-700 bg-ink-850/60 px-3 py-2.5 text-left transition hover:border-signal-teal/40 hover:bg-ink-800"
                  >
                    <Avatar name={eng.name} color={eng.avatar_color} size={32} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-medium text-ink-100">{eng.name}</div>
                      <div className="truncate text-[11px] text-ink-400">{eng.title}</div>
                    </div>
                    {eng.out_of_office && (
                      <span className="shrink-0 rounded-full bg-signal-amber/15 px-1.5 py-0.5 text-[9px] font-medium text-signal-amber">
                        OOO
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col rounded-2xl border border-ink-700 bg-ink-900/60 p-5">
            <div className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-ink-100">
              <Wrench size={16} className="text-signal-blue" />
              Technician SMS
            </div>
            <p className="mb-4 text-[12px] leading-relaxed text-ink-400">
              Zero learning curve — phone number is identity, no app or login. Text a photo of the equipment and a
              question.
            </p>
            <button
              onClick={() => navigate("/technician")}
              className="mt-auto flex items-center justify-center gap-2 rounded-xl border border-signal-blue/30 bg-signal-blue/10 px-4 py-3 text-[13px] font-semibold text-signal-blue transition hover:bg-signal-blue/15"
            >
              Open technician simulator
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
