import clsx from "clsx";
import { Bot, Radio, User as UserIcon } from "lucide-react";
import type { Message } from "../lib/types";
import { formatClock } from "../lib/format";
import { PhotoCard } from "./PhotoCard";

const SENDER_META: Record<Message["sender"], { label: string; icon: React.ReactNode; align: "left" | "right"; tone: string }> = {
  technician: { label: "Technician", icon: <UserIcon size={11} />, align: "left", tone: "border-ink-600 bg-ink-800" },
  ai: { label: "AI draft", icon: <Bot size={11} />, align: "left", tone: "border-signal-amber/30 bg-signal-amber/10" },
  engineer: { label: "You", icon: <UserIcon size={11} />, align: "right", tone: "border-signal-teal/30 bg-signal-teal/10" },
  system: { label: "System", icon: <Radio size={11} />, align: "left", tone: "border-ink-700 bg-ink-850" },
};

export function MessageBubble({ message }: { message: Message }) {
  const meta = SENDER_META[message.sender];
  return (
    <div className={clsx("flex flex-col gap-1", meta.align === "right" && "items-end")}>
      <div className="flex items-center gap-1.5 px-0.5 text-[10.5px] font-medium uppercase tracking-wider text-ink-400">
        {meta.icon}
        {meta.label}
        <span className="font-normal normal-case text-ink-500">{formatClock(message.created_at)}</span>
      </div>
      <div
        className={clsx(
          "max-w-[88%] rounded-xl border px-3 py-2 text-[13px] leading-relaxed text-ink-100",
          meta.tone,
          message.sender === "ai" && "italic",
        )}
      >
        {message.sender === "ai" && (
          <div className="mb-1 not-italic text-[10px] font-semibold uppercase tracking-wide text-signal-amber">
            Tentative — not confirmed
          </div>
        )}
        {message.text}
        {message.photo_ref && (
          <div className="mt-2">
            <PhotoCard photoRef={message.photo_ref} size="sm" />
          </div>
        )}
      </div>
    </div>
  );
}
