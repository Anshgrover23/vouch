"use client";

import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { IconPay, IconReceipt } from "@/components/Brand";
import { StatusChip } from "@/components/StatusChip";
import styles from "./inbox.module.css";

type Doc = { id: string; title: string; status: string; createdAt: string };

function when(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function Queue() {
  const search = useSearchParams();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const started = useRef(false);

  async function ensureSession() {
    const me = await fetch("/api/auth/demo");
    if (me.status === 401) await fetch("/api/auth/demo", { method: "POST" });
  }

  async function load() {
    await ensureSession();
    const res = await fetch("/api/documents");
    if (!res.ok) {
      setError("The queue could not load. Try again.");
      return;
    }
    const json = await res.json();
    setDocs(json.documents ?? []);
    setError(null);
  }

  async function createSample(slug: string) {
    setBusy(true);
    await ensureSession();
    const res = await fetch("/api/documents", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug }),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError("Could not start that sample. Try again.");
      return;
    }
    window.location.href = `/review/${json.document.id}`;
  }

  useEffect(() => {
    load().then(() => {
      const start = search.get("start");
      if (started.current) return;
      if (start === "grocery-receipt" || start === "payment-screenshot") {
        started.current = true;
        createSample(start);
      }
    });
  }, [search]);

  return (
    <AppShell
      title="Queue"
      action={
        <button className="btn" type="button" onClick={load}>
          Refresh
        </button>
      }
    >
      <div className={styles.starters}>
        <button type="button" className={styles.tile} disabled={busy} onClick={() => createSample("grocery-receipt")}>
          <IconReceipt />
          <span>
            <strong>Grocery receipt</strong>
            Merchant, date, total, and each line on the paper.
          </span>
        </button>
        <button type="button" className={styles.tile} disabled={busy} onClick={() => createSample("payment-screenshot")}>
          <IconPay />
          <span>
            <strong>Venmo / Zelle screenshot</strong>
            Amount, from, to, and status — not a driver ID.
          </span>
        </button>
      </div>
      {error ? <p className={styles.err}>{error}</p> : null}
      {docs.length === 0 && !error && !busy ? (
        <p className={styles.empty}>No receipts in the queue yet. Start with a sample above.</p>
      ) : null}
      {docs.length > 0 ? (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Document</th>
              <th>Status</th>
              <th>Opened</th>
            </tr>
          </thead>
          <tbody>
            {docs.map((d) => (
              <tr key={d.id}>
                <td>
                  <Link href={`/review/${d.id}`}>{d.title}</Link>
                </td>
                <td>
                  <StatusChip status={d.status} />
                </td>
                <td className={styles.when}>{when(d.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </AppShell>
  );
}

export default function InboxPage() {
  return (
    <Suspense fallback={null}>
      <Queue />
    </Suspense>
  );
}
