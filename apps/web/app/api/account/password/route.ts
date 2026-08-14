import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { users } from "@proofsheet/db";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { parsePassword } from "@/lib/paths";
import { hashPassword, verifyPassword } from "@/lib/password";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const session = await requireSession();
    const body = (await req.json().catch(() => ({}))) as { current?: string; next?: string };
    const current = parsePassword(body.current);
    const next = parsePassword(body.next);
    if (!current || !next) {
      return NextResponse.json({ error: "Need the current password and a new one of at least 8 characters." }, { status: 400 });
    }
    const [user] = await db().select().from(users).where(eq(users.id, session.userId)).limit(1);
    if (!user?.passwordHash || !(await verifyPassword(current, user.passwordHash))) {
      return NextResponse.json({ error: "Current password is incorrect." }, { status: 401 });
    }
    await db()
      .update(users)
      .set({ passwordHash: await hashPassword(next), updatedAt: new Date() })
      .where(eq(users.id, session.userId));
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "failed";
    if (message === "unauthorized") return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
