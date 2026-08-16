import { and, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import {
  DEFAULT_TEMPLATES,
  documents,
  groupMembers,
  groups,
  memberships,
  splitClaims,
  templates,
  users,
  workspaces,
  type Database,
} from "@proofsheet/db";
import { parseGroupName } from "@/lib/paths";
import { parseDisplayName } from "@/lib/split";

type QueryDb = Pick<Database, "insert" | "select" | "update">;

export type GroupMemberRow = typeof groupMembers.$inferSelect;

export type BindSeatResult =
  | { ok: true; group: typeof groups.$inferSelect; member: GroupMemberRow }
  | { ok: false; code: "not_found" | "taken" | "already_on_bill"; name?: string };

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

export async function bindInviteSeat(
  database: QueryDb,
  inviteToken: string | undefined,
  account: { userId: string; displayName: string },
): Promise<BindSeatResult> {
  const token = String(inviteToken ?? "").trim();
  if (!token) return { ok: false, code: "not_found" };

  const [member] = await database
    .select()
    .from(groupMembers)
    .where(eq(groupMembers.inviteToken, token))
    .limit(1);
  if (!member) return { ok: false, code: "not_found" };

  const [group] = await database.select().from(groups).where(eq(groups.id, member.groupId)).limit(1);
  if (!group) return { ok: false, code: "not_found" };

  if (member.userId && member.userId !== account.userId) {
    return { ok: false, code: "taken", name: member.displayName };
  }

  const [existing] = await database
    .select()
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, member.groupId), eq(groupMembers.userId, account.userId)))
    .limit(1);
  if (existing && existing.id !== member.id) {
    return { ok: false, code: "already_on_bill", name: existing.displayName };
  }

  await database
    .insert(memberships)
    .values({
      workspaceId: group.workspaceId,
      userId: account.userId,
      role: "member",
    })
    .onConflictDoNothing({ target: [memberships.workspaceId, memberships.userId] });

  if (member.userId === account.userId && member.status === "joined") {
    return { ok: true, group, member };
  }

  const [updated] = await database
    .update(groupMembers)
    .set({
      userId: account.userId,
      status: "joined",
      updatedAt: new Date(),
    })
    .where(eq(groupMembers.id, member.id))
    .returning();

  return { ok: true, group, member: updated ?? { ...member, userId: account.userId, status: "joined" } };
}

export function bindSeatError(code: string, name?: string) {
  if (code === "taken") return `That seat is already ${name ?? "taken"}.`;
  if (code === "already_on_bill") return `You're already on this bill as ${name ?? "someone else"}.`;
  return "That invite link is not available.";
}

export async function renameAccountDisplayName(
  database: QueryDb,
  account: { userId: string; workspaceId: string; oldName: string },
  displayName: string,
) {
  await database
    .update(users)
    .set({ displayName, updatedAt: new Date() })
    .where(eq(users.id, account.userId));

  const seats = await database
    .select({ id: groupMembers.id, groupId: groupMembers.groupId })
    .from(groupMembers)
    .where(eq(groupMembers.userId, account.userId));

  if (seats.length > 0) {
    await database
      .update(groupMembers)
      .set({ displayName, updatedAt: new Date() })
      .where(eq(groupMembers.userId, account.userId));
    await database
      .update(splitClaims)
      .set({ displayName, updatedAt: new Date() })
      .where(inArray(splitClaims.memberId, seats.map((seat) => seat.id)));
  }

  const groupIds = seats.map((seat) => seat.groupId);
  const paidScope =
    groupIds.length > 0
      ? or(eq(documents.workspaceId, account.workspaceId), inArray(documents.groupId, groupIds))
      : eq(documents.workspaceId, account.workspaceId);

  await database
    .update(documents)
    .set({ paidByName: displayName, updatedAt: new Date() })
    .where(and(eq(documents.paidByName, account.oldName), paidScope));
}

export async function acceptGroupInvite(
  database: QueryDb,
  inviteToken: string | undefined,
  account: { userId: string; displayName: string },
) {
  if (!String(inviteToken ?? "").trim()) return null;
  return bindInviteSeat(database, inviteToken, account);
}

export async function memberByInvite(database: QueryDb, inviteToken: string | undefined) {
  const token = String(inviteToken ?? "").trim();
  if (!token) return null;
  const [member] = await database
    .select()
    .from(groupMembers)
    .where(eq(groupMembers.inviteToken, token))
    .limit(1);
  return member ?? null;
}

export async function ensureClaimMember(
  database: QueryDb,
  doc: { id: string; workspaceId: string; groupId: string | null; title: string },
  account: { userId: string; displayName: string },
  inviteToken?: string | null,
) {
  const invite = String(inviteToken ?? "").trim();
  if (invite) {
    const bound = await bindInviteSeat(database, invite, account);
    if (!bound.ok) return bound;
    if (bound.member.groupId !== doc.groupId && doc.groupId) {
      return { ok: false as const, code: "not_found" as const };
    }
    return { ok: true as const, member: bound.member };
  }

  const group = await ensureDocumentGroup(database, doc, account);
  if (!group) return { ok: false as const, code: "not_found" as const };

  const [mine] = await database
    .select()
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, group.id), eq(groupMembers.userId, account.userId)))
    .limit(1);
  if (mine) return { ok: true as const, member: mine };

  const name = parseDisplayName(account.displayName);
  if (!name) return { ok: false as const, code: "not_found" as const };

  const [named] = await database
    .select()
    .from(groupMembers)
    .where(
      and(eq(groupMembers.groupId, group.id), eq(groupMembers.displayName, name), isNull(groupMembers.userId)),
    )
    .limit(1);
  if (named) {
    const [updated] = await database
      .update(groupMembers)
      .set({ userId: account.userId, status: "joined", updatedAt: new Date() })
      .where(eq(groupMembers.id, named.id))
      .returning();
    return { ok: true as const, member: updated ?? { ...named, userId: account.userId, status: "joined" } };
  }

  const [created] = await database
    .insert(groupMembers)
    .values({
      groupId: group.id,
      userId: account.userId,
      displayName: name,
      status: "joined",
    })
    .returning();
  return { ok: true as const, member: created };
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
