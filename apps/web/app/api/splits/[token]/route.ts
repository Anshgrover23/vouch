import { eq } from "drizzle-orm";
import { documentPages, documents, fields, groupMembers, splitClaims } from "@proofsheet/db";
import { bindInviteSeat, memberByInvite } from "@/lib/account";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { displayImageUrl } from "@/lib/image-response";
import { syncRemainderField, visibleFields } from "@/lib/remainder";
import { exportLine, namesOnReceipt } from "@/lib/split";

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!token) return Response.json({ error: "not found" }, { status: 404 });

  const [doc] = await db().select().from(documents).where(eq(documents.shareToken, token)).limit(1);
  if (!doc) return Response.json({ error: "not found" }, { status: 404 });

  const as = new URL(req.url).searchParams.get("as");
  const sessionPromise = getSession();
  const pagesPromise = db().select().from(documentPages).where(eq(documentPages.documentId, doc.id));
  await syncRemainderField(db(), doc.id, doc.workspaceId);
  const membersPromise = doc.groupId
    ? db()
        .select({
          id: groupMembers.id,
          displayName: groupMembers.displayName,
          userId: groupMembers.userId,
          status: groupMembers.status,
        })
        .from(groupMembers)
        .where(eq(groupMembers.groupId, doc.groupId))
    : Promise.resolve([]);
  const [pages, fieldRows, claims, members, session] = await Promise.all([
    pagesPromise,
    db()
      .select()
      .from(fields)
      .where(eq(fields.documentId, doc.id))
      .then(visibleFields),
    db().select().from(splitClaims).where(eq(splitClaims.documentId, doc.id)),
    membersPromise,
    sessionPromise,
  ]);

  let seat: { displayName: string; memberId: string; status: string } | null = null;
  const invite = String(as ?? "").trim();
  if (invite) {
    const invited = await memberByInvite(db(), invite);
    if (invited && (!doc.groupId || invited.groupId === doc.groupId)) {
      if (session) {
        const bound = await bindInviteSeat(db(), invite, {
          userId: session.userId,
          displayName: session.displayName,
        });
        if (bound.ok) {
          seat = {
            displayName: bound.member.displayName,
            memberId: bound.member.id,
            status: bound.member.status,
          };
        }
      }
      if (!seat) {
        seat = {
          displayName: invited.displayName,
          memberId: invited.id,
          status: invited.status,
        };
      }
    }
  } else if (session && doc.groupId) {
    const mine = members.find((row) => row.userId === session.userId);
    if (mine) {
      seat = { displayName: mine.displayName, memberId: mine.id, status: mine.status };
    }
  }

  return Response.json({
    document: {
      id: doc.id,
      title: doc.title,
      status: doc.status,
      shareToken: doc.shareToken,
      paidByName: doc.paidByName,
    },
    pages: pages.map((p) => ({
      imageUrl: displayImageUrl(doc.sourceUrl || doc.storagePath, `/api/splits/${token}/image`),
      width: p.width,
      height: p.height,
    })),
    fields: fieldRows,
    claims,
    people: namesOnReceipt({
      paidByName: doc.paidByName,
      people: members.map((row) => row.displayName),
      claims,
    }),
    exportLine: exportLine(fieldRows, claims),
    seat,
  });
}
