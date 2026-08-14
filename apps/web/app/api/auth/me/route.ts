import { NextResponse } from "next/server";
import { getSession, publicSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ session: null }, { status: 401 });
  return NextResponse.json({ session: publicSession(session) });
}
