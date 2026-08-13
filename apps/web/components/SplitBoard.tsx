"use client";

import { useState } from "react";
import {
  chatSplit,
  formatMoney,
  parseMoney,
  personShares,
  unclaimedLines,
  type SplitClaim,
  type SplitField,
} from "@/lib/split";
import styles from "./split-board.module.css";

export function SplitBoard({
  fields,
  claims,
}: {
  fields: SplitField[];
  claims: SplitClaim[];
}) {
  const [copied, setCopied] = useState(false);
  const people = personShares(fields, claims);
  const leftover = unclaimedLines(fields, claims);
  const leftoverSum = leftover.reduce((sum, field) => {
    const n = parseMoney(field.humanValue ?? field.modelValue ?? "");
    return sum + (n ?? 0);
  }, 0);

  async function copy() {
    await navigator.clipboard.writeText(chatSplit(fields, claims));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <section className={styles.board}>
      <div className={styles.head}>
        <div>
          <p className="mono">who owes what</p>
          <h2>The split</h2>
        </div>
        <button className="btn btn-primary" type="button" onClick={copy}>
          {copied ? "Copied" : "Copy for the chat"}
        </button>
      </div>
      {people.length === 0 && leftover.length === 0 ? (
        <p className={styles.empty}>Tap I owe this on a line. Totals land here.</p>
      ) : (
        <ul className={styles.people}>
          {people.map((person) => (
            <li key={person.name}>
              <div className={styles.row}>
                <strong>{person.name}</strong>
                <span>{formatMoney(person.total)}</span>
              </div>
              <p className={styles.lines}>
                {person.lines.map((line) => `${line.label} · ${formatMoney(line.share)}`).join("  ")}
              </p>
            </li>
          ))}
          {leftover.length > 0 ? (
            <li className={styles.open}>
              <div className={styles.row}>
                <strong>Still open</strong>
                <span>{leftoverSum ? formatMoney(leftoverSum) : `${leftover.length} lines`}</span>
              </div>
              <p className={styles.lines}>
                {leftover.map((field) => field.label).filter(Boolean).join(" · ") || "Nobody has claimed these yet."}
              </p>
            </li>
          ) : null}
        </ul>
      )}
    </section>
  );
}
