import { afterAuthPath } from "./paths";

const LOGIN = "/login";
const ONBOARDING = "/onboarding";

export function isAuthPage(pathname: string) {
  return pathname === LOGIN || pathname === "/signup";
}

export function isOnboarding(pathname: string) {
  return pathname === ONBOARDING || pathname.startsWith(`${ONBOARDING}/`);
}

export function needsLogin(pathname: string) {
  return (
    pathname === "/new" ||
    pathname.startsWith("/new/") ||
    pathname === "/inbox" ||
    pathname.startsWith("/inbox/") ||
    pathname === "/groups" ||
    pathname.startsWith("/groups/") ||
    pathname === "/account" ||
    pathname.startsWith("/account/") ||
    pathname.startsWith("/review/") ||
    isOnboarding(pathname)
  );
}

function nextParam(search: string) {
  const q = search.startsWith("?") ? search.slice(1) : search;
  return new URLSearchParams(q).get("next");
}

/** Where middleware should send this request, or null to continue. */
export function authRedirect(
  pathname: string,
  search: string,
  session: { onboarded: boolean } | null,
): { pathname: string; search: string } | null {
  if (!session) {
    if (!needsLogin(pathname)) return null;
    return { pathname: LOGIN, search: `?next=${encodeURIComponent(`${pathname}${search}`)}` };
  }

  if (!session.onboarded) {
    if (isOnboarding(pathname)) return null;
    return { pathname: ONBOARDING, search: "" };
  }

  if (isAuthPage(pathname)) {
    return { pathname: afterAuthPath(true, nextParam(search)), search: "" };
  }

  if (isOnboarding(pathname)) {
    return { pathname: "/inbox", search: "" };
  }

  return null;
}
