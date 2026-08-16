import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteChrome } from "@/components/SiteChrome";
import { bindInviteSeat, memberByInvite } from "@/lib/account";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { afterAuthPath, safeNextPath } from "@/lib/paths";
import styles from "../auth.module.css";
import { LoginForm } from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; invite?: string }>;
}) {
  const { next, invite: rawInvite } = await searchParams;
  const dest = safeNextPath(next, "/inbox");
  const invite = rawInvite?.trim() || null;
  const seat = invite ? await memberByInvite(db(), invite) : null;
  const session = await getSession();
  if (session) {
    if (invite) await bindInviteSeat(db(), invite, { userId: session.userId, displayName: session.displayName });
    redirect(afterAuthPath(session.onboarded, dest));
  }

  const signupHref = invite
    ? `/signup?invite=${encodeURIComponent(invite)}&next=${encodeURIComponent(dest)}`
    : `/signup?next=${encodeURIComponent(dest)}`;

  return (
    <>
      <SiteChrome />
      <main className={styles.page}>
        <p className="mono">welcome back</p>
        <h1>{seat ? `Log in as ${seat.displayName}.` : "Log in to vouch."}</h1>
        <p className={styles.lede}>
          {seat
            ? `This takes ${seat.displayName}'s seat on the bill — not a new person.`
            : "Your name on the receipt. Your lines. Nobody argues about oat milk."}
        </p>
        <LoginForm next={dest} invite={invite} />
        <p className={styles.switch}>
          No account yet? <Link href={signupHref}>Sign up</Link>
        </p>
      </main>
    </>
  );
}
