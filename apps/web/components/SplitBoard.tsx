"use client";

import { useState, type ReactNode } from "react";
import {
  chatSplit,
  formatMoney,
  personShares,
  receiptCurrency,
  splitBalance,
  type SplitClaim,
  type SplitField,
} from "@/lib/split";
import styles from "./split-board.module.css";

function personSlug(name: string) {
  return name.toLowerCase().replace(/\s+/g, "-");
}

export function SplitBoard({
  fields,
  claims,
  children,
}: {
  fields: SplitField[];
  claims: SplitClaim[];
  children?: ReactNode;
}) {
  const [copied, setCopied] = useState(false);
  const people = personShares(fields, claims);
  const { receipt, assigned, open, leftover, leftoverSum, status } = splitBalance(fields, claims);
  const money = (value: string | number | null) => formatMoney(value, receiptCurrency(fields));

  async function copy() {
    await navigator.clipboard.writeText(chatSplit(fields, claims));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <section className={styles.board} data-testid="split-board">
      {children}
      <div className={styles.head}>
        <div>
          <p className="mono">who owes what</p>
          <h2>The split</h2>
        </div>
        <button className={styles.copy} type="button" data-testid="split-copy" onClick={() => void copy()}>
          {copied ? (
            "Copied"
          ) : (
            <>
              <span className={styles.copyFull}>Copy Receipt</span>
              <span className={styles.copyShort}>Copy</span>
            </>
          )}
        </button>
      </div>
      {receipt != null || assigned > 0 || leftover.length > 0 ? (
        <dl className={styles.ledger} data-testid="split-ledger">
          <div>
            <dt>Receipt</dt>
            <dd>{receipt != null ? money(receipt) : "—"}</dd>
          </div>
          <div>
            <dt>Claimed</dt>
            <dd>{money(assigned)}</dd>
          </div>
          <div className={status === "over" ? styles.over : status === "open" ? styles.gap : undefined}>
            <dt>{status === "over" ? "Over" : "Open"}</dt>
            <dd>{money(status === "over" && receipt != null ? assigned - receipt : open)}</dd>
          </div>
        </dl>
      ) : null}
      <p className={styles.live}>
        {status === "settled"
          ? "Adds up. Everyone on this link sees the same names."
          : status === "over"
            ? "Claimed is over the receipt total."
            : "Shared with everyone on the link. Not just you."}
      </p>
      {people.length === 0 && leftover.length === 0 ? (
        <p className={styles.empty}>Tap I owe this on a line. Totals land here for the whole group.</p>
      ) : (
        <ul className={styles.people}>
          {people.map((person) => {
            const slug = personSlug(person.name);
            return (
              <li key={person.name} data-testid={`person-${slug}`}>
                <div className={styles.row}>
                  <strong>{person.name}</strong>
                  <span data-testid={`person-total-${slug}`}>{money(person.total)}</span>
                </div>
                <p className={styles.count}>
                  {person.lines.length === 1 ? "1 item" : `${person.lines.length} items`}
                </p>
                <ul className={styles.ticks}>
                  {person.lines.map((line, i) => (
                    <li key={`${person.name}-${i}`}>
                      <em>{line.label}</em>
                      <b>{money(line.share)}</b>
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
          {leftover.length > 0 ? (
            <li className={styles.open} data-testid="still-open">
              <div className={styles.row}>
                <strong>Still open</strong>
                <span data-testid="still-open-total">
                  {leftoverSum ? money(leftoverSum) : `${leftover.length} lines`}
                </span>
              </div>
              <p className={styles.count}>
                {leftover.length === 1 ? "1 item unclaimed" : `${leftover.length} items unclaimed`}
              </p>
              <ul className={styles.ticks}>
                {leftover.map((field) => (
                  <li key={field.id ?? field.label}>
                    <em>{field.label}</em>
                    <b>{money(field.humanValue ?? field.modelValue)}</b>
                  </li>
                ))}
              </ul>
            </li>
          ) : null}
        </ul>
      )}
    </section>
  );
}
