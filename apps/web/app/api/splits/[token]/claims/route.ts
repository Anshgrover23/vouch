import { and, eq } from "drizzle-orm";
import { documents, fields, groupMembers, splitClaims } from "@proofsheet/db";
import { bindSeatError, ensureClaimMember } from "@/lib/account";
import { logActivity } from "@/lib/activity";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  namesOnReceipt,
  otherPeopleOnReceipt,
  parseDisplayName,
  resolveSplitWith,
  type ClaimStance,
} from "@/lib/split";

type Writer = {
  insert: ReturnType<typeof db>["insert"];
  delete: ReturnType<typeof db>["delete"];
};

async function upsertClaim(
  tx: Writer,
  input: {
    documentId: string;
    fieldId: string;
    workspaceId: string;
    memberId: string | null;
    displayName: string;
    stance: string;
  },
) {
  await tx
    .insert(splitClaims)
    .values({
      documentId: input.documentId,
      fieldId: input.fieldId,
      workspaceId: input.workspaceId,
      memberId: input.memberId,
      displayName: input.displayName,
      stance: input.stance,
    })
    .onConflictDoUpdate({
      target: [splitClaims.documentId, splitClaims.fieldId, splitClaims.displayName],
      set: { stance: input.stance, memberId: input.memberId, updatedAt: new Date() },
    });
}

async function clearOwes(tx: Writer, documentId: string, fieldId: string) {
  await tx
    .delete(splitClaims)
    .where(
      and(eq(splitClaims.documentId, documentId), eq(splitClaims.fieldId, fieldId), eq(splitClaims.stance, "owe")),
    );
}

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const session = await requireSession();
    const { token } = await params;
    const body = (await req.json()) as { fieldId?: string; stance?: string; with?: unknown; as?: string };
    const stance: ClaimStance | null =
      body.stance === "owe" || body.stance === "not_mine" || body.stance === "split" ? body.stance : null;
    if (!body.fieldId || !stance) {
      return Response.json({ error: "Need a line, and I owe / split / not mine." }, { status: 400 });
    }

    const [doc] = await db().select().from(documents).where(eq(documents.shareToken, token)).limit(1);
    if (!doc) return Response.json({ error: "not found" }, { status: 404 });

    const fieldPromise = db()
      .select()
      .from(fields)
      .where(and(eq(fields.id, body.fieldId), eq(fields.documentId, doc.id)))
      .limit(1);
    const membersPromise = doc.groupId
      ? db().select().from(groupMembers).where(eq(groupMembers.groupId, doc.groupId))
      : Promise.resolve([]);
    const existingPromise = db()
      .select({
        displayName: splitClaims.displayName,
        fieldId: splitClaims.fieldId,
        stance: splitClaims.stance,
        memberId: splitClaims.memberId,
      })
      .from(splitClaims)
      .where(eq(splitClaims.documentId, doc.id));

    const [fieldRows, members, existing] = await Promise.all([fieldPromise, membersPromise, existingPromise]);
    const [field] = fieldRows;
    if (!field) return Response.json({ error: "not found" }, { status: 404 });

    const bound = await ensureClaimMember(
      db(),
      doc,
      { userId: session.userId, displayName: session.displayName },
      body.as,
    );
    if (!bound.ok) {
      return Response.json(
        { error: bindSeatError(bound.code, "name" in bound ? bound.name : undefined), code: bound.code },
        { status: bound.code === "not_found" ? 404 : 409 },
      );
    }

    const actor = bound.member;
    const displayName = parseDisplayName(actor.displayName);
    if (!displayName) {
      return Response.json({ error: "Need a name on this seat." }, { status: 400 });
    }

    const memberByName = new Map(members.map((row) => [row.displayName, row]));
    memberByName.set(displayName, actor);

    if (stance === "split") {
      const others = otherPeopleOnReceipt(
        displayName,
        namesOnReceipt({
          displayName,
          paidByName: doc.paidByName,
          people: members.map((row) => row.displayName),
          claims: existing,
        }),
      );
      const requested = Array.isArray(body.with) ? body.with.map((row) => String(row)) : null;
      const resolved = resolveSplitWith(displayName, others, requested);
      if (!("names" in resolved)) {
        if (resolved.code === "needs_friend") {
          return Response.json({ error: "Add a friend first.", code: resolved.code, others }, { status: 409 });
        }
        if (resolved.code === "needs_picker") {
          return Response.json(
            { error: "Choose who shares this line.", code: resolved.code, others },
            { status: 409 },
          );
        }
        return Response.json(
          { error: "That person is not on this receipt.", code: resolved.code, name: resolved.name },
          { status: 400 },
        );
      }

      const names = [displayName, ...resolved.names];
      await db().transaction(async (tx) => {
        await clearOwes(tx, doc.id, field.id);
        for (const name of names) {
          const member = memberByName.get(name);
          await upsertClaim(tx, {
            documentId: doc.id,
            fieldId: field.id,
            workspaceId: doc.workspaceId,
            memberId: member?.id ?? null,
            displayName: name,
            stance: "owe",
          });
        }
      });
    } else {
      await db().transaction(async (tx) => {
        if (stance === "owe") await clearOwes(tx, doc.id, field.id);
        await upsertClaim(tx, {
          documentId: doc.id,
          fieldId: field.id,
          workspaceId: doc.workspaceId,
          memberId: actor.id,
          displayName,
          stance,
        });
      });
    }

    const all = await db().select().from(splitClaims).where(eq(splitClaims.documentId, doc.id));
    await logActivity(db(), {
      workspaceId: doc.workspaceId,
      groupId: doc.groupId,
      documentId: doc.id,
      actorName: displayName,
      action: "claimed",
      detail: { fieldId: field.id, stance, item: field.label, with: Array.isArray(body.with) ? body.with : undefined },
    });
    return Response.json({ claims: all });
  } catch (error) {
    const message = error instanceof Error ? error.message : "failed";
    if (message === "unauthorized") return Response.json({ error: "unauthorized" }, { status: 401 });
    console.error("[split claims]", error);
    return Response.json({ error: "failed" }, { status: 500 });
  }
}
