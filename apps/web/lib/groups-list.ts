import { eq } from "drizzle-orm";
import { groupMembers, groupStars, groups, type Database } from "@proofsheet/db";

export type WorkspaceGroupRow = {
  id: string;
  name: string;
  information: string;
  starred: boolean;
  createdAt: Date;
  members: {
    id: string;
    displayName: string;
    status: string;
    userId: string | null;
    inviteToken: string;
  }[];
};

export async function listWorkspaceGroups(
  database: Database,
  session: { workspaceId: string; userId: string },
): Promise<WorkspaceGroupRow[]> {
  const [rows, memberRows, starRows] = await Promise.all([
    database.select().from(groups).where(eq(groups.workspaceId, session.workspaceId)),
    database
      .select({
        id: groupMembers.id,
        groupId: groupMembers.groupId,
        userId: groupMembers.userId,
        displayName: groupMembers.displayName,
        inviteToken: groupMembers.inviteToken,
        status: groupMembers.status,
      })
      .from(groupMembers)
      .innerJoin(groups, eq(groupMembers.groupId, groups.id))
      .where(eq(groups.workspaceId, session.workspaceId)),
    database
      .select({ groupId: groupStars.groupId })
      .from(groupStars)
      .where(eq(groupStars.userId, session.userId)),
  ]);
  const membersByGroup = new Map<string, typeof memberRows>();
  for (const member of memberRows) {
    const list = membersByGroup.get(member.groupId) ?? [];
    list.push(member);
    membersByGroup.set(member.groupId, list);
  }
  const starred = new Set(starRows.map((row) => row.groupId));

  return rows
    .map((group) => ({
      id: group.id,
      name: group.name,
      information: group.information ?? "",
      starred: starred.has(group.id),
      createdAt: group.createdAt,
      members: (membersByGroup.get(group.id) ?? []).map((member) => ({
        id: member.id,
        displayName: member.displayName,
        status: member.status,
        userId: member.userId,
        inviteToken: member.inviteToken,
      })),
    }))
    .sort((a, b) => Number(b.starred) - Number(a.starred) || a.name.localeCompare(b.name));
}
