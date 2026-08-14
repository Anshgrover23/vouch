"use client";

import { createContext, use, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import {
  computedReceiptTotal,
  formatMoney,
  isClaimableKey,
  isItemRowKey,
  isMoneyEditKey,
  isMoneyMetaKey,
  isReceiptTotalSourceKey,
  lineShare,
  partitionReceiptFields,
  sanitizeFieldValue,
  type ClaimStance,
  type SplitClaim,
} from "@/lib/split";
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
  labels: Record<string, string>;
  saving: string | null;
  namePromptId: string | null;
};

type ReviewActions = {
  setActive: (id: string) => void;
  setDraft: (id: string, value: string) => void;
  setLabel: (id: string, value: string) => void;
  save: (id: string) => Promise<void>;
  saveLabel: ((id: string) => Promise<void>) | null;
  claim: ((id: string, stance: ClaimStance) => Promise<void>) | null;
  remove: ((id: string) => Promise<void>) | null;
  promptName: (id: string) => void;
};

type ReviewMeta = {
  page: CanvasPage;
  fields: CanvasField[];
  threshold: number;
  compact: boolean;
  claims: SplitClaim[];
  displayName: string | null;
  nameInputRef: RefObject<HTMLInputElement | null>;
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
  onRenameField,
  onRemoveField,
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
  onRenameField?: (id: string, label: string) => Promise<void>;
  onRemoveField?: (id: string) => Promise<void>;
  onClaim?: (id: string, stance: ClaimStance) => Promise<void>;
  children: ReactNode;
}) {
  const [active, setActive] = useState<string | null>(fields[0]?.id ?? null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [namePromptId, setNamePromptId] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const value = useMemo<ReviewContextValue>(
    () => ({
      state: { active, drafts, labels, saving, namePromptId: displayName ? null : namePromptId },
      actions: {
        setActive,
        setDraft: (id, next) => setDrafts((d) => ({ ...d, [id]: next })),
        setLabel: (id, next) => setLabels((d) => ({ ...d, [id]: next })),
        save: async (id) => {
          if (!onSaveField) return;
          setSaving(id);
          await onSaveField(id, drafts[id] ?? fields.find((f) => f.id === id)?.humanValue ?? fields.find((f) => f.id === id)?.modelValue ?? "");
          setSaving(null);
        },
        saveLabel: onRenameField
          ? async (id) => {
              const field = fields.find((f) => f.id === id);
              const next = (labels[id] ?? field?.label ?? "").trim();
              if (!next || next === field?.label) return;
              setSaving(id);
              await onRenameField(id, next);
              setSaving(null);
            }
          : null,
        claim: onClaim ?? null,
        remove: onRemoveField ?? null,
        promptName: (id) => {
          setNamePromptId(id);
          const node =
            nameInputRef.current ?? document.querySelector<HTMLInputElement>('[data-testid="identity-name"]');
          node?.focus();
        },
      },
      meta: { page, fields, threshold, compact, claims, displayName, nameInputRef },
    }),
    [active, drafts, labels, saving, namePromptId, page, fields, threshold, compact, claims, displayName, onSaveField, onRenameField, onRemoveField, onClaim],
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
    state: { namePromptId },
    meta: { displayName, nameInputRef },
  } = useReview();
  const ready = Boolean(displayName);
  const draft = name.trim();
  const pending = Boolean(ready && draft && draft !== displayName);
  const needName = Boolean(namePromptId) && !ready;

  return (
    <div className={needName ? `${styles.identity} ${styles.identityNeed}` : styles.identity} data-testid="identity-bar">
      <label className={styles.identityField}>
        <span className="mono">you&apos;re splitting as</span>
        <input
          ref={nameInputRef}
          data-testid="identity-name"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="Ram"
          maxLength={48}
          aria-invalid={needName}
        />
      </label>
      <button
        className="btn btn-primary"
        type="button"
        data-testid="identity-confirm"
        onClick={onConfirm}
        disabled={!draft || draft === (displayName ?? "")}
      >
        That&apos;s me
      </button>
      {ready ? (
        pending ? <p className={styles.hint}>Tap That&apos;s me to rename. Your lines move with you.</p> : null
      ) : (
        <p className={needName ? `${styles.hint} ${styles.hintNeed}` : styles.hint}>
          {needName ? "Add your name first" : "Add your name to vouch."}
        </p>
      )}
    </div>
  );
}

function PaidBy({
  paidByName,
  people,
  onChange,
}: {
  paidByName: string;
  people: string[];
  onChange: (name: string) => void;
}) {
  const options = [...new Set([paidByName, ...people].filter(Boolean))];
  if (options.length === 0) return null;
  return (
    <div className={styles.identity} data-testid="paid-by-bar">
      <label className={styles.identityField}>
        <span className="mono">paid by</span>
        <select data-testid="paid-by" value={paidByName} onChange={(e) => onChange(e.target.value)}>
          {options.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </label>
      <p className={styles.hint}>Who covered the bill. Does not block claims.</p>
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
      {page.imageUrl ? (
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
      ) : (
        <div className={styles.typed}>
          <p className="mono">no photo</p>
          <strong>Typed receipt</strong>
        </div>
      )}
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

function fieldClass(active: boolean, low: boolean, section?: "head" | "item" | "foot") {
  return [
    styles.field,
    section === "head" ? styles.fieldHead : null,
    section === "item" ? styles.fieldItem : null,
    section === "foot" ? styles.fieldFoot : null,
    active ? styles.fieldActive : null,
    low ? styles.fieldLow : null,
  ]
    .filter(Boolean)
    .join(" ");
}

function rawValue(field: CanvasField, drafts: Record<string, string>) {
  return drafts[field.id] !== undefined
    ? drafts[field.id]
    : sanitizeFieldValue(field.humanValue) || sanitizeFieldValue(field.modelValue);
}

function useClaimLine() {
  const {
    actions: { claim, promptName },
    meta: { displayName, nameInputRef },
  } = useReview();

  return (id: string, stance: ClaimStance) => {
    if (!displayName) {
      const node =
        nameInputRef.current ?? document.querySelector<HTMLInputElement>('[data-testid="identity-name"]');
      if (node) {
        promptName(id);
        return;
      }
    }
    void claim?.(id, stance);
  };
}

function LineClaims({
  fieldKey,
  fieldId,
  takingWhole,
  splitting,
  notMine,
}: {
  fieldKey: string;
  fieldId: string;
  takingWhole: boolean;
  splitting: boolean;
  notMine: boolean;
}) {
  const handleClaim = useClaimLine();
  return (
    <div className={styles.claims}>
      <button
        type="button"
        data-testid={`owe-${fieldKey}`}
        className={`${takingWhole ? `${styles.claim} ${styles.claimOn}` : styles.claim} ${styles.claimTake}`}
        aria-pressed={takingWhole}
        onClick={() => handleClaim(fieldId, "owe")}
      >
        I owe this
      </button>
      <button
        type="button"
        data-testid={`split-${fieldKey}`}
        className={splitting ? `${styles.claim} ${styles.claimOn}` : styles.claim}
        aria-pressed={splitting}
        onClick={() => handleClaim(fieldId, "split")}
      >
        Split equally
      </button>
      <button
        type="button"
        data-testid={`not-mine-${fieldKey}`}
        className={notMine ? `${styles.claim} ${styles.claimOff}` : styles.claim}
        aria-pressed={notMine}
        onClick={() => handleClaim(fieldId, "not_mine")}
      >
        Not mine
      </button>
    </div>
  );
}

function LineNote({
  field,
  share,
  canClaim,
}: {
  field: CanvasField;
  share: ReturnType<typeof lineShare>;
  canClaim: boolean;
}) {
  const {
    state: { namePromptId },
    meta: { displayName },
  } = useReview();
  const askName = namePromptId === field.id;
  if (share) {
    return (
      <p className={styles.hint}>
        {share.split
          ? `${share.names.join(", ")} · ${formatMoney(share.each)} each`
          : `${share.names[0]} · ${formatMoney(share.each)}. The other person taps Split equally to share it.`}
      </p>
    );
  }
  if (canClaim && !displayName) {
    return (
      <p className={askName ? `${styles.hint} ${styles.hintNeed}` : styles.hint}>
        {askName ? "Add your name first" : "Add your name to vouch."}
      </p>
    );
  }
  if (field.key === "remainder") {
    return <p className={styles.hint}>Left after the lines above, so the split can reach the receipt total.</p>;
  }
  if (canClaim) {
    return <p className={styles.hint}>Nobody has claimed this line yet.</p>;
  }
  return null;
}

function PriceField({
  field,
  value,
  original,
}: {
  field: CanvasField;
  value: string;
  original: string;
}) {
  const {
    state: { saving },
    actions: { setActive, setDraft, save },
  } = useReview();

  const digits = (value || "0.00").replace(/[^\d.]/g, "") || "0.00";

  return (
    <label className={styles.money}>
      <span className={styles.currency} aria-hidden>
        $
      </span>
      <input
        className={styles.price}
        data-testid={`line-amount-${field.key}`}
        value={value}
        style={{ width: `${Math.max(1, digits.length)}ch` }}
        onChange={(e) => setDraft(field.id, e.target.value)}
        onFocus={() => setActive(field.id)}
        onBlur={() => {
          if (value !== original) void save(field.id);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            setDraft(field.id, original);
            e.currentTarget.blur();
          }
        }}
        aria-label={`${field.label} amount`}
        aria-busy={saving === field.id}
        inputMode="decimal"
        enterKeyHint="done"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
      />
    </label>
  );
}

function ReadOnlyMoney({ field, value }: { field: CanvasField; value: string }) {
  const amount = value.replace(/^[^\d-]*/, "").replace(/[^0-9.]/g, "") || value;
  return (
    <span className={styles.money} data-testid={`line-value-${field.key}`}>
      <span className={styles.currency} aria-hidden>
        $
      </span>
      <span
        className={styles.amount}
        {...(field.key === "remainder" ? {} : { "data-testid": `line-amount-${field.key}` })}
      >
        {amount}
      </span>
    </span>
  );
}

function LineGutter({
  canRemove,
  fieldKey,
  label,
  onRemove,
}: {
  canRemove: boolean;
  fieldKey: string;
  label: string;
  onRemove: (() => void) | null;
}) {
  if (canRemove && onRemove) {
    return (
      <button
        className={styles.dismiss}
        type="button"
        data-testid={`line-remove-${fieldKey}`}
        onClick={onRemove}
        aria-label={`Remove ${label}`}
      >
        ×
      </button>
    );
  }
  return <span className={styles.gutter} aria-hidden="true" />;
}

function ItemLine({ field, readOnly }: { field: CanvasField; readOnly: boolean }) {
  const {
    state: { active, drafts, labels, saving },
    actions: { setActive, setLabel, saveLabel, remove, claim },
    meta: { threshold, claims, displayName },
  } = useReview();

  const value = rawValue(field, drafts);
  const original = sanitizeFieldValue(field.humanValue) || sanitizeFieldValue(field.modelValue);
  const labelValue = labels[field.id] ?? field.label;
  const canRename = Boolean(!readOnly && saveLabel);
  const canRemove = Boolean(!readOnly && remove);
  const canEditMoney = Boolean(!readOnly && isMoneyEditKey(field.key));
  const canClaim = Boolean(claim && isClaimableKey(field.key));
  const mine = claims.find((c) => c.fieldId === field.id && c.displayName === displayName);
  const share = lineShare(value, claims, field.id);
  const owingCount = claims.filter((c) => c.fieldId === field.id && c.stance === "owe").length;
  const takingWhole = Boolean(mine?.stance === "owe" && owingCount === 1);
  const splitting = Boolean(mine?.stance === "owe" && owingCount > 1);
  const low = !value || (field.confidence ?? 0) < threshold;

  return (
    <li
      data-testid={`line-${field.key}`}
      className={fieldClass(field.id === active, low, "item")}
      aria-busy={saving === field.id}
    >
      <div className={styles.line}>
        {canRename ? (
          <input
            className={styles.name}
            data-testid={`line-label-${field.key}`}
            value={labelValue}
            maxLength={80}
            onChange={(e) => setLabel(field.id, e.target.value)}
            onFocus={() => setActive(field.id)}
            onBlur={() => {
              const next = labelValue.trim();
              if (!next) {
                setLabel(field.id, field.label);
                return;
              }
              if (next !== field.label) void saveLabel?.(field.id);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") {
                setLabel(field.id, field.label);
                e.currentTarget.blur();
              }
            }}
            aria-label={`${field.label} name`}
            enterKeyHint="done"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            inputMode="text"
          />
        ) : (
          <button type="button" className={styles.nameBtn} onClick={() => setActive(field.id)}>
            {field.label}
          </button>
        )}
        {canEditMoney ? (
          <PriceField field={field} value={value} original={original} />
        ) : (
          <ReadOnlyMoney field={field} value={value} />
        )}
        <LineGutter
          canRemove={canRemove}
          fieldKey={field.key}
          label={labelValue}
          onRemove={canRemove ? () => void remove?.(field.id) : null}
        />
      </div>
      {canClaim ? (
        <LineClaims
          fieldKey={field.key}
          fieldId={field.id}
          takingWhole={takingWhole}
          splitting={splitting}
          notMine={mine?.stance === "not_mine"}
        />
      ) : null}
      <LineNote field={field} share={share} canClaim={canClaim} />
    </li>
  );
}

function OtherLine({
  field,
  readOnly,
  section,
}: {
  field: CanvasField;
  readOnly: boolean;
  section: "head" | "item" | "foot";
}) {
  const {
    state: { active, drafts, saving },
    actions: { setActive, setDraft, save, saveLabel, remove, claim },
    meta: { threshold, claims, displayName },
  } = useReview();

  const value = rawValue(field, drafts);
  const original = sanitizeFieldValue(field.humanValue) || sanitizeFieldValue(field.modelValue);
  const money = isMoneyMetaKey(field.key) || isMoneyEditKey(field.key) || field.key === "remainder";
  const display = money ? formatMoney(value) || value : value;
  const owner = Boolean(saveLabel || remove);
  const canEdit = Boolean(
    !readOnly &&
      field.key !== "remainder" &&
      field.key !== "total" &&
      (isMoneyEditKey(field.key) || owner),
  );
  const canClaim = Boolean(claim && isClaimableKey(field.key));
  const mine = claims.find((c) => c.fieldId === field.id && c.displayName === displayName);
  const share = lineShare(value, claims, field.id);
  const owingCount = claims.filter((c) => c.fieldId === field.id && c.stance === "owe").length;
  const takingWhole = Boolean(mine?.stance === "owe" && owingCount === 1);
  const splitting = Boolean(mine?.stance === "owe" && owingCount > 1);
  const low = field.key !== "remainder" && (!value || (field.confidence ?? 0) < threshold);

  return (
    <li
      data-testid={`line-${field.key}`}
      className={fieldClass(field.id === active, low, section)}
      aria-busy={saving === field.id}
    >
      <div className={styles.line}>
        <span className={styles.metaLabel}>{field.label}</span>
        {canEdit && money ? (
          <PriceField field={field} value={value} original={original} />
        ) : canEdit ? (
          <input
            className={styles.metaInput}
            data-testid={`line-value-${field.key}`}
            value={value}
            maxLength={80}
            onChange={(e) => setDraft(field.id, e.target.value)}
            onFocus={() => setActive(field.id)}
            onBlur={() => {
              if (value.trim() !== original) void save(field.id);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") {
                setDraft(field.id, original);
                e.currentTarget.blur();
              }
            }}
            aria-label={field.label}
            enterKeyHint="done"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            inputMode="text"
          />
        ) : money ? (
          <ReadOnlyMoney field={field} value={value} />
        ) : (
          <p className={styles.metaValue} data-testid={`line-value-${field.key}`}>
            {display}
          </p>
        )}
        <LineGutter canRemove={false} fieldKey={field.key} label={field.label} onRemove={null} />
      </div>
      {canClaim ? (
        <LineClaims
          fieldKey={field.key}
          fieldId={field.id}
          takingWhole={takingWhole}
          splitting={splitting}
          notMine={mine?.stance === "not_mine"}
        />
      ) : null}
      <LineNote field={field} share={share} canClaim={canClaim} />
    </li>
  );
}

function liveFields(fields: CanvasField[], drafts: Record<string, string>) {
  const merged = fields.map((field) =>
    drafts[field.id] != null ? { ...field, humanValue: drafts[field.id] } : field,
  );
  const next = computedReceiptTotal(merged);
  if (next == null) return fields;
  const editing = fields.some((field) => {
    if (!isReceiptTotalSourceKey(field.key) || drafts[field.id] == null) return false;
    const original = sanitizeFieldValue(field.humanValue) || sanitizeFieldValue(field.modelValue);
    return drafts[field.id] !== original;
  });
  if (!editing) return fields;
  const value = next.toFixed(2);
  return fields.map((field) => (field.key === "total" ? { ...field, humanValue: value } : field));
}

function Fields({ readOnly = false }: { readOnly?: boolean }) {
  const {
    state: { drafts },
    meta: { fields },
  } = useReview();
  const { header, items, footer } = partitionReceiptFields(liveFields(fields, drafts));

  return (
    <ol className={styles.fields} data-testid="review-lines">
      {header.map((field) => (
        <OtherLine key={field.id} field={field} readOnly={readOnly} section="head" />
      ))}
      {items.map((field) =>
        isItemRowKey(field.key) ? (
          <ItemLine key={field.id} field={field} readOnly={readOnly} />
        ) : (
          <OtherLine key={field.id} field={field} readOnly={readOnly} section="item" />
        ),
      )}
      {footer.map((field) => (
        <OtherLine key={field.id} field={field} readOnly={readOnly} section="foot" />
      ))}
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
  PaidBy,
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
  onRenameField,
  onRemoveField,
  onClaim,
  paidByName,
  people,
  onPaidByChange,
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
  onRenameField?: (id: string, label: string) => Promise<void>;
  onRemoveField?: (id: string) => Promise<void>;
  onClaim?: (id: string, stance: ClaimStance) => Promise<void>;
  paidByName?: string;
  people?: string[];
  onPaidByChange?: (name: string) => void;
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
      onRenameField={onRenameField}
      onRemoveField={onRemoveField}
      onClaim={onClaim}
    >
      {audio ? <Review.Audio /> : <Review.Source />}
      <Review.Pane>
        {onNameChange && onConfirmName ? (
          <Review.Identity name={name ?? ""} onNameChange={onNameChange} onConfirm={onConfirmName} />
        ) : null}
        {onPaidByChange ? (
          <Review.PaidBy paidByName={paidByName ?? ""} people={people ?? []} onChange={onPaidByChange} />
        ) : null}
        <Review.Fields readOnly={readOnly} />
      </Review.Pane>
    </Review.Root>
  );
}
