"use client";

import Link from "next/link";
import styles from "./inbox.module.css";

export type SplitRow = {
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
  if (n === 0) return "Waiting on friends";
  if (n === 1) return "1 person vouched";
  return `${n} people vouched`;
}

export function SplitsListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <ul className={styles.list} aria-hidden="true" data-testid="inbox-skeleton">
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className={styles.skelCard}>
          <span className={styles.skelLine} />
          <span className={`${styles.skelLine} ${styles.skelLineShort}`} />
        </li>
      ))}
    </ul>
  );
}

export function SplitsHome({ initialDocs }: { initialDocs: SplitRow[] }) {
  return initialDocs.length === 0 ? (
    <div className={styles.empty} data-testid="inbox-empty">
      <h2>No receipts yet.</h2>
      <p>Snap a grocery run or a Venmo screenshot. Friends tap the lines they owe.</p>
      <Link className="btn btn-primary" href="/new" data-testid="inbox-new">
        New receipt
      </Link>
    </div>
  ) : (
    <ul className={styles.list} data-testid="inbox-list">
      {initialDocs.map((d) => {
        const reading = d.status === "uploaded" || d.status === "processing";
        return (
          <li key={d.id} className={styles.item}>
            <Link href={`/review/${d.id}`} className={styles.card} data-testid="inbox-card">
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
  );
}
