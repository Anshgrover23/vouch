import { and, desc, eq, sql } from "drizzle-orm";
import {
  DEFAULT_TEMPLATES,
  documents,
  groupMembers,
  groups,
  memberships,
  templates,
  users,
  workspaces,
  type Database,
} from "@proofsheet/db";
import { parseGroupName } from "@/lib/paths";

type QueryDb = Pick<Database, "insert" | "select" | "update">;

export function isUniqueViolation(error: unknown) {
  if (typeof error !== "object" || error === null) return false;
  if ("code" in error && error.code === "23505") return true;
  if ("cause" in error && typeof error.cause === "object" && error.cause && "code" in error.cause) {
    return (error.cause as { code: unknown }).code === "23505";
  }
  return false;
}

export async function provisionAccount(
  database: QueryDb,
  input: { email: string; displayName: string; passwordHash: string },
) {
  const [user] = await database
    .insert(users)
    .values({
      email: input.email,
      displayName: input.displayName,
      passwordHash: input.passwordHash,
    })
    .returning();

  const [workspace] = await database
    .insert(workspaces)
    .values({
      name: `${input.displayName}'s workspace`,
      ownerId: user.id,
    })
    .returning();

  await database.insert(memberships).values({
    workspaceId: workspace.id,
    userId: user.id,
    role: "owner",
  });

  await database.insert(templates).values(
    DEFAULT_TEMPLATES.map((t) => ({
      workspaceId: workspace.id,
      slug: t.slug,
      name: t.name,
      modality: t.modality,
      jsonSchema: t.schema,
    })),
  );

  return { user, workspace };
}

export async function acceptGroupInvite(
  database: QueryDb,
  inviteToken: string | undefined,
  account: { userId: string; displayName: string },
) {
  const token = String(inviteToken ?? "").trim();
  if (!token) return null;

  const [member] = await database
    .select()
    .from(groupMembers)
    .where(eq(groupMembers.inviteToken, token))
    .limit(1);
  if (!member) return null;

  const [group] = await database.select().from(groups).where(eq(groups.id, member.groupId)).limit(1);
  if (!group) return null;

  await database
    .insert(memberships)
    .values({
      workspaceId: group.workspaceId,
      userId: account.userId,
      role: "member",
    })
    .onConflictDoNothing({ target: [memberships.workspaceId, memberships.userId] });

  await database
    .update(groupMembers)
    .set({
      userId: account.userId,
      displayName: account.displayName,
      status: "joined",
      updatedAt: new Date(),
    })
    .where(eq(groupMembers.id, member.id));

  return group;
}

export async function loadWorkspaceMembership(database: QueryDb, userId: string) {
  const [row] = await database
    .select({
      workspaceId: memberships.workspaceId,
      role: memberships.role,
    })
    .from(memberships)
    .where(eq(memberships.userId, userId))
    .limit(1);
  return row ?? null;
}

async function groupByWorkspaceName(database: QueryDb, workspaceId: string, name: string) {
  const [row] = await database
    .select()
    .from(groups)
    .where(and(eq(groups.workspaceId, workspaceId), sql`lower(btrim(${groups.name})) = ${name.toLowerCase()}`))
    .limit(1);
  return row ?? null;
}

export async function createGroupWithOwner(
  database: QueryDb,
  input: { workspaceId: string; userId: string; displayName: string; name: string },
) {
  const name = parseGroupName(input.name);
  if (!name) return null;
  try {
    const [group] = await database
      .insert(groups)
      .values({
        workspaceId: input.workspaceId,
        name,
        createdBy: input.userId,
      })
      .returning();
    await database.insert(groupMembers).values({
      groupId: group.id,
      userId: input.userId,
      displayName: input.displayName,
      status: "joined",
    });
    return group;
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    return groupByWorkspaceName(database, input.workspaceId, name);
  }
}

export async function groupInWorkspace(database: QueryDb, groupId: string, workspaceId: string) {
  const [group] = await database
    .select()
    .from(groups)
    .where(and(eq(groups.id, groupId), eq(groups.workspaceId, workspaceId)))
    .limit(1);
  return group ?? null;
}

export async function latestGroupInWorkspace(database: QueryDb, workspaceId: string) {
  const [group] = await database
    .select()
    .from(groups)
    .where(eq(groups.workspaceId, workspaceId))
    .orderBy(desc(groups.createdAt))
    .limit(1);
  return group ?? null;
}

export async function ensureDocumentGroup(
  database: QueryDb,
  doc: { id: string; workspaceId: string; groupId: string | null; title: string },
  owner: { userId: string; displayName: string },
) {
  if (doc.groupId) {
    const existing = await groupInWorkspace(database, doc.groupId, doc.workspaceId);
    if (existing) return existing;
  }
  const group = await createGroupWithOwner(database, {
    workspaceId: doc.workspaceId,
    userId: owner.userId,
    displayName: owner.displayName,
    name: parseGroupName(doc.title) || "This receipt",
  });
  if (!group) return null;
  await database.update(documents).set({ groupId: group.id, updatedAt: new Date() }).where(eq(documents.id, doc.id));
  return group;
}
