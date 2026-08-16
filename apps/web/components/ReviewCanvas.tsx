"use client";

import { createContext, use, useMemo, useState, type ReactNode } from "react";
import {
  computedReceiptTotal,
  currencySymbol,
  formatMoney,
  moneyInputText,
  isClaimableKey,
  isItemRowKey,
  isMoneyEditKey,
  isMoneyMetaKey,
  isReceiptTotalSourceKey,
  claimIsMine,
  lineShare,
  namesOnReceipt,
  otherPeopleOnReceipt,
  partitionReceiptFields,
  receiptCurrency,
  sanitizeFieldValue,
  type ClaimStance,
  type SplitClaim,
} from "@/lib/split";
import { SplitPicker } from "@/components/SplitPicker";
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
};

type ReviewActions = {
  setActive: (id: string) => void;
  setDraft: (id: string, value: string) => void;
  setLabel: (id: string, value: string) => void;
  save: (id: string) => Promise<void>;
  saveLabel: ((id: string) => Promise<void>) | null;
  claim: ((id: string, stance: ClaimStance, withNames?: string[]) => Promise<void>) | null;
  openSplitPicker: (id: string) => void;
  needFriend: ((id: string) => void) | null;
  remove: ((id: string) => Promise<void>) | null;
};

type ReviewMeta = {
  page: CanvasPage;
  fields: CanvasField[];
  threshold: number;
  compact: boolean;
  claims: SplitClaim[];
  displayName: string | null;
  memberId: string | null;
  people: string[];
  paidByName: string;
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

function useReceiptMoney() {
  const {
    meta: { fields },
  } = useReview();
  const currency = receiptCurrency(fields);
  return {
    symbol: currencySymbol(currency),
    money: (value: string | number | null) => formatMoney(value, currency),
  };
}

function Root({
  page,
  fields,
  threshold = 0.92,
  compact = false,
  claims = [],
  displayName = null,
  memberId = null,
  people = [],
  paidByName = "",
  onSaveField,
  onRenameField,
  onRemoveField,
  onClaim,
  onNeedFriend,
  children,
}: {
  page: CanvasPage;
  fields: CanvasField[];
  threshold?: number;
  compact?: boolean;
  claims?: SplitClaim[];
  displayName?: string | null;
  memberId?: string | null;
  people?: string[];
  paidByName?: string;
  onSaveField?: (id: string, value: string) => Promise<void>;
  onRenameField?: (id: string, label: string) => Promise<void>;
  onRemoveField?: (id: string) => Promise<void>;
  onClaim?: (id: string, stance: ClaimStance, withNames?: string[]) => Promise<void>;
  onNeedFriend?: (id: string) => void;
  children: ReactNode;
}) {
  const [active, setActive] = useState<string | null>(fields[0]?.id ?? null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [splitFieldId, setSplitFieldId] = useState<string | null>(null);

  const value = useMemo<ReviewContextValue>(
    () => ({
      state: { active, drafts, labels, saving },
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
        openSplitPicker: (id) => setSplitFieldId(id),
        needFriend: onNeedFriend ?? null,
        remove: onRemoveField ?? null,
      },
      meta: { page, fields, threshold, compact, claims, displayName, memberId, people, paidByName },
    }),
    [active, drafts, labels, saving, page, fields, threshold, compact, claims, displayName, memberId, people, paidByName, onSaveField, onRenameField, onRemoveField, onClaim, onNeedFriend],
  );

  const others = displayName
    ? otherPeopleOnReceipt(displayName, namesOnReceipt({ displayName, paidByName, people, claims }))
    : [];
  const initialSplitWith = splitFieldId
    ? claims
        .filter((claim) => claim.fieldId === splitFieldId && claim.stance === "owe" && claim.displayName !== displayName)
        .map((claim) => claim.displayName)
        .filter((name) => others.includes(name))
    : [];

  return (
    <ReviewContext value={value}>
      <div className={compact ? `${styles.canvas} ${styles.compact}` : styles.canvas}>{children}</div>
      {splitFieldId && others.length > 1 ? (
        <SplitPicker.Root
          people={others}
          selected={initialSplitWith}
          onConfirm={(names) => {
            void onClaim?.(splitFieldId, "split", names);
            setSplitFieldId(null);
          }}
          onDismiss={() => setSplitFieldId(null)}
        >
          <SplitPicker.Frame>
            <SplitPicker.Title />
            <SplitPicker.Lede />
            <SplitPicker.People />
            <SplitPicker.Actions>
              <SplitPicker.Confirm />
              <SplitPicker.Cancel />
            </SplitPicker.Actions>
          </SplitPicker.Frame>
        </SplitPicker.Root>
      ) : null}
    </ReviewContext>
  );
}

function Pane({ children }: { children: ReactNode }) {
  return <div className={styles.pane}>{children}</div>;
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
    actions: { claim },
  } = useReview();

  return (id: string, stance: ClaimStance, withNames?: string[]) => {
    void claim?.(id, stance, withNames);
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
  const {
    actions: { openSplitPicker, needFriend },
    meta: { displayName, people, paidByName, claims },
  } = useReview();

  function splitEqually() {
    if (!displayName) {
      handleClaim(fieldId, "split");
      return;
    }
    const others = otherPeopleOnReceipt(
      displayName,
      namesOnReceipt({ displayName, paidByName, people, claims }),
    );
    if (others.length === 0) {
      if (needFriend) needFriend(fieldId);
      else handleClaim(fieldId, "split");
      return;
    }
    if (others.length === 1) {
      handleClaim(fieldId, "split", others);
      return;
    }
    openSplitPicker(fieldId);
  }

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
        onClick={splitEqually}
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
  const { money } = useReceiptMoney();
  const {
    meta: { displayName },
  } = useReview();
  if (share) {
    return (
      <p className={styles.hint}>
        {share.split
          ? `${share.names.join(", ")} · ${money(share.each)} each`
          : `${share.names[0]} · ${money(share.each)}`}
      </p>
    );
  }
  if (canClaim && !displayName) {
    return <p className={styles.hint}>Log in to vouch this line.</p>;
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
  const { symbol } = useReceiptMoney();
  const {
    state: { saving },
    actions: { setActive, setDraft, save },
  } = useReview();

  const digits = moneyInputText(value || "0.00").replace(/[^\d.]/g, "") || "0.00";
  const display = moneyInputText(value);

  return (
    <label className={styles.money}>
      <span className={styles.currency} aria-hidden>
        {symbol}
      </span>
      <input
        className={styles.price}
        data-testid={`line-amount-${field.key}`}
        value={display}
        style={{ width: `${Math.max(1, digits.length)}ch` }}
        onChange={(e) => setDraft(field.id, moneyInputText(e.target.value))}
        onFocus={() => setActive(field.id)}
        onBlur={() => {
          if (moneyInputText(value) !== moneyInputText(original)) void save(field.id);
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
  const { symbol } = useReceiptMoney();
  const amount = moneyInputText(value).replace(/[^0-9.]/g, "") || moneyInputText(value);
  return (
    <span className={styles.money} data-testid={`line-value-${field.key}`}>
      <span className={styles.currency} aria-hidden>
        {symbol}
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
    meta: { threshold, claims, displayName, memberId },
  } = useReview();

  const value = rawValue(field, drafts);
  const original = sanitizeFieldValue(field.humanValue) || sanitizeFieldValue(field.modelValue);
  const labelValue = labels[field.id] ?? field.label;
  const canRename = Boolean(!readOnly && saveLabel);
  const canRemove = Boolean(!readOnly && remove);
  const canEditMoney = Boolean(!readOnly && isMoneyEditKey(field.key));
  const canClaim = Boolean(claim && isClaimableKey(field.key));
  const mine = claims.find((c) => c.fieldId === field.id && claimIsMine(c, { displayName, memberId }));
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
  const { money } = useReceiptMoney();
  const {
    state: { active, drafts, saving },
    actions: { setActive, setDraft, save, saveLabel, remove, claim },
    meta: { threshold, claims, displayName, memberId },
  } = useReview();

  const value = rawValue(field, drafts);
  const original = sanitizeFieldValue(field.humanValue) || sanitizeFieldValue(field.modelValue);
  const isMoney = isMoneyMetaKey(field.key) || isMoneyEditKey(field.key) || field.key === "remainder";
  const display = isMoney ? money(value) || value : value;
  const owner = Boolean(saveLabel || remove);
  const canEdit = Boolean(
    !readOnly &&
      field.key !== "remainder" &&
      field.key !== "total" &&
      (isMoneyEditKey(field.key) || owner),
  );
  const canClaim = Boolean(claim && isClaimableKey(field.key));
  const mine = claims.find((c) => c.fieldId === field.id && claimIsMine(c, { displayName, memberId }));
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
        {canEdit && isMoney ? (
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
        ) : isMoney ? (
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
      {header.filter((field) => field.key !== "currency").map((field) => (
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
  memberId,
  onSaveField,
  onRenameField,
  onRemoveField,
  onClaim,
  onNeedFriend,
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
  memberId?: string | null;
  onSaveField?: (id: string, value: string) => Promise<void>;
  onRenameField?: (id: string, label: string) => Promise<void>;
  onRemoveField?: (id: string) => Promise<void>;
  onClaim?: (id: string, stance: ClaimStance, withNames?: string[]) => Promise<void>;
  onNeedFriend?: (id: string) => void;
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
      memberId={memberId}
      people={people}
      paidByName={paidByName}
      onSaveField={onSaveField}
      onRenameField={onRenameField}
      onRemoveField={onRemoveField}
      onClaim={onClaim}
      onNeedFriend={onNeedFriend}
    >
      {audio ? <Review.Audio /> : <Review.Source />}
      <Review.Pane>
        {onPaidByChange ? (
          <Review.PaidBy paidByName={paidByName ?? ""} people={people ?? []} onChange={onPaidByChange} />
        ) : null}
        <Review.Fields readOnly={readOnly} />
      </Review.Pane>
    </Review.Root>
  );
}
