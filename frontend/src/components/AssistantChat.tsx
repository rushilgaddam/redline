import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUp, Sparkles } from "lucide-react";
import { api } from "../lib/api";
import { useSession } from "../lib/session";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  flag_ids?: string[];
  drawing_ids?: string[];
}

const SUGGESTIONS = ["Anything pending I need to look at?", "What's overdue?", "What did I resolve today?", "What's my status?"];

export function AssistantChat({ siteId, compact = false }: { siteId?: string; compact?: boolean }) {
  const { currentEngineer } = useSession();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [asking, setAsking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, asking]);

  async function ask(question: string) {
    if (!currentEngineer || !question.trim() || asking) return;
    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: "user", text: question };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setAsking(true);
    try {
      const answer = await api.assistantAsk({ engineer_id: currentEngineer.id, question, site_id: siteId });
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "assistant", text: answer.text, flag_ids: answer.flag_ids, drawing_ids: answer.drawing_ids },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "assistant", text: "Couldn't reach the assistant — try again in a moment." },
      ]);
    } finally {
      setAsking(false);
    }
  }

  return (
    <div className="flex flex-col rounded-xl border border-ink-700 bg-ink-900/50">
      <div className="flex items-center gap-2 border-b border-ink-700 px-4 py-2.5">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-signal-blue/10 text-signal-blue">
          <Sparkles size={13} />
        </span>
        <span className="text-[12.5px] font-semibold text-ink-100">Ask anything</span>
      </div>

      {messages.length > 0 && (
        <div ref={scrollRef} className={compact ? "max-h-56 overflow-y-auto px-4 py-3" : "max-h-80 overflow-y-auto px-4 py-3"}>
          <div className="space-y-3">
            <AnimatePresence initial={false}>
              {messages.map((m) => (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
                >
                  <div
                    className={
                      m.role === "user"
                        ? "max-w-[85%] rounded-xl rounded-br-sm bg-signal-blue/10 px-3 py-2 text-[12.5px] text-ink-100"
                        : "max-w-[90%] rounded-xl rounded-bl-sm bg-ink-850 px-3 py-2 text-[12.5px] leading-relaxed text-ink-200"
                    }
                  >
                    <div className="whitespace-pre-line">{m.text}</div>
                    {m.role === "assistant" && !!m.flag_ids?.length && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {m.flag_ids.slice(0, 5).map((fid, i) => (
                          <button
                            key={fid}
                            onClick={() => navigate(`/drawings/${m.drawing_ids?.[i] ?? ""}`)}
                            className="rounded-full border border-ink-600 px-2 py-0.5 text-[10px] text-ink-400 hover:border-signal-blue/40 hover:text-signal-blue"
                          >
                            open flag →
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {asking && (
              <div className="flex justify-start">
                <div className="flex items-center gap-1 rounded-xl rounded-bl-sm bg-ink-850 px-3 py-2">
                  {[0, 1, 2].map((i) => (
                    <motion.span
                      key={i}
                      className="h-1.5 w-1.5 rounded-full bg-ink-400"
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {messages.length === 0 && (
        <div className="flex flex-wrap gap-1.5 px-4 pt-3">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => ask(s)}
              className="rounded-full border border-ink-700 bg-ink-850/60 px-2.5 py-1 text-[11px] text-ink-400 transition hover:border-signal-blue/40 hover:text-signal-blue"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
        className="flex items-center gap-2 px-3 py-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask anything…"
          className="min-w-0 flex-1 rounded-lg border border-ink-600 bg-ink-850 px-3 py-2 text-[13px] text-ink-100 placeholder:text-ink-500 focus:border-signal-blue/50 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!input.trim() || asking}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-signal-blue text-white disabled:opacity-40"
        >
          <ArrowUp size={15} />
        </button>
      </form>
    </div>
  );
}
