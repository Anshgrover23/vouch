import styles from "./status.module.css";

const labels: Record<string, string> = {
  uploaded: "Queued",
  processing: "Reading",
  needs_review: "Needs review",
  approved: "Approved",
  rejected: "Held",
};

export function statusLabel(status: string) {
  return labels[status] ?? status;
}

export function StatusChip({ status }: { status: string }) {
  const tone =
    status === "approved" ? styles.ok : status === "needs_review" || status === "rejected" ? styles.warn : styles.neutral;
  return <span className={`${styles.chip} ${tone}`}>{statusLabel(status)}</span>;
}
