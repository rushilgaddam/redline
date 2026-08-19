import type { ReactNode } from "react";
import {
  Calendar,
  FolderOpen,
  Mail,
  MessagesSquare,
  Sheet,
  StickyNote,
} from "lucide-react";
import { createElement } from "react";
import type { KnowledgeSourceType } from "./types";

export interface SourceTypeMeta {
  key: KnowledgeSourceType;
  label: string;
  description: string;
  icon: ReactNode;
  color: string; // brand-ish accent, used for the icon tile, never an actual logo
  bg: string;
  namePlaceholder: string;
  scopeKind: string;
  scopePrefix: string;
  scopePlaceholder: string;
  scopeHelp: string;
}

// Colored icon tiles standing in for each app's identity without using any
// actual trademarked logo artwork — safe to render, still legible at a
// glance which app a card represents.
export const SOURCE_TYPES: SourceTypeMeta[] = [
  {
    key: "google_drive",
    label: "Google Drive",
    description: "Drawings, quotations, studies, and executed documents",
    icon: createElement(FolderOpen, { size: 18 }),
    color: "#1a73e8",
    bg: "#e8f0fe",
    namePlaceholder: "e.g. Engineering Shared Drive",
    scopeKind: "folders",
    scopePrefix: "Folder",
    scopePlaceholder: "e.g. Panel B Drawings",
    scopeHelp: "Name the specific shared drives or folders Redline can read — not your whole Drive.",
  },
  {
    key: "gmail",
    label: "Gmail",
    description: "Supplier and counterparty correspondence",
    icon: createElement(Mail, { size: 18 }),
    color: "#ea4335",
    bg: "#fce8e6",
    namePlaceholder: "e.g. Marisol Rivera's Gmail",
    scopeKind: "labels",
    scopePrefix: "Label",
    scopePlaceholder: "e.g. Panel B",
    scopeHelp: "Name the specific labels Redline can read — not the whole inbox.",
  },
  {
    key: "google_sheets",
    label: "Google Sheets",
    description: "Equipment registers, milestone dates, and trackers",
    icon: createElement(Sheet, { size: 18 }),
    color: "#0f9d58",
    bg: "#e6f4ea",
    namePlaceholder: "e.g. Panel B Tracker",
    scopeKind: "workbooks",
    scopePrefix: "Workbook",
    scopePlaceholder: "e.g. Equipment Register",
    scopeHelp: "Name the specific spreadsheets Redline can read.",
  },
  {
    key: "google_calendar",
    label: "Google Calendar",
    description: "Milestone holds, inspections, and site visits",
    icon: createElement(Calendar, { size: 18 }),
    color: "#4285f4",
    bg: "#e8f0fe",
    namePlaceholder: "e.g. Panel B Site Calendar",
    scopeKind: "calendars",
    scopePrefix: "Calendar",
    scopePlaceholder: "e.g. Site Inspections",
    scopeHelp: "Name the specific calendars Redline can read.",
  },
  {
    key: "outlook",
    label: "Outlook",
    description: "Supplier and counterparty correspondence",
    icon: createElement(Mail, { size: 18 }),
    color: "#0078d4",
    bg: "#e5f1fb",
    namePlaceholder: "e.g. Marisol Rivera's Outlook",
    scopeKind: "labels",
    scopePrefix: "Label",
    scopePlaceholder: "e.g. Panel B",
    scopeHelp: "Name the specific mail folders Redline can read — not the whole inbox.",
  },
  {
    key: "teams",
    label: "Teams",
    description: "Shift handoffs and field discussion threads",
    icon: createElement(MessagesSquare, { size: 18 }),
    color: "#6264a7",
    bg: "#ecebf7",
    namePlaceholder: "e.g. #line-1-electrical",
    scopeKind: "channels",
    scopePrefix: "Channel",
    scopePlaceholder: "e.g. #line-1-electrical",
    scopeHelp: "Name the specific channels Redline can read — not the whole workspace.",
  },
  {
    key: "manual",
    label: "Manual notes",
    description: "Notes an engineer types in directly",
    icon: createElement(StickyNote, { size: 18 }),
    color: "#71717a",
    bg: "#f4f4f5",
    namePlaceholder: "e.g. Shift handoff log",
    scopeKind: "items",
    scopePrefix: "",
    scopePlaceholder: "",
    scopeHelp: "No external access — you'll paste in content yourself.",
  },
];

export const SOURCE_TYPE_MAP: Record<KnowledgeSourceType, SourceTypeMeta> = Object.fromEntries(
  SOURCE_TYPES.map((t) => [t.key, t]),
) as Record<KnowledgeSourceType, SourceTypeMeta>;
