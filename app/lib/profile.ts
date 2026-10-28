import type { Role } from "./types";

export const profileAssets = {
  connection: "/profile/profile-partner-connection.webp",
  location: "/profile/profile-location-sharing.webp",
  privacy: "/profile/profile-privacy.webp",
  account: "/profile/profile-account.webp",
} as const;
export const profileAvatars = Array.from({ length: 8 }, (_, index) => `/setup/avatar-${index + 1}.webp`);
export type ProfilePatch = { name?: string; role?: Role; avatar?: string };
export type ProfileAccount = { authenticated: boolean; name?: string; email?: string; signOutUrl?: string };
// This must come from the authenticated pair provider, never local seeded data.
export type ProfilePartner = {
  id: string; name?: string; avatar: string | null; locationVisible?: boolean;
  unpair: () => Promise<void>;
};
export function roleLabel(role: Role) { return role === "driver" ? "Rider" : "Pillion"; }
export function locationPermissionLabel(permission: string) {
  return permission === "granted" ? "Allowed" : permission === "denied" ? "Not allowed" : permission === "unavailable" ? "Unavailable" : "Not enabled";
}
export function notificationPermissionLabel(permission: string) {
  return permission === "granted" ? "Allowed" : permission === "denied" ? "Not allowed" : permission === "unsupported" ? "Unavailable here" : "Not enabled";
}
export function validProfilePatch(patch: ProfilePatch) {
  return (patch.name === undefined || (typeof patch.name === "string" && patch.name.trim().length <= 40))
    && (patch.role === undefined || patch.role === "driver" || patch.role === "rider")
    && (patch.avatar === undefined || profileAvatars.includes(patch.avatar));
}

// Reuse the exact existing keys, preserving setup completion and other fields.
// A failed durable save must propagate to the editor instead of claiming success.
export function persistProfilePatch(storage: Pick<Storage, "getItem" | "setItem">, patch: ProfilePatch, current: { role: Role; avatar: string | null }, demoMode = false) {
  if (!validProfilePatch(patch)) throw new Error("Invalid profile choice");
  const nameKey = demoMode ? "along.profile.demo.name" : "along.profile.name";
  const setupKey = demoMode ? "along.setup.demo.v1" : "along.setup.v1";
  if (patch.name !== undefined) storage.setItem(nameKey, patch.name.trim());
  if (patch.avatar !== undefined || patch.role !== undefined) {
    let saved: Record<string, unknown> = {};
    try { const parsed = JSON.parse(storage.getItem(setupKey) || "{}"); if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) saved = parsed; } catch { /* Recover corrupt setup data without restarting onboarding. */ }
    storage.setItem(setupKey, JSON.stringify({ ...saved, role: patch.role ?? current.role, avatar: patch.avatar ?? current.avatar }));
  }
}
export function readDemoProfileAvatar(storage: Pick<Storage, "getItem">): string | null {
  try {
    const value = JSON.parse(storage.getItem("along.setup.demo.v1") || "null");
    return typeof value?.avatar === "string" && profileAvatars.includes(value.avatar) ? value.avatar : null;
  } catch { return null; }
}
