import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, ArrowLeft, FileUp, Loader2, UploadCloud } from "lucide-react";
import clsx from "clsx";
import { api } from "../lib/api";
import { useStore } from "../lib/store";
import { useSession } from "../lib/session";

const DISCIPLINES = ["Electrical", "Mechanical", "Controls", "Piping", "Structural"];

export function AddDrawingPage() {
  const navigate = useNavigate();
  const { engineers, currentEngineer } = useSession();
  const { refreshDrawings } = useStore();

  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [drawingNumber, setDrawingNumber] = useState("");
  const [revision, setRevision] = useState("A");
  const [title, setTitle] = useState("");
  const [discipline, setDiscipline] = useState("Electrical");
  const [authorId, setAuthorId] = useState(currentEngineer?.id ?? "");
  const [contextBlock, setContextBlock] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [sites, setSites] = useState<{ id: string; name: string }[]>([]);
  const [siteId, setSiteId] = useState("");

  useEffect(() => {
    api.sites().then(setSites);
  }, []);

  function pickFile(f: File | null | undefined) {
    if (!f) return;
    const ext = f.name.toLowerCase().split(".").pop();
    if (ext !== "dxf" && ext !== "pdf") {
      setError(
        ext === "dwg"
          ? "DWG is Autodesk's proprietary format and can't be parsed directly — export as DXF (File → Save/Export As → DXF in AutoCAD, SolidWorks, Inventor, Fusion 360, or Revit) and upload that."
          : "Upload a .dxf or .pdf file.",
      );
      return;
    }
    setError(null);
    setFile(f);
  }

  async function submit() {
    if (!file || !drawingNumber || !title || !authorId || !siteId) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await api.ingestDrawing({
        file,
        drawing_number: drawingNumber,
        revision,
        title,
        discipline,
        site_id: siteId,
        primary_author_id: authorId,
        context_block: contextBlock,
      });
      await refreshDrawings();
      navigate(`/drawings/${result.drawing.id}/regions`, { state: { warnings: result.warnings } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = file && drawingNumber && title && authorId && siteId && !submitting;

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="flex items-center gap-3 border-b border-ink-700 px-6 py-4">
        <button onClick={() => navigate(-1)} className="rounded-md p-1.5 text-ink-400 hover:bg-ink-800 hover:text-white">
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 className="text-[17px] font-bold text-ink-50">Add a drawing</h1>
          <p className="text-[12px] text-ink-400">
            Upload a real CAD export. Regions are auto-suggested from the file's own geometry — you'll confirm them
            next.
          </p>
        </div>
      </div>

      <div className="mx-auto w-full max-w-2xl space-y-5 px-6 py-8">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            pickFile(e.dataTransfer.files[0]);
          }}
          className={clsx(
            "flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition",
            dragOver ? "border-signal-teal/60 bg-signal-teal/5" : "border-ink-600 bg-ink-900/40",
          )}
        >
          {file ? (
            <>
              <FileUp size={24} className="text-signal-teal" />
              <div className="text-[13px] font-medium text-ink-100">{file.name}</div>
              <div className="text-[11px] text-ink-500">{(file.size / 1024).toFixed(0)} KB</div>
              <button onClick={() => setFile(null)} className="mt-1 text-[11.5px] text-ink-400 underline hover:text-ink-200">
                Choose a different file
              </button>
            </>
          ) : (
            <>
              <UploadCloud size={26} className="text-ink-400" />
              <div className="text-[13px] text-ink-200">Drag a .dxf or .pdf here, or</div>
              <label className="cursor-pointer rounded-lg border border-ink-600 bg-ink-850 px-3 py-1.5 text-[12px] font-medium text-ink-200 transition hover:border-signal-teal/40">
                Browse files
                <input
                  type="file"
                  accept=".dxf,.pdf"
                  className="hidden"
                  onChange={(e) => pickFile(e.target.files?.[0])}
                />
              </label>
              <div className="mt-1 text-[10.5px] text-ink-500">
                DXF is parsed as real vector geometry. PDF is rendered as an image (plus vector regions when it's a
                print-to-PDF export, not a scan). DWG isn't supported — export as DXF instead.
              </div>
            </>
          )}
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-signal-coral/30 bg-signal-coral/10 px-3 py-2 text-[12.5px] text-signal-coral">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Drawing number">
            <input value={drawingNumber} onChange={(e) => setDrawingNumber(e.target.value)} placeholder="E-4471" className={inputCls} />
          </Field>
          <Field label="Revision">
            <input value={revision} onChange={(e) => setRevision(e.target.value)} placeholder="A" className={inputCls} />
          </Field>
        </div>

        <Field label="Title">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Bulk Conveyor Drive Assembly" className={inputCls} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Discipline">
            <select value={discipline} onChange={(e) => setDiscipline(e.target.value)} className={inputCls}>
              {DISCIPLINES.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </Field>
          <Field label="Site">
            <select value={siteId} onChange={(e) => setSiteId(e.target.value)} className={inputCls}>
              <option value="">Select a site…</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Author of record">
          <select value={authorId} onChange={(e) => setAuthorId(e.target.value)} className={inputCls}>
            <option value="">Select an engineer…</option>
            {engineers.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} — {e.discipline}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Context notes (optional)" hint="Free text grounding the drawing — revision deltas, known callouts, anything downstream Q&A should be answered from.">
          <textarea
            value={contextBlock}
            onChange={(e) => setContextBlock(e.target.value)}
            rows={3}
            placeholder="e.g. Rev A adds a second tensioner bracket and updates the bolt torque spec to 90 ft-lb…"
            className={clsx(inputCls, "resize-none")}
          />
        </Field>

        <button
          onClick={submit}
          disabled={!canSubmit}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-signal-teal px-4 py-2.5 text-[13px] font-semibold text-ink-950 shadow-[var(--shadow-glow-teal)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting ? <Loader2 size={15} className="animate-spin" /> : <UploadCloud size={15} />}
          {submitting ? "Parsing drawing…" : "Upload & suggest regions"}
        </button>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 text-[11.5px] font-medium text-ink-300">{label}</div>
      {children}
      {hint && <div className="mt-1 text-[10.5px] text-ink-500">{hint}</div>}
    </label>
  );
}

const inputCls =
  "w-full rounded-lg border border-ink-600 bg-ink-850 px-3 py-2 text-[13px] text-ink-100 placeholder:text-ink-500 focus:border-signal-teal/50 focus:outline-none";
