import { useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { Avatar } from "./Avatar";
import type { User } from "../lib/types";

export function ProfilePhotoButton({ user, size = 26 }: { user: User; size?: number }) {
  const { updateCurrentEngineer } = useSession();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const updated = await api.uploadAvatar(user.id, file);
      updateCurrentEngineer(updated);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <Avatar name={user.name} color={user.avatar_color} src={user.avatar_url} size={size} />
      <button
        onClick={(e) => {
          e.stopPropagation();
          inputRef.current?.click();
        }}
        title="Change profile photo"
        className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border border-ink-950 bg-signal-blue text-white"
      >
        {uploading ? <Loader2 size={8} className="animate-spin" /> : <Camera size={7} />}
      </button>
      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={onFile} />
    </div>
  );
}
