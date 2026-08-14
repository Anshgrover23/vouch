import { getSession } from "@/lib/auth";
import { SiteNav, type NavSession } from "./Chrome";

export async function SiteChrome() {
  const session = await getSession();
  const nav: NavSession = session
    ? { email: session.email, displayName: session.displayName }
    : null;
  return <SiteNav session={nav} />;
}
