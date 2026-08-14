import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { documents, users } from "@proofsheet/db";
import { attachSession, requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { renamePersonOnSplit } from "@/lib/identity-server";
import { parseDisplayName } from "@/lib/split";

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const session = await requireSession();
    const { token } = await params;
    const body = (await req.json()) as { from?: string; to?: string };
    const next = parseDisplayName(body.to);
    if (!next) return NextResponse.json({ error: "Use a name between 1 and 48 characters." }, { status: 400 });

    const [doc] = await db().select().from(documents).where(eq(documents.shareToken, token)).limit(1);
    if (!doc) return NextResponse.json({ error: "not found" }, { status: 404 });

    const from = parseDisplayName(body.from) ?? parseDisplayName(session.displayName);
    const result = await renamePersonOnSplit(db(), doc.id, from, next);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

    if (next !== session.displayName) {
      await db().update(users).set({ displayName: next, updatedAt: new Date() }).where(eq(users.id, session.userId));
    }

    const updated = { ...session, displayName: next };
    const res = NextResponse.json({ ok: true, name: next });
    return attachSession(res, updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : "failed";
    if (message === "unauthorized") return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    console.error("[split identity]", error);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
