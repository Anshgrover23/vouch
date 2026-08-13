"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import styles from "./inbox.module.css";

type SplitRow = {
  id: string;
  status: string;
  createdAt: string;
  error: string | null;
  merchant: string;
  date: string;
  total: string;
  people: number;
};

function when(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function peopleLabel(n: number) {
  if (n === 0) return "Waiting on housemates";
  if (n === 1) return "1 person vouched";
  return `${n} people vouched`;
}

function SplitsHome() {
  const [docs, setDocs] = useState<SplitRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const me = await fetch("/api/auth/demo", { method: "POST", credentials: "include" });
    if (!me.ok) {
      setError("Could not start a session.");
      return;
    }
    const res = await fetch("/api/documents", { credentials: "include" });
    if (!res.ok) {
      setError("Splits could not load. Try again.");
      return;
    }
    const json = await res.json();
    setDocs(json.documents ?? []);
    setError(null);
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <AppShell title="Your splits">
      {error ? <p className={styles.err}>{error}</p> : null}
      {docs.length === 0 && !error ? (
        <div className={styles.empty}>
          <h2>No receipts yet.</h2>
          <p>Snap a grocery run or a Venmo screenshot. Housemates tap the lines they owe.</p>
          <Link className="btn btn-primary" href="/new">
            New receipt
          </Link>
        </div>
      ) : null}
      {docs.length > 0 ? (
        <ul className={styles.list}>
          {docs.map((d) => {
            const reading = d.status === "uploaded" || d.status === "processing";
            return (
              <li key={d.id}>
                <Link href={`/review/${d.id}`} className={styles.card}>
                  <div className={styles.meta}>
                    <strong>{d.merchant || "Receipt"}</strong>
                    <span>
                      {reading
                        ? "Reading the paper…"
                        : [d.date || when(d.createdAt), peopleLabel(d.people)].filter(Boolean).join(" · ")}
                    </span>
                  </div>
                  <em>{reading ? "…" : d.total || "—"}</em>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
    </AppShell>
  );
}

export default function InboxPage() {
  return <SplitsHome />;
}
