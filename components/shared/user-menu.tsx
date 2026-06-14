"use client";

import { useEffect, useRef, useState } from "react";
import { User, Gear, SignOut } from "@phosphor-icons/react/dist/ssr";
import { signOut } from "@/lib/actions/auth";

interface UserMenuProps {
  user: { email?: string | null };
  profile: { full_name?: string | null; avatar_url?: string | null } | null;
}

/**
 * Avatar dropdown that surfaces profile meta, the Profile and Settings
 * pages (placeholders for now), and the sign-out server action. The
 * trigger renders the first letter of the user's name, or their avatar
 * image when one is set.
 */
export function UserMenu({ user, profile }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (!open) return;
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const displayName = profile?.full_name || user.email || "User";
  const initial = (displayName[0] ?? "U").toUpperCase();
  const email = user.email ?? "";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-indigo-600/10 text-sm font-bold text-indigo-600 transition-colors hover:bg-indigo-600/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
        aria-label="User menu"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {profile?.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.avatar_url}
            alt={displayName}
            className="h-full w-full object-cover"
          />
        ) : (
          <span aria-hidden="true">{initial}</span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg"
        >
          <div className="border-b border-slate-200 px-4 py-3">
            <p className="truncate text-sm font-medium text-slate-800">
              {displayName}
            </p>
            <p className="truncate text-xs text-slate-500">{email}</p>
          </div>
          <div className="py-1">
            <a
              href="/settings"
              role="menuitem"
              className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-50"
            >
              <User size={16} aria-hidden="true" />
              Profile
            </a>
            <a
              href="/settings"
              role="menuitem"
              className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-50"
            >
              <Gear size={16} aria-hidden="true" />
              Settings
            </a>
            <form action={signOut}>
              <button
                type="submit"
                role="menuitem"
                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-600 transition-colors hover:bg-red-50"
              >
                <SignOut size={16} aria-hidden="true" />
                Sign out
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
