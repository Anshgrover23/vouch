import { parseDisplayName } from "@/lib/split";

export const NAME_KEY = "vouch-display-name";

export function renameBlockedBy(from: string | null, to: string, takenNames: string[]) {
  const previous = parseDisplayName(from);
  const next = parseDisplayName(to);
  if (!next) return "Use a name between 1 and 48 characters.";
  if (!previous || previous === next) return null;
  if (takenNames.some((name) => name === next)) return "That name is already on this split.";
  return null;
}

export async function commitSplitName(token: string, from: string | null, to: string) {
  const res = await fetch(`/api/splits/${token}/identity`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ from, to }),
  });
  const json = (await res.json().catch(() => ({}))) as { error?: string; name?: string };
  if (!res.ok) return { ok: false as const, error: json.error || "Could not save that name." };
  return { ok: true as const, name: json.name || to };
}
