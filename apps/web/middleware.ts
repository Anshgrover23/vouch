import { NextResponse, type NextRequest } from "next/server";
import { authRedirect } from "@/lib/auth-guard";
import { COOKIE, decodeSession } from "@/lib/session-cookie";

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const session = await decodeSession(req.cookies.get(COOKIE)?.value);
  const dest = authRedirect(pathname, search, session);
  if (!dest) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = dest.pathname;
  url.search = dest.search;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|samples/|partners/|uploads/|s/|.*\\..*).*)"],
};
