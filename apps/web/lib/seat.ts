export function seatSharePath(shareToken: string, inviteToken?: string | null) {
  const share = String(shareToken ?? "").trim();
  const invite = String(inviteToken ?? "").trim();
  if (!share) return "";
  if (!invite) return `/s/${share}`;
  return `/s/${share}?as=${encodeURIComponent(invite)}`;
}

export function withSeatQuery(shareUrl: string, inviteToken?: string | null) {
  const url = String(shareUrl ?? "").trim();
  const invite = String(inviteToken ?? "").trim();
  if (!url || !invite) return url;
  const joiner = url.includes("?") ? "&" : "?";
  return `${url}${joiner}as=${encodeURIComponent(invite)}`;
}

export function seatInviteMessage(shareUrl: string, displayName?: string | null) {
  const name = String(displayName ?? "").trim();
  if (!name) return `You're on this split: ${shareUrl}`;
  return `You're on this split as ${name}: ${shareUrl}`;
}

export function seatSignupPath(shareToken: string, inviteToken: string) {
  const next = seatSharePath(shareToken, inviteToken);
  return `/signup?invite=${encodeURIComponent(inviteToken)}&next=${encodeURIComponent(next)}`;
}

export function seatLoginPath(shareToken: string, inviteToken: string) {
  const next = seatSharePath(shareToken, inviteToken);
  return `/login?invite=${encodeURIComponent(inviteToken)}&next=${encodeURIComponent(next)}`;
}
