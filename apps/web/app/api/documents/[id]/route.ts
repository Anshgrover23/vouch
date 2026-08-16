import { eq } from "drizzle-orm";
import { documentPages, documents, fields, groupMembers, splitClaims } from "@proofsheet/db";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { displayImageUrl } from "@/lib/image-response";
import { syncRemainderField, visibleFields } from "@/lib/remainder";
import { parseDisplayName } from "@/lib/split";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const [doc] = await db()
      .select()
      .from(documents)
      .where(eq(documents.id, id))
      .limit(1);
    if (!doc || doc.workspaceId !== session.workspaceId) {
      return Response.json({ error: "not found" }, { status: 404 });
    }
    const pagesPromise = db().select().from(documentPages).where(eq(documentPages.documentId, id));
    await syncRemainderField(db(), id, doc.workspaceId);
    const peoplePromise = doc.groupId
      ? db()
          .select({
            id: groupMembers.id,
            displayName: groupMembers.displayName,
            status: groupMembers.status,
            inviteToken: groupMembers.inviteToken,
            userId: groupMembers.userId,
          })
          .from(groupMembers)
          .where(eq(groupMembers.groupId, doc.groupId))
      : Promise.resolve(
          [] as Array<{
            id: string;
            displayName: string;
            status: string;
            inviteToken: string;
            userId: string | null;
          }>,
        );
    const waitingPromise = peoplePromise.then((rows) => rows.filter((row) => row.status === "invited"));
    const [pages, fieldRows, claims, waiting, people] = await Promise.all([
      pagesPromise,
      db().select().from(fields).where(eq(fields.documentId, id)),
      db().select().from(splitClaims).where(eq(splitClaims.documentId, id)),
      waitingPromise,
      peoplePromise,
    ]);
    const you = people.find((row) => row.userId === session.userId) ?? null;
    return Response.json({
      document: {
        id: doc.id,
        title: doc.title,
        status: doc.status,
        error: doc.error,
        shareToken: doc.shareToken,
        groupId: doc.groupId,
        paidByName: doc.paidByName,
        providerMode: doc.providerMode,
      },
      pages: pages.map((p) => ({
        imageUrl: displayImageUrl(doc.sourceUrl || doc.storagePath, `/api/documents/${id}/image`),
        width: p.width,
        height: p.height,
      })),
      fields: visibleFields(fieldRows),
      claims,
      waiting,
      people: people.map((row) => row.displayName),
      you: you ? { memberId: you.id, displayName: you.displayName } : null,
      seats: people.map((row) => ({
        memberId: row.id,
        displayName: row.displayName,
        status: row.status,
        inviteToken: row.inviteToken,
        you: row.userId === session.userId,
      })),
    });
  } catch {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const [doc] = await db().select().from(documents).where(eq(documents.id, id)).limit(1);
    if (!doc || doc.workspaceId !== session.workspaceId) {
      return Response.json({ error: "not found" }, { status: 404 });
    }
    const body = (await req.json().catch(() => ({}))) as { paidByName?: string };
    const paidByName = parseDisplayName(body.paidByName);
    if (!paidByName) return Response.json({ error: "Need a name for who paid." }, { status: 400 });
    await db()
      .update(documents)
      .set({ paidByName, updatedAt: new Date() })
      .where(eq(documents.id, doc.id));
    return Response.json({ paidByName });
  } catch {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
}
