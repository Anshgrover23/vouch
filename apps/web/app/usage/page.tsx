"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import styles from "./usage.module.css";

export default function UsagePage() {
  const [pages, setPages] = useState(0);

  useEffect(() => {
    fetch("/api/auth/demo").then(async (r) => {
      if (r.status === 401) await fetch("/api/auth/demo", { method: "POST" });
      const usage = await fetch("/api/usage");
      if (usage.ok) {
        const json = await usage.json();
        setPages(json.totals?.pages ?? 0);
      }
    });
  }, []);

  return (
    <AppShell title="Usage">
      <p className={styles.lede}>A page counts when Vouch finishes reading a receipt.</p>
      <dl className={styles.stat}>
        <dt>Pages processed</dt>
        <dd>{pages}</dd>
      </dl>
    </AppShell>
  );
}
