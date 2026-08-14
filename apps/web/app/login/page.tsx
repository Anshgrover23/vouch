import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteChrome } from "@/components/SiteChrome";
import { getSession } from "@/lib/auth";
import { afterAuthPath, safeNextPath } from "@/lib/paths";
import styles from "../auth.module.css";
import { LoginForm } from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const dest = safeNextPath(next, "/inbox");
  const session = await getSession();
  if (session) redirect(afterAuthPath(session.onboarded, dest));
  return (
    <>
      <SiteChrome />
      <main className={styles.page}>
        <p className="mono">welcome back</p>
        <h1>Log in to vouch.</h1>
        <p className={styles.lede}>Your name on the receipt. Your lines. Nobody argues about oat milk.</p>
        <LoginForm next={dest} />
        <p className={styles.switch}>
          No account yet? <Link href={`/signup?next=${encodeURIComponent(dest)}`}>Sign up</Link>
        </p>
      </main>
    </>
  );
}
