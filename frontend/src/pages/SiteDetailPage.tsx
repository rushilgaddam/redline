import { useEffect, useState } from "react";
import { NavLink, Outlet, useParams } from "react-router-dom";
import clsx from "clsx";
import { api } from "../lib/api";
import type { Site } from "../lib/types";

export function SiteDetailPage() {
  const { siteId } = useParams<{ siteId: string }>();
  const [site, setSite] = useState<Site | null>(null);

  useEffect(() => {
    if (!siteId) return;
    api.sites().then((all) => setSite(all.find((s) => s.id === siteId) ?? null));
  }, [siteId]);

  const tabs = [
    { to: `/projects/${siteId}`, label: "Overview", end: true },
    { to: `/projects/${siteId}/activity`, label: "Activity", end: false },
    { to: `/projects/${siteId}/settings`, label: "Settings", end: false },
  ];

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-ink-700 px-6 py-4">
        <h1 className="text-[17px] font-bold text-ink-50">{site?.name ?? "Project"}</h1>
        <nav className="mt-3 flex items-center gap-1">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                clsx(
                  "rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition-colors",
                  isActive ? "bg-ink-800 text-ink-50" : "text-ink-400 hover:bg-ink-850 hover:text-ink-100",
                )
              }
            >
              {t.label}
            </NavLink>
          ))}
        </nav>
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <Outlet context={{ siteId: siteId!, site }} />
      </div>
    </div>
  );
}
