"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./command.module.css";

type Item = { href: string; label: string; hint: string };

export function CommandPalette({
  items,
  open,
  onOpenChange,
}: {
  items: Item[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [q, setQ] = useState("");

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
      if (e.key === "Escape") onOpenChange(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  const filtered = useMemo(
    () => items.filter((i) => (i.label + i.hint).toLowerCase().includes(q.toLowerCase())),
    [items, q],
  );

  if (!open) return null;

  return (
    <div className={styles.back} onClick={() => onOpenChange(false)}>
      <div
        className={styles.pal}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onClick={(e) => e.stopPropagation()}
      >
        <input autoFocus placeholder="Jump to…" value={q} onChange={(e) => setQ(e.target.value)} />
        <ul>
          {filtered.map((i) => (
            <li key={i.href}>
              <a href={i.href} onClick={() => onOpenChange(false)}>
                <strong>{i.label}</strong>
                <span>{i.hint}</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function CmdKButton({ onOpen }: { onOpen: () => void }) {
  return (
    <button type="button" className={styles.cmdk} onClick={onOpen} aria-label="Open command palette">
      ⌘K
    </button>
  );
}
