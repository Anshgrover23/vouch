import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteChrome } from "@/components/SiteChrome";
import { bindInviteSeat, memberByInvite } from "@/lib/account";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { afterAuthPath, safeNextPath } from "@/lib/paths";
import styles from "../auth.module.css";
import { SignupForm } from "./SignupForm";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; invite?: string }>;
}) {
  const { next, invite: rawInvite } = await searchParams;
  const dest = safeNextPath(next, "/onboarding");
  const invite = rawInvite?.trim() || null;
  const seat = invite ? await memberByInvite(db(), invite) : null;
  const session = await getSession();
  if (session) {
    if (invite) await bindInviteSeat(db(), invite, { userId: session.userId, displayName: session.displayName });
    redirect(afterAuthPath(session.onboarded, dest));
  }

  const loginHref = invite
    ? `/login?invite=${encodeURIComponent(invite)}&next=${encodeURIComponent(dest)}`
    : `/login?next=${encodeURIComponent(dest)}`;

  return (
    <>
      <SiteChrome />
      <main className={styles.page}>
        <p className="mono">new here</p>
        <h1>{seat ? `Join as ${seat.displayName}.` : "Sign up to vouch."}</h1>
        <p className={styles.lede}>
          {seat
            ? "This seat is already on the receipt. Create an account to tap those lines — no new name."
            : "Friends tap the lines they owe. Your name is what they see on the receipt."}
        </p>
        {invite && !seat ? (
          <p className={styles.err} data-testid="auth-error">
            That invite link is not available.
          </p>
        ) : (
          <SignupForm next={dest} invite={invite} seatName={seat?.displayName ?? null} />
        )}
        <p className={styles.switch}>
          Already have an account? <Link href={loginHref}>Log in</Link>
        </p>
      </main>
    </>
  );
}
