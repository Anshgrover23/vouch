export function activityCopy(row: {
  actorName: string;
  action: string;
  detail?: Record<string, unknown> | null;
}) {
  const detail = row.detail ?? {};
  if (row.action === "receipt") return `${row.actorName} added a receipt`;
  if (row.action === "claimed") {
    const item = String(detail.item ?? "").trim();
    return item ? `${row.actorName} vouched ${item}` : `${row.actorName} vouched an item`;
  }
  if (row.action === "settled") {
    return `${row.actorName} marked ${String(detail.from ?? "")} → ${String(detail.to ?? "")} settled`;
  }
  if (row.action === "invited") return `${row.actorName} added ${String(detail.name ?? "someone")}`;
  if (row.action === "group_updated") return `${row.actorName} updated the group`;
  return `${row.actorName} ${row.action}`;
}
