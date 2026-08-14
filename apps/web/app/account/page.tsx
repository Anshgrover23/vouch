import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { users } from "@proofsheet/db";
import { AppShell } from "@/components/AppShell";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import styles from "../auth.module.css";
import { AccountForm } from "./AccountForm";

export default async function AccountPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/account");
  const [user] = await db().select().from(users).where(eq(users.id, session.userId)).limit(1);
  if (!user) redirect("/login?next=/account");

  return (
    <AppShell>
      <div className={styles.sheet}>
        <p className="mono">signed in</p>
        <h1>Account</h1>
        <p className={styles.lede}>Your name on every split. Change it here, not per tap.</p>
        <AccountForm email={user.email} displayName={user.displayName} />
      </div>
    </AppShell>
  );
}
