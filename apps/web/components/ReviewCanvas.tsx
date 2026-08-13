"use client";

import { createContext, use, useMemo, useState, type ReactNode } from "react";
import { formatMoney, isClaimableKey, lineShare, sanitizeFieldValue, type SplitClaim } from "@/lib/split";
import styles from "./review.module.css";

export type CanvasField = {
  id: string;
  key: string;
  label: string;
  modelValue: string | null;
  humanValue: string | null;
  confidence: number | null;
  bounds: {
    top_left: { x: number; y: number };
    bottom_right: { x: number; y: number };
    width?: number;
    height?: number;
  } | null;
  status: string;
};

export type CanvasPage = {
  imageUrl: string;
  width: number;
  height: number;
};

type ReviewState = {
  active: string | null;
  drafts: Record<string, string>;
  saving: string | null;
};

type ReviewActions = {
  setActive: (id: string) => void;
  setDraft: (id: string, value: string) => void;
  save: (id: string) => Promise<void>;
  claim: ((id: string, stance: "owe" | "not_mine") => Promise<void>) | null;
};

type ReviewMeta = {
  page: CanvasPage;
  fields: CanvasField[];
  threshold: number;
  compact: boolean;
  claims: SplitClaim[];
  displayName: string | null;
};

type ReviewContextValue = {
  state: ReviewState;
  actions: ReviewActions;
  meta: ReviewMeta;
};

const ReviewContext = createContext<ReviewContextValue | null>(null);

function useReview() {
  const ctx = use(ReviewContext);
  if (!ctx) throw new Error("Review parts must render inside Review.Root");
  return ctx;
}

