import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteChrome } from "@/components/SiteChrome";
import { getSession } from "@/lib/auth";
import { afterAuthPath, safeNextPath } from "@/lib/paths";
import styles from "../auth.module.css";
import { SignupForm } from "./SignupForm";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; invite?: string }>;
}) {
  const { next, invite } = await searchParams;
  const dest = safeNextPath(next, "/onboarding");
  const session = await getSession();
  if (session) redirect(afterAuthPath(session.onboarded, dest));
  return (
    <>
      <SiteChrome />
      <main className={styles.page}>
        <p className="mono">new here</p>
        <h1>Sign up to vouch.</h1>
        <p className={styles.lede}>Housemates tap the lines they owe. Your name is what they see on the receipt.</p>
        <SignupForm next={dest} invite={invite?.trim() || null} />
        <p className={styles.switch}>
          Already have an account? <Link href={`/login?next=${encodeURIComponent(dest)}`}>Log in</Link>
        </p>
      </main>
    </>
  );
}
