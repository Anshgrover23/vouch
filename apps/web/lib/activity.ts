import { activityEvents, type Database } from "@proofsheet/db";

export const ACTIVITY_ACTIONS = ["receipt", "claimed", "settled", "invited", "group_updated"] as const;
export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number];

type QueryDb = Pick<Database, "insert">;

export async function logActivity(
  database: QueryDb,
  input: {
    workspaceId: string;
    groupId?: string | null;
    documentId?: string | null;
    actorName: string;
    action: ActivityAction;
    detail?: Record<string, unknown>;
  },
) {
  if (!input.groupId) return;
  await database.insert(activityEvents).values({
    workspaceId: input.workspaceId,
    groupId: input.groupId,
    documentId: input.documentId ?? null,
    actorName: input.actorName,
    action: input.action,
    detail: input.detail ?? {},
  });
}
