import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Check, Plus, Trash2, Unplug } from "lucide-react";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { SOURCE_TYPES, SOURCE_TYPE_MAP } from "../lib/knowledgeSourceTypes";
import type { KnowledgeDocument, KnowledgeSource, KnowledgeSourceType, Site } from "../lib/types";
import { ConnectSourceModal } from "../components/ConnectSourceModal";
import { AddDocumentModal } from "../components/AddDocumentModal";
import { timeAgo } from "../lib/format";

export function SiteKnowledgePage() {
  const { currentEngineer } = useSession();
  const [sites, setSites] = useState<Site[]>([]);
  const [activeSiteId, setActiveSiteId] = useState<string | null>(null);
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [connectType, setConnectType] = useState<KnowledgeSourceType | "any" | null>(null);
  const [addDocSource, setAddDocSource] = useState<KnowledgeSource | null>(null);
  const [scopeDraft, setScopeDraft] = useState<Record<string, string>>({});
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

  async function grantScope(source: KnowledgeSource) {
    if (!currentEngineer) return;
    const draft = (scopeDraft[source.id] ?? "").trim();
    if (!draft) return;
    const meta = SOURCE_TYPE_MAP[source.type];
    const item = `${meta.scopePrefix}: ${draft}`;
    const updated = await api.addKnowledgeSourceScope(source.id, item, currentEngineer.id);
    setSources((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    setScopeDraft((prev) => ({ ...prev, [source.id]: "" }));
  }

  const connectedByType = useMemo(() => {
    const map = new Map<KnowledgeSourceType, KnowledgeSource[]>();
    for (const s of sources) {
      const list = map.get(s.type) ?? [];
      list.push(s);
      map.set(s.type, list);
    }
    return map;
  }, [sources]);

  const availableTypes = SOURCE_TYPES.filter((t) => !connectedByType.get(t.key)?.length);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-ink-700 px-6 py-4">
        <div>
          <h1 className="text-[17px] font-bold text-ink-50">Connectors</h1>
          <p className="text-[12px] text-ink-400">
            The AI reads from this site's connected sources, at the scope each one was granted — never full
            inbox or channel access.
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
            onClick={() => setConnectType("any")}
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
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {sources.map((source) => {
              const meta = SOURCE_TYPE_MAP[source.type];
              const docs = documents.filter((d) => d.source_id === source.id);
              return (
                <motion.div
                  key={source.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="flex flex-col rounded-xl border border-ink-700 bg-ink-900/50"
                >
                  <div className="p-4">
                    <div className="mb-2 flex items-start justify-between">
                      <span
                        className="flex h-9 w-9 items-center justify-center rounded-lg"
                        style={{ background: meta.bg, color: meta.color }}
                      >
                        {meta.icon}
                      </span>
                      {source.status === "connected" ? (
                        <span className="flex items-center gap-1 rounded-full bg-signal-teal/10 px-2 py-0.5 text-[10px] font-medium text-signal-teal">
                          <Check size={10} /> Connected
                        </span>
                      ) : (
                        <span className="rounded-full bg-ink-800 px-2 py-0.5 text-[10px] font-medium text-ink-500">
                          Disconnected
                        </span>
                      )}
                    </div>
                    <div className="text-[13.5px] font-semibold text-ink-100">{source.display_name}</div>
                    <div className="text-[11.5px] text-ink-400">{meta.description}</div>

                    {source.scope_items.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap gap-1">
                        {source.scope_items.map((item) => (
                          <span
                            key={item}
                            className="rounded-full bg-signal-blue/10 px-2 py-0.5 text-[10px] font-medium text-signal-blue"
                          >
                            {item}
                          </span>
                        ))}
                      </div>
                    )}

                    {source.status === "connected" && (
                      <div className="mt-2 flex items-center gap-1.5">
                        <div className="flex flex-1 items-center rounded-md border border-ink-600 bg-ink-850 pl-2 text-[11.5px] text-ink-100 focus-within:border-signal-teal/50">
                          <span className="shrink-0 text-ink-500">{meta.scopePrefix || "Add"}:</span>
                          <input
                            value={scopeDraft[source.id] ?? ""}
                            onChange={(e) => setScopeDraft((prev) => ({ ...prev, [source.id]: e.target.value }))}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                grantScope(source);
                              }
                            }}
                            placeholder={meta.scopePlaceholder || "note title"}
                            className="min-w-0 flex-1 bg-transparent px-1.5 py-1.5 placeholder:text-ink-500 focus:outline-none"
                          />
                        </div>
                        <button
                          onClick={() => grantScope(source)}
                          disabled={!(scopeDraft[source.id] ?? "").trim()}
                          className="flex shrink-0 items-center justify-center rounded-md border border-ink-600 p-1.5 text-ink-300 hover:bg-ink-800 disabled:opacity-40"
                          title={`Grant access to another ${meta.scopePrefix.toLowerCase() || "item"}`}
                        >
                          <Plus size={13} />
                        </button>
                      </div>
                    )}
                  </div>

                  {docs.length > 0 && (
                    <div className="max-h-52 divide-y divide-ink-800 overflow-y-auto border-t border-ink-700">
                      {docs.map((doc) => (
                        <div key={doc.id} className="flex items-start gap-2 px-4 py-2.5">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate text-[12px] font-medium text-ink-100">{doc.title}</span>
                            </div>
                            <p className="line-clamp-2 text-[11px] leading-relaxed text-ink-400">{doc.content}</p>
                          </div>
                          <button
                            onClick={() => removeDocument(doc)}
                            className="shrink-0 rounded-md p-1 text-ink-500 transition hover:bg-signal-coral/10 hover:text-signal-coral"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-auto flex items-center justify-between border-t border-ink-700 px-4 py-2.5 text-[11px] text-ink-500">
                    <span>
                      {docs.length} item{docs.length === 1 ? "" : "s"} · connected {timeAgo(source.connected_at)}
                    </span>
                    {source.status === "connected" && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setAddDocSource(source)}
                          className="text-ink-400 transition hover:text-signal-teal"
                        >
                          Add item
                        </button>
                        <button
                          onClick={() => disconnect(source)}
                          className="flex items-center gap-1 text-ink-400 transition hover:text-signal-coral"
                        >
                          <Unplug size={11} /> Disconnect
                        </button>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}

            {availableTypes.map((meta) => (
              <motion.button
                key={meta.key}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                onClick={() => setConnectType(meta.key)}
                className="flex flex-col items-start rounded-xl border border-dashed border-ink-600 bg-ink-900/20 p-4 text-left transition hover:border-signal-teal/40 hover:bg-ink-900/40"
              >
                <span
                  className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg opacity-80"
                  style={{ background: meta.bg, color: meta.color }}
                >
                  {meta.icon}
                </span>
                <div className="text-[13.5px] font-semibold text-ink-100">{meta.label}</div>
                <div className="text-[11.5px] text-ink-400">{meta.description}</div>
                <span className="mt-3 flex items-center gap-1 text-[11.5px] font-medium text-signal-teal">
                  <Plus size={12} /> Connect
                </span>
              </motion.button>
            ))}
          </div>
        )}
      </div>

      {connectType && activeSiteId && currentEngineer && (
        <ConnectSourceModal
          siteId={activeSiteId}
          connectedByUserId={currentEngineer.id}
          initialType={connectType === "any" ? undefined : connectType}
          onClose={() => setConnectType(null)}
          onConnected={(source) => {
            setSources((prev) => [...prev, source]);
            setConnectType(null);
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
