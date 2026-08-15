import { afterAuthPath } from "@/lib/paths";

export async function goAfterAuth(next: string) {
  const res = await fetch("/api/auth/me", { credentials: "include" });
  const json = (await res.json().catch(() => ({}))) as { session?: { onboarded?: boolean } | null };
  if (!res.ok || !json.session) return false;
  window.location.assign(afterAuthPath(Boolean(json.session.onboarded), next));
  return true;
}