function Root({
  page,
  fields,
  threshold = 0.92,
  compact = false,
  claims = [],
  displayName = null,
  onSaveField,
  onClaim,
  children,
}: {
  page: CanvasPage;
  fields: CanvasField[];
  threshold?: number;
  compact?: boolean;
  claims?: SplitClaim[];
  displayName?: string | null;
  onSaveField?: (id: string, value: string) => Promise<void>;
  onClaim?: (id: string, stance: "owe" | "not_mine") => Promise<void>;
  children: ReactNode;
}) {
  const [active, setActive] = useState<string | null>(fields[0]?.id ?? null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const value = useMemo<ReviewContextValue>(
    () => ({
      state: { active, drafts, saving },
      actions: {
        setActive,
        setDraft: (id, next) => setDrafts((d) => ({ ...d, [id]: next })),
        save: async (id) => {
          if (!onSaveField) return;
          setSaving(id);
          await onSaveField(id, drafts[id] ?? fields.find((f) => f.id === id)?.humanValue ?? fields.find((f) => f.id === id)?.modelValue ?? "");
          setSaving(null);
        },
        claim: onClaim ?? null,
      },
      meta: { page, fields, threshold, compact, claims, displayName },
    }),
    [active, drafts, saving, page, fields, threshold, compact, claims, displayName, onSaveField, onClaim],
  );

  return (
    <ReviewContext value={value}>
      <div className={compact ? `${styles.canvas} ${styles.compact}` : styles.canvas}>{children}</div>
    </ReviewContext>
  );
}

function Pane({ children }: { children: ReactNode }) {
  return <div className={styles.pane}>{children}</div>;
}

function Identity({
  name,
  onNameChange,
  onConfirm,
}: {
  name: string;
  onNameChange: (value: string) => void;
  onConfirm: () => void;
}) {
  const {
    meta: { displayName },
  } = useReview();
  const ready = Boolean(displayName);

  return (
    <div className={styles.identity}>
      <label className={styles.identityField}>
        <span className="mono">you&apos;re splitting as</span>
        <input
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="Ram"
          maxLength={48}
        />
      </label>
      <button className="btn btn-primary" type="button" onClick={onConfirm} disabled={!name.trim()}>
        That&apos;s me
      </button>
      {ready ? null : <p className={styles.hint}>Add your name to vouch.</p>}
    </div>
  );
}

function Source() {
  const {
    state: { active },
    actions: { setActive },
    meta: { page, fields, threshold },
  } = useReview();

  const boxes = fields
    .filter((f) => f.bounds)
    .map((f) => {
      const b = f.bounds!;
      return {
        id: f.id,
        x: b.top_left.x,
        y: b.top_left.y,
        w: b.width ?? b.bottom_right.x - b.top_left.x,
        h: b.height ?? b.bottom_right.y - b.top_left.y,
        low: (f.confidence ?? 0) < threshold,
      };
    });

  return (
    <div className={styles.photo}>
      <div className={styles.photoInner}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={page.imageUrl} alt="Receipt" />
        <svg viewBox={`0 0 ${page.width} ${page.height}`} aria-hidden="true">
          {boxes.map((b) => (
            <rect
              key={b.id}
              x={b.x}
              y={b.y}
              width={b.w}
              height={b.h}
              className={`${styles.box} ${b.low ? styles.boxLow : ""} ${b.id === active ? styles.boxActive : ""}`}
              onClick={() => setActive(b.id)}
            />
          ))}
        </svg>
      </div>
    </div>
  );
}

function Audio() {
  const {
    state: { active },
    meta: { page, fields },
  } = useReview();
  const current = fields.find((f) => f.id === active) ?? fields[0];

  return (
    <div className={styles.audio}>
      <p className="mono">stt source</p>
      <audio controls src={page.imageUrl} />
      <p>{current?.humanValue ?? current?.modelValue}</p>
    </div>
  );
}

function Fields({ readOnly = false }: { readOnly?: boolean }) {
  const {
    state: { active, drafts, saving },
    actions: { setActive, setDraft, save, claim },
    meta: { fields, threshold, claims, displayName },
  } = useReview();

  return (
    <ol className={styles.fields}>
      {fields.map((f) => {
        const value =
          drafts[f.id] !== undefined
            ? drafts[f.id]
            : sanitizeFieldValue(f.humanValue) || sanitizeFieldValue(f.modelValue);
        const display =
          isClaimableKey(f.key) || f.key === "total" || f.key === "amount"
            ? formatMoney(value) || value
            : value;
        const empty = !value;
        const low = empty || (f.confidence ?? 0) < threshold;
        const mine = claims.find((c) => c.fieldId === f.id && c.displayName === displayName);
        const share = lineShare(value, claims, f.id);
        const canClaim = Boolean(claim && isClaimableKey(f.key));
        const claimEnabled = Boolean(displayName);
        return (
          <li key={f.id} className={f.id === active ? `${styles.field} ${styles.fieldActive}` : styles.field}>
            <button type="button" className={styles.head} onClick={() => setActive(f.id)}>
              <span>{f.label}</span>
              {low ? <span className={`${styles.chip} ${styles.warn}`}>Check this</span> : null}
            </button>
            {readOnly ? <p className={styles.value}>{display}</p> : (
              <div className={styles.edit}>
                <input
                  value={value}
                  onChange={(e) => setDraft(f.id, e.target.value)}
                  onFocus={() => setActive(f.id)}
                  onBlur={() => {
                    const original = sanitizeFieldValue(f.humanValue) || sanitizeFieldValue(f.modelValue);
                    if (value !== original) void save(f.id);
                  }}
                  aria-label={f.label}
                  placeholder="Type what you see"
                />
                {saving === f.id ? <p className={styles.hint}>Saving…</p> : null}
                {f.humanValue ? <p className={styles.hint}>Original reading: {f.modelValue}</p> : null}
              </div>
            )}
            {canClaim ? (
              <div className={styles.claims}>
                <button
                  type="button"
                  className={mine?.stance === "owe" ? `${styles.claim} ${styles.claimOn}` : styles.claim}
                  aria-pressed={mine?.stance === "owe"}
                  disabled={!claimEnabled}
                  onClick={() => claim?.(f.id, "owe")}
                >
                  I owe this
                </button>
                <button
                  type="button"
                  className={mine?.stance === "not_mine" ? `${styles.claim} ${styles.claimOff}` : styles.claim}
                  aria-pressed={mine?.stance === "not_mine"}
                  disabled={!claimEnabled}
                  onClick={() => claim?.(f.id, "not_mine")}
                >
                  Not mine
                </button>
              </div>
            ) : null}
            {share ? (
              <p className={styles.hint}>
                {share.names.join(", ")} · {formatMoney(share.each)} each
              </p>
            ) : canClaim && !claimEnabled ? (
              <p className={styles.hint}>Add your name to vouch.</p>
            ) : canClaim ? (
              <p className={styles.hint}>Nobody has claimed this line yet.</p>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

export const Review = {
  Root,
  Source,
  Audio,
  Fields,
  Pane,
  Identity,
};

export function ReviewCanvas({
  page,
  fields,
  threshold = 0.92,
  readOnly,
  audio,
  compact,
  claims,
  displayName,
  name,
  onNameChange,
  onConfirmName,
  onSaveField,
  onClaim,
}: {
  page: CanvasPage;
  fields: CanvasField[];
  threshold?: number;
  readOnly?: boolean;
  audio?: boolean;
  compact?: boolean;
  claims?: SplitClaim[];
  displayName?: string | null;
  name?: string;
  onNameChange?: (value: string) => void;
  onConfirmName?: () => void;
  onSaveField?: (id: string, value: string) => Promise<void>;
  onClaim?: (id: string, stance: "owe" | "not_mine") => Promise<void>;
}) {
  return (
    <Review.Root
      page={page}
      fields={fields}
      threshold={threshold}
      compact={compact}
      claims={claims}
      displayName={displayName}
      onSaveField={onSaveField}
      onClaim={onClaim}
    >
      {audio ? <Review.Audio /> : <Review.Source />}
      <Review.Pane>
        {onNameChange && onConfirmName ? (
          <Review.Identity name={name ?? ""} onNameChange={onNameChange} onConfirm={onConfirmName} />
        ) : null}
        <Review.Fields readOnly={readOnly} />
      </Review.Pane>
    </Review.Root>
  );
}
