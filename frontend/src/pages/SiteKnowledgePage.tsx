import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Mail,
  MessagesSquare,
  Plus,
  StickyNote,
  Trash2,
  Unplug,
} from "lucide-react";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import type { KnowledgeDocument, KnowledgeSource, KnowledgeSourceType, Site } from "../lib/types";
import { ConnectSourceModal } from "../components/ConnectSourceModal";
import { AddDocumentModal } from "../components/AddDocumentModal";
import { timeAgo } from "../lib/format";

const TYPE_ICON: Record<KnowledgeSourceType, React.ReactNode> = {
  outlook: <Mail size={15} />,
  teams: <MessagesSquare size={15} />,
  manual: <StickyNote size={15} />,
};

export function SiteKnowledgePage() {
  const { currentEngineer } = useSession();
  const [sites, setSites] = useState<Site[]>([]);
  const [activeSiteId, setActiveSiteId] = useState<string | null>(null);
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [connectOpen, setConnectOpen] = useState(false);
  const [addDocSource, setAddDocSource] = useState<KnowledgeSource | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.sites().then(setSites);
  }, []);

  const engineerSites = useMemo(
    () => sites.filter((s) => currentEngineer?.site_ids.includes(s.id)),
    [sites, currentEngineer],
  );

  useEffect(() => {
    if (engineerSites.length && !activeSiteId) setActiveSiteId(engineerSites[0].id);
  }, [engineerSites, activeSiteId]);

  async function refresh(siteId: string) {
    setLoading(true);
    const [s, d] = await Promise.all([api.knowledgeSources(siteId), api.knowledgeDocuments({ siteId })]);
    setSources(s);
    setDocuments(d);
    setLoading(false);
  }

  useEffect(() => {
    if (activeSiteId) refresh(activeSiteId);
  }, [activeSiteId]);

  async function disconnect(source: KnowledgeSource) {
    const updated = await api.disconnectKnowledgeSource(source.id);
    setSources((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  }

  async function removeDocument(doc: KnowledgeDocument) {
    await api.deleteKnowledgeDocument(doc.id);
    setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
  }

  const activeSite = sites.find((s) => s.id === activeSiteId);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-ink-700 px-6 py-4">
        <div>
          <h1 className="text-[17px] font-bold text-ink-50">Site Knowledge</h1>
          <p className="text-[12px] text-ink-400">
            Context sources this site's engineers have connected — emails, Teams threads, notes — so the AI can
            answer with more than just the drawing itself.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {engineerSites.length > 1 && (
            <select
              value={activeSiteId ?? ""}
              onChange={(e) => setActiveSiteId(e.target.value)}
              className="rounded-lg border border-ink-600 bg-ink-850 px-2.5 py-1.5 text-[12.5px] text-ink-200 focus:border-signal-teal/50 focus:outline-none"
            >
              {engineerSites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={() => setConnectOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-signal-teal px-3 py-1.5 text-[12.5px] font-semibold text-ink-950 shadow-[var(--shadow-glow-teal)] transition hover:brightness-110"
          >
            <Plus size={14} />
            Connect source
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        {loading ? (
          <div className="text-[13px] text-ink-400">Loading…</div>
        ) : sources.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-ink-700 bg-ink-850 text-ink-400">
              <Mail size={20} />
            </div>
            <div className="text-[15px] font-semibold text-ink-100">No sources connected at {activeSite?.name}</div>
            <p className="max-w-sm text-[12.5px] text-ink-400">
              Connect Outlook, Teams, or add manual notes so technician questions at this plant can be answered from
              real context, not just the drawing.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {sources.map((source) => {
              const docs = documents.filter((d) => d.source_id === source.id);
              return (
                <motion.div
                  key={source.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="rounded-xl border border-ink-700 bg-ink-900/50"
                >
                  <div className="flex items-center gap-3 border-b border-ink-700 px-4 py-3">
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                        source.status === "connected" ? "bg-signal-teal/10 text-signal-teal" : "bg-ink-800 text-ink-500"
                      }`}
                    >
                      {TYPE_ICON[source.type]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-medium text-ink-100">{source.display_name}</div>
                      <div className="text-[11px] text-ink-500">
                        {source.status === "connected" ? "Connected" : "Disconnected"} {timeAgo(source.connected_at)} ·{" "}
                        {docs.length} item{docs.length === 1 ? "" : "s"}
                      </div>
                    </div>
                    {source.status === "connected" && (
                      <>
                        <button
                          onClick={() => setAddDocSource(source)}
                          className="flex items-center gap-1 rounded-md border border-ink-600 px-2 py-1 text-[11.5px] text-ink-300 transition hover:border-signal-teal/40 hover:text-signal-teal"
                        >
                          <Plus size={12} /> Add item
                        </button>
                        <button
                          onClick={() => disconnect(source)}
                          className="flex items-center gap-1 rounded-md border border-ink-600 px-2 py-1 text-[11.5px] text-ink-400 transition hover:border-signal-coral/40 hover:text-signal-coral"
                        >
                          <Unplug size={12} /> Disconnect
                        </button>
                      </>
                    )}
                  </div>
                  {docs.length > 0 && (
                    <div className="divide-y divide-ink-800">
                      {docs.map((doc) => (
                        <div key={doc.id} className="flex items-start gap-3 px-4 py-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-[12.5px] font-medium text-ink-100">{doc.title}</span>
                              {doc.author && <span className="text-[11px] text-ink-500">— {doc.author}</span>}
                            </div>
                            <p className="mt-0.5 line-clamp-2 text-[11.5px] leading-relaxed text-ink-400">
                              {doc.content}
                            </p>
                            {doc.keywords.length > 0 && (
                              <div className="mt-1.5 flex flex-wrap gap-1">
                                {doc.keywords.map((k) => (
                                  <span
                                    key={k}
                                    className="rounded-md bg-ink-800 px-1.5 py-0.5 font-mono text-[9.5px] text-ink-400"
                                  >
                                    {k}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => removeDocument(doc)}
                            className="shrink-0 rounded-md p-1 text-ink-500 transition hover:bg-signal-coral/10 hover:text-signal-coral"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {connectOpen && activeSiteId && currentEngineer && (
        <ConnectSourceModal
          siteId={activeSiteId}
          connectedByUserId={currentEngineer.id}
          onClose={() => setConnectOpen(false)}
          onConnected={(source) => {
            setSources((prev) => [...prev, source]);
            setConnectOpen(false);
          }}
        />
      )}

      {addDocSource && (
        <AddDocumentModal
          source={addDocSource}
          onClose={() => setAddDocSource(null)}
          onAdded={(doc) => {
            setDocuments((prev) => [doc, ...prev]);
            setAddDocSource(null);
          }}
        />
      )}
    </div>
  );
}
