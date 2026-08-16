"use client";

import { createContext, use, useMemo, useState, type ReactNode } from "react";
import { personSlug } from "@/lib/split";
import styles from "./invite-sheet.module.css";

type SplitPickerState = {
  picked: string[];
};

type SplitPickerActions = {
  toggle: (name: string) => void;
  confirm: () => void;
  dismiss: () => void;
};

type SplitPickerMeta = {
  people: string[];
};

type SplitPickerContextValue = {
  state: SplitPickerState;
  actions: SplitPickerActions;
  meta: SplitPickerMeta;
};

const SplitPickerContext = createContext<SplitPickerContextValue | null>(null);

function useSplitPicker() {
  const ctx = use(SplitPickerContext);
  if (!ctx) throw new Error("Split picker parts must render inside SplitPicker.Root");
  return ctx;
}

function Root({
  people,
  selected,
  onConfirm,
  onDismiss,
  children,
}: {
  people: string[];
  selected: string[];
  onConfirm: (names: string[]) => void;
  onDismiss: () => void;
  children: ReactNode;
}) {
  const [picked, setPicked] = useState(selected);

  const value = useMemo<SplitPickerContextValue>(
    () => ({
      state: { picked },
      actions: {
        toggle: (name) => {
          setPicked((curr) => (curr.includes(name) ? curr.filter((row) => row !== name) : [...curr, name]));
        },
        confirm: () => {
          if (picked.length === 0) return;
          onConfirm(picked);
        },
        dismiss: onDismiss,
      },
      meta: { people },
    }),
    [picked, people, onConfirm, onDismiss],
  );

  return <SplitPickerContext value={value}>{children}</SplitPickerContext>;
}

function Frame({ children }: { children: ReactNode }) {
  const {
    actions: { dismiss },
  } = useSplitPicker();
  return (
    <div
      className={styles.overlay}
      data-testid="split-picker"
      onClick={dismiss}
      onKeyDown={(e) => {
        if (e.key === "Escape") dismiss();
      }}
    >
      <div
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby="split-picker-title"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function Title() {
  return (
    <>
      <p className="mono">split this line</p>
      <h2 id="split-picker-title">Who shares it?</h2>
    </>
  );
}

function Lede() {
  return (
    <p className={styles.lede}>
      You stay on this line. Tick who splits it with you. They will see their share when they open the link.
    </p>
  );
}

function People() {
  const {
    state: { picked },
    actions: { toggle },
    meta: { people },
  } = useSplitPicker();

  return (
    <ul className={styles.people}>
      {people.map((name) => {
        const on = picked.includes(name);
        return (
          <li key={name}>
            <button
              type="button"
              className={on ? `${styles.person} ${styles.personOn}` : styles.person}
              data-testid={`split-with-${personSlug(name)}`}
              aria-pressed={on}
              onClick={() => toggle(name)}
            >
              {name}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function Confirm() {
  const {
    state: { picked },
    actions: { confirm },
  } = useSplitPicker();
  return (
    <button
      className="btn btn-primary"
      type="button"
      data-testid="split-picker-confirm"
      disabled={picked.length === 0}
      onClick={confirm}
    >
      Split equally
    </button>
  );
}

function Cancel() {
  const {
    actions: { dismiss },
  } = useSplitPicker();
  return (
    <button className="btn" type="button" data-testid="split-picker-cancel" onClick={dismiss}>
      Cancel
    </button>
  );
}

function Actions({ children }: { children: ReactNode }) {
  return <div className={styles.actions}>{children}</div>;
}

export const SplitPicker = {
  Root,
  Frame,
  Title,
  Lede,
  People,
  Confirm,
  Cancel,
  Actions,
};
