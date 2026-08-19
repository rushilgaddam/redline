import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Building2, UserPlus } from "lucide-react";
import { api } from "../lib/api";
import type { Site, User } from "../lib/types";
import { Avatar } from "../components/Avatar";
import { ProfilePhotoButton } from "../components/ProfilePhotoButton";
import { AddCollaboratorModal } from "../components/AddCollaboratorModal";
import { useSession } from "../lib/session";

const ROLE_BADGE: Record<string, string> = {
  engineer: "bg-signal-blue/10 text-signal-blue",
  reviewer: "bg-signal-teal/10 text-signal-teal",
  technician: "bg-signal-amber/10 text-signal-amber",
  admin: "bg-ink-700 text-ink-200",
};

export function SiteSettingsTab() {
  const { siteId, site } = useOutletContext<{ siteId: string; site: Site | null }>();
  const { currentEngineer } = useSession();
  const [collaborators, setCollaborators] = useState<User[] | null>(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    api.siteCollaborators(siteId).then(setCollaborators);
  }, [siteId]);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="rounded-xl border border-ink-700 bg-ink-900/50 p-4">
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-signal-blue/10 text-signal-blue">
            <Building2 size={14} />
          </span>
          <div className="text-[13px] font-semibold text-ink-100">Project details</div>
        </div>
        <div className="grid grid-cols-2 gap-4 text-[12.5px]">
          <div>
            <div className="text-ink-500">Site name</div>
            <div className="mt-0.5 font-medium text-ink-100">{site?.name ?? "—"}</div>
          </div>
          <div>
            <div className="text-ink-500">Site ID</div>
            <div className="mt-0.5 font-mono text-ink-300">{siteId}</div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-ink-700 bg-ink-900/50">
        <div className="flex items-center justify-between border-b border-ink-700 px-4 py-3">
          <div>
            <div className="text-[13px] font-semibold text-ink-100">Collaborators</div>
            <div className="text-[11.5px] text-ink-400">Engineers, reviewers, and technicians assigned to this site.</div>
          </div>
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 rounded-lg border border-ink-600 px-2.5 py-1.5 text-[11.5px] font-medium text-ink-300 hover:bg-ink-800"
          >
            <UserPlus size={13} />
            Add
          </button>
        </div>
        {!collaborators ? (
          <div className="px-4 py-6 text-[12.5px] text-ink-400">Loading…</div>
        ) : (
          <div className="divide-y divide-ink-800">
            {collaborators.map((u) => {
              const isSelf = currentEngineer?.id === u.id;
              return (
                <div key={u.id} className="flex items-center gap-3 px-4 py-3">
                  {isSelf ? (
                    <ProfilePhotoButton user={u} size={32} />
                  ) : (
                    <Avatar name={u.name} color={u.avatar_color} src={u.avatar_url} size={32} />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12.5px] font-medium text-ink-100">{u.name}</div>
                    <div className="truncate text-[11px] capitalize text-ink-400">
                      {u.title || u.discipline || u.role}
                    </div>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${ROLE_BADGE[u.role] ?? "bg-ink-700 text-ink-200"}`}>
                    {u.role}
                  </span>
                  {u.out_of_office && (
                    <span className="rounded-full bg-signal-amber/15 px-1.5 py-0.5 text-[9px] font-medium text-signal-amber">
                      OOO
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {adding && (
        <AddCollaboratorModal
          siteId={siteId}
          onClose={() => setAdding(false)}
          onAdded={(u) => {
            setCollaborators((prev) => (prev?.some((c) => c.id === u.id) ? prev : [...(prev ?? []), u]));
            setAdding(false);
          }}
        />
      )}
    </div>
  );
}
