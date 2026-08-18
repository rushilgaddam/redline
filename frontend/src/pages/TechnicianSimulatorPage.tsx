import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Camera, CheckCircle2, ChevronDown, Loader2, MapPin, QrCode, Send, Signal, Wifi, X } from "lucide-react";
import clsx from "clsx";
import { api } from "../lib/api";
import { useStore } from "../lib/store";
import type { ConversationItem, DrawingSummary, Site, User } from "../lib/types";
import { MOCK_PHOTOS } from "../lib/mockPhotos";
import { PhotoCard } from "../components/PhotoCard";
import { formatClock, formatPhone } from "../lib/format";

interface LocalBubble {
  id: string;
  sender: "technician" | "incoming";
  text: string;
  photoRef?: string | null;
  at: string;
  pending?: boolean;
  senderName?: string | null;
  drawingNumber?: string | null;
  drawingTitle?: string | null;
  regionLabel?: string | null;
}

export function TechnicianSimulatorPage() {
  const navigate = useNavigate();
  const { users, drawings, upsertFlag, upsertDrawing } = useStore();
  const technicians = useMemo(() => users.filter((u) => u.role === "technician"), [users]);

  const [technician, setTechnician] = useState<User | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [activeSiteId, setActiveSiteId] = useState<string | null>(null);
  const [conversation, setConversation] = useState<ConversationItem[]>([]);
  const [localBubbles, setLocalBubbles] = useState<LocalBubble[]>([]);
  const [text, setText] = useState("");
  const [photoRef, setPhotoRef] = useState<string | null>(null);
  const [photoPicker, setPhotoPicker] = useState(false);
  const [tagDrawing, setTagDrawing] = useState<DrawingSummary | null>(null);
  const [tagPicker, setTagPicker] = useState(false);
  const [candidates, setCandidates] = useState<DrawingSummary[]>([]);
  const [sending, setSending] = useState(false);
  const [closing, setClosing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.sites().then(setSites);
  }, []);

  useEffect(() => {
    if (technicians.length && !technician) setTechnician(technicians[0]);
  }, [technicians, technician]);

  const technicianSites = useMemo(
    () => sites.filter((s) => technician?.site_ids.includes(s.id)),
    [sites, technician],
  );

  useEffect(() => {
    if (!technician) return;
    setActiveSiteId((prev) => (prev && technician.site_ids.includes(prev) ? prev : (technician.site_ids[0] ?? null)));
  }, [technician]);

  useEffect(() => {
    if (!technician) return;
    setLocalBubbles([]);
    setCandidates([]);
    setTagDrawing(null);
    api.conversation(technician.id).then(setConversation);
  }, [technician]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [conversation, localBubbles, candidates]);

  async function sendMessage(overrideDrawingId?: string, overrideText?: string) {
    if (!technician) return;
    const messageText = overrideText ?? text;
    if (!messageText.trim()) return;
    setSending(true);
    const tempId = crypto.randomUUID();
    setLocalBubbles((b) => [
      ...b,
      { id: tempId, sender: "technician", text: messageText, photoRef, at: new Date().toISOString(), pending: true },
    ]);
    setCandidates([]);
    if (!overrideDrawingId) {
      setText("");
    }

    try {
      const res = await api.smsInbound({
        technician_id: technician.id,
        text: messageText,
        photo_ref: photoRef,
        asset_tag_drawing_id: overrideDrawingId ?? tagDrawing?.id ?? null,
        site_id: activeSiteId,
      });
      setLocalBubbles((b) => [
        ...b,
        { id: crypto.randomUUID(), sender: "incoming", text: res.reply_text, at: new Date().toISOString() },
      ]);
      if (res.flag) upsertFlag(res.flag);
      if (res.candidates.length) setCandidates(res.candidates);
      if (technician) {
        const fresh = await api.conversation(technician.id);
        setConversation(fresh);
        setLocalBubbles([]);
      }
    } finally {
      setSending(false);
      setPhotoRef(null);
    }
  }

  async function markComplete() {
    if (!tagDrawing || tagDrawing.status === "closed" || !technician) return;
    setClosing(true);
    try {
      const updated = await api.closeDrawing(tagDrawing.id, technician.id);
      upsertDrawing(updated);
      setTagDrawing((prev) => (prev ? { ...prev, ...updated } : prev));
      setLocalBubbles((b) => [
        ...b,
        {
          id: crypto.randomUUID(),
          sender: "incoming",
          text: `${updated.drawing_number} marked as fully assembled. Thanks for the update — reply here anytime if something still needs a look.`,
          at: new Date().toISOString(),
        },
      ]);
    } finally {
      setClosing(false);
    }
  }

  const bubbles = useMemo<LocalBubble[]>(() => {
    const fromServer: LocalBubble[] = conversation.map((c) => ({
      id: `${c.flag_id}-${c.created_at}-${c.sender}`,
      sender: c.sender === "technician" ? "technician" : "incoming",
      text: c.text,
      photoRef: c.photo_ref,
      at: c.created_at,
      senderName: c.sender === "technician" ? null : c.sender_name,
      drawingNumber: c.drawing_number,
      drawingTitle: c.drawing_title,
      regionLabel: c.region_label,
    }));
    return [...fromServer, ...localBubbles];
  }, [conversation, localBubbles]);

  const liveTagDrawing = tagDrawing ? (drawings.find((d) => d.id === tagDrawing.id) ?? tagDrawing) : null;
  const drawingsAtSite = useMemo(
    () => drawings.filter((d) => d.site_id === activeSiteId),
    [drawings, activeSiteId],
  );

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-ink-950 bg-grain">
      <button
        onClick={() => navigate("/inbox")}
        className="absolute left-6 top-6 flex items-center gap-1.5 rounded-lg border border-ink-700 bg-ink-900/70 px-3 py-1.5 text-[12.5px] text-ink-300 backdrop-blur-sm transition hover:text-white"
      >
        <ArrowLeft size={14} /> Engineer view
      </button>

      <div className="absolute right-6 top-6 w-64 space-y-2">
        <TechnicianPicker technicians={technicians} current={technician} onSelect={setTechnician} />
        <PlantPicker
          sites={technicianSites}
          current={sites.find((s) => s.id === activeSiteId) ?? null}
          onSelect={(s) => {
            setActiveSiteId(s.id);
            setTagDrawing(null);
          }}
        />
      </div>

      {/* Phone frame */}
      <div className="flex h-[820px] w-[390px] flex-col overflow-hidden rounded-[2.5rem] border-[6px] border-ink-800 bg-black shadow-2xl">
        <div className="flex items-center justify-between px-6 pb-1 pt-3 font-mono text-[11px] text-white">
          <span>9:41</span>
          <div className="flex items-center gap-1">
            <Signal size={12} />
            <Wifi size={12} />
          </div>
        </div>

        <div className="flex flex-col items-center gap-1 border-b border-white/10 bg-ink-950 px-4 pb-3 pt-1">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-signal-coral/15 text-[13px] font-bold text-signal-coral">
            R
          </div>
          <div className="text-[13px] font-semibold text-white">Redline</div>
          <div className="font-mono text-[10.5px] text-ink-400">+1 (555) 010-9200</div>
        </div>

        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-ink-950 px-3 py-4">
          {bubbles.length === 0 && (
            <div className="mt-10 text-center text-[12px] text-ink-500">
              Text a photo of the equipment and what's wrong. No app, no login — this number is you.
            </div>
          )}
          {bubbles.map((b) => (
            <div key={b.id} className={clsx("flex", b.sender === "technician" ? "justify-end" : "justify-start")}>
              <div className="max-w-[78%]">
                {b.sender === "incoming" && (b.senderName || b.drawingNumber) && (
                  <div className="mb-1 flex items-center gap-1.5 px-1 text-[10.5px] text-ink-400">
                    {b.senderName && <span className="font-medium text-ink-200">{b.senderName}</span>}
                    {b.senderName && b.drawingNumber && <span className="text-ink-600">·</span>}
                    {b.drawingNumber && (
                      <span className="font-mono">
                        {b.drawingNumber}
                        {b.regionLabel ? ` — ${b.regionLabel}` : b.drawingTitle ? ` — ${b.drawingTitle}` : ""}
                      </span>
                    )}
                  </div>
                )}
                <div
                  className={clsx(
                    "rounded-2xl px-3.5 py-2 text-[13.5px] leading-relaxed",
                    b.sender === "technician"
                      ? "rounded-br-md bg-signal-blue text-ink-950"
                      : "rounded-bl-md bg-ink-700 text-ink-50",
                    b.pending && "opacity-60",
                  )}
                >
                  {b.text}
                  {b.photoRef && (
                    <div className="mt-1.5">
                      <PhotoCard photoRef={b.photoRef} size="sm" />
                    </div>
                  )}
                </div>
                <div
                  className={clsx(
                    "mt-0.5 font-mono text-[9.5px] text-ink-500",
                    b.sender === "technician" ? "text-right" : "text-left",
                  )}
                >
                  {formatClock(b.at)}
                </div>
              </div>
            </div>
          ))}

          {sending && (
            <div className="flex justify-start">
              <div className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-ink-700 px-3.5 py-2.5">
                <Dot delay={0} />
                <Dot delay={0.15} />
                <Dot delay={0.3} />
              </div>
            </div>
          )}

          {candidates.length > 0 && (
            <div className="flex flex-col items-start gap-1.5">
              {candidates.map((c, i) => (
                <button
                  key={c.id}
                  onClick={() => sendMessage(c.id, `${i + 1}`)}
                  className="rounded-xl border border-ink-600 bg-ink-850 px-3 py-1.5 text-[12px] text-ink-200 transition hover:border-signal-blue/50"
                >
                  {i + 1}. {c.drawing_number} — {c.title}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-white/10 bg-ink-950 p-2.5">
          {liveTagDrawing && (
            <div
              className={clsx(
                "mb-1.5 flex items-center gap-1.5 rounded-lg px-2 py-1 text-[10.5px]",
                liveTagDrawing.status === "closed" ? "bg-ink-700 text-ink-300" : "bg-signal-teal/10 text-signal-teal",
              )}
            >
              <QrCode size={11} />
              Scanned tag: {liveTagDrawing.drawing_number}
              {liveTagDrawing.status === "closed" && (
                <span className="rounded-full bg-ink-600 px-1.5 py-0.5 text-[9px] font-medium text-ink-200">
                  assembly complete
                </span>
              )}
              {liveTagDrawing.status !== "closed" && (
                <button
                  onClick={markComplete}
                  disabled={closing}
                  className="flex items-center gap-1 rounded-full border border-signal-teal/30 px-1.5 py-0.5 text-[9.5px] font-medium text-signal-teal transition hover:bg-signal-teal/15 disabled:opacity-50"
                >
                  {closing ? <Loader2 size={9} className="animate-spin" /> : <CheckCircle2 size={9} />}
                  Mark complete
                </button>
              )}
              <button onClick={() => setTagDrawing(null)} className="ml-auto text-ink-400 hover:text-white">
                <X size={11} />
              </button>
            </div>
          )}
          {photoRef && (
            <div className="mb-1.5 flex items-center gap-2">
              <PhotoCard photoRef={photoRef} size="sm" />
              <button onClick={() => setPhotoRef(null)} className="text-ink-400 hover:text-white">
                <X size={13} />
              </button>
            </div>
          )}

          <div className="flex items-end gap-1.5">
            <button
              onClick={() => setPhotoPicker((v) => !v)}
              className={clsx(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition",
                photoRef ? "bg-signal-blue text-ink-950" : "bg-ink-800 text-ink-300 hover:bg-ink-700",
              )}
            >
              <Camera size={16} />
            </button>
            <button
              onClick={() => setTagPicker((v) => !v)}
              className={clsx(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition",
                tagDrawing ? "bg-signal-teal text-ink-950" : "bg-ink-800 text-ink-300 hover:bg-ink-700",
              )}
              title="Simulate scanning an asset QR tag"
            >
              <QrCode size={16} />
            </button>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              rows={1}
              placeholder="Text message"
              className="max-h-24 flex-1 resize-none rounded-2xl bg-ink-800 px-3.5 py-2 text-[13.5px] text-white placeholder:text-ink-500 focus:outline-none"
            />
            <button
              onClick={() => sendMessage()}
              disabled={sending || !text.trim()}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-signal-blue text-ink-950 transition disabled:opacity-30"
            >
              {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            </button>
          </div>

          {photoPicker && (
            <div className="mt-2 grid grid-cols-4 gap-1.5 rounded-xl border border-ink-700 bg-ink-900 p-2">
              {MOCK_PHOTOS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setPhotoRef(p.id);
                    setPhotoPicker(false);
                  }}
                  className="overflow-hidden rounded-lg border border-ink-700 transition hover:border-signal-blue/50"
                  title={p.label}
                >
                  <PhotoCard photoRef={p.id} size="sm" />
                </button>
              ))}
            </div>
          )}

          {tagPicker && (
            <div className="mt-2 max-h-40 space-y-1 overflow-y-auto rounded-xl border border-ink-700 bg-ink-900 p-2">
              <div className="px-2 pb-1 text-[9.5px] uppercase tracking-wide text-ink-500">
                Equipment tags at {sites.find((s) => s.id === activeSiteId)?.name ?? "this plant"}
              </div>
              {drawingsAtSite.length === 0 && (
                <div className="px-2 py-2 text-[11px] text-ink-500">No drawings at this plant yet.</div>
              )}
              {drawingsAtSite.map((d) => (
                <button
                  key={d.id}
                  onClick={() => {
                    setTagDrawing(d);
                    setTagPicker(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11.5px] text-ink-200 hover:bg-ink-800"
                >
                  <QrCode size={12} className="text-signal-teal" />
                  {d.drawing_number} — {d.title}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TechnicianPicker({
  technicians,
  current,
  onSelect,
}: {
  technicians: User[];
  current: User | null;
  onSelect: (u: User) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 rounded-lg border border-ink-700 bg-ink-900/70 px-3 py-2 text-left backdrop-blur-sm"
      >
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12.5px] font-medium text-ink-100">{current?.name ?? "Select technician"}</div>
          <div className="truncate font-mono text-[10.5px] text-ink-400">{formatPhone(current?.phone ?? null)}</div>
        </div>
        <ChevronDown size={13} className="text-ink-400" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-full overflow-hidden rounded-lg border border-ink-600 bg-ink-850 shadow-2xl">
          {technicians.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                onSelect(t);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12.5px] text-ink-100 hover:bg-ink-700"
            >
              {t.name}
              <span className="ml-auto font-mono text-[10px] text-ink-500">{formatPhone(t.phone)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function PlantPicker({
  sites,
  current,
  onSelect,
}: {
  sites: Site[];
  current: Site | null;
  onSelect: (s: Site) => void;
}) {
  const [open, setOpen] = useState(false);

  if (sites.length <= 1) {
    return (
      <div className="flex w-full items-center gap-2 rounded-lg border border-ink-700 bg-ink-900/70 px-3 py-2 backdrop-blur-sm">
        <MapPin size={13} className="shrink-0 text-signal-teal" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[11px] text-ink-400">Plant</div>
          <div className="truncate text-[12px] font-medium text-ink-100">{current?.name ?? "—"}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 rounded-lg border border-ink-700 bg-ink-900/70 px-3 py-2 text-left backdrop-blur-sm"
      >
        <MapPin size={13} className="shrink-0 text-signal-teal" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[11px] text-ink-400">Plant</div>
          <div className="truncate text-[12px] font-medium text-ink-100">{current?.name ?? "Select plant"}</div>
        </div>
        <ChevronDown size={13} className="text-ink-400" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-full overflow-hidden rounded-lg border border-ink-600 bg-ink-850 shadow-2xl">
          {sites.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                onSelect(s);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-ink-100 hover:bg-ink-700"
            >
              <MapPin size={12} className="shrink-0 text-signal-teal" />
              {s.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Dot({ delay }: { delay: number }) {
  return (
    <span
      className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-400"
      style={{ animationDelay: `${delay}s` }}
    />
  );
}
