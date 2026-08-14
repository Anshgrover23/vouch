"use client";

import { useId, useRef, useState, type ComponentProps, type FormEvent, type Ref } from "react";
import { useRouter } from "next/navigation";
import { dateIssue, lineIssues, merchantIssue, totalIssue } from "@/lib/manual-receipt";
import { GroupCue } from "./GroupCue";
import styles from "./new.module.css";

type Line = { name: string; price: string };
type LineErrors = { name: string | null; price: string | null };
type FieldErrors = {
  merchant: string | null;
  date: string | null;
  total: string | null;
  items: LineErrors[];
};

const EMPTY_LINE: Line = { name: "", price: "" };
const NONE: FieldErrors = {
  merchant: null,
  date: null,
  total: null,
  items: [{ name: null, price: null }],
};

function groupIdFromPage() {
  return new URLSearchParams(window.location.search).get("group");
}

function ManualField({
  label,
  required,
  error,
  testId,
  ref,
  ...props
}: {
  label: string;
  required?: boolean;
  error?: string | null;
  testId: string;
  ref?: Ref<HTMLInputElement>;
} & Omit<ComponentProps<"input">, "ref">) {
  const id = useId();
  const errId = `${id}-err`;
  return (
    <label>
      <span className="mono">
        {label}
        {required ? (
          <span className={styles.req} aria-hidden="true">
            *
          </span>
        ) : null}
      </span>
      <input
        {...props}
        ref={ref}
        id={id}
        data-testid={testId}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errId : undefined}
      />
      {error ? (
        <p className={styles.fieldErr} id={errId} data-testid={`${testId}-error`}>
          {error}
        </p>
      ) : null}
    </label>
  );
}

export function ManualReceipt({ onBack }: { onBack: () => void }) {
  const router = useRouter();
  const [merchant, setMerchant] = useState("");
  const [date, setDate] = useState("");
  const [total, setTotal] = useState("");
  const [items, setItems] = useState<Line[]>([EMPTY_LINE]);
  const [fields, setFields] = useState<FieldErrors>(NONE);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const merchantRef = useRef<HTMLInputElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);
  const totalRef = useRef<HTMLInputElement>(null);
  const itemNameRefs = useRef<Array<HTMLInputElement | null>>([]);
  const itemPriceRefs = useRef<Array<HTMLInputElement | null>>([]);

  function setLine(index: number, patch: Partial<Line>) {
    setItems((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function readErrors(nextMerchant = merchant, nextDate = date, nextTotal = total, nextItems = items): FieldErrors {
    return {
      merchant: merchantIssue(nextMerchant),
      date: dateIssue(nextDate),
      total: totalIssue(nextTotal),
      items: nextItems.map((row, index) => lineIssues(row, index)),
    };
  }

  function focusFirst(next: FieldErrors) {
    if (next.merchant) {
      merchantRef.current?.focus();
      return;
    }
    if (next.date) {
      dateRef.current?.focus();
      return;
    }
    if (next.total) {
      totalRef.current?.focus();
      return;
    }
    const line = next.items.findIndex((row) => row.name || row.price);
    if (line < 0) return;
    if (next.items[line]?.name) itemNameRefs.current[line]?.focus();
    else itemPriceRefs.current[line]?.focus();
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const nextFields = readErrors();
    setFields(nextFields);
    setError(null);
    if (nextFields.merchant || nextFields.date || nextFields.total || nextFields.items.some((row) => row.name || row.price)) {
      focusFirst(nextFields);
      return;
    }

    setBusy(true);
    const res = await fetch("/api/documents", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        slug: "grocery-receipt",
        manual: true,
        merchant,
        date,
        total,
        items,
        groupId: groupIdFromPage(),
      }),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string; document?: { id: string } };
    if (res.status === 401) {
      router.push("/login?next=/new");
      return;
    }
    if (!res.ok || !json.document) {
      setBusy(false);
      setError(json.error || "Could not save that receipt. Try again.");
      return;
    }
    router.push(`/review/${json.document.id}`);
  }

  return (
    <main className={styles.page}>
      <GroupCue />
      <h1>Type the receipt.</h1>
      <p className={styles.lede}>Merchant, date, total, and the lines you can see. No photo required.</p>
      {error ? (
        <p className={styles.err} data-testid="manual-error">
          {error}
        </p>
      ) : null}
      <form className={styles.manual} onSubmit={(e) => void submit(e)} noValidate data-testid="manual-form">
        <ManualField
          ref={merchantRef}
          label="merchant"
          required
          testId="manual-merchant"
          value={merchant}
          maxLength={80}
          placeholder="Corner Deli"
          error={fields.merchant}
          onChange={(e) => {
            setMerchant(e.target.value);
            setFields((curr) => (curr.merchant ? { ...curr, merchant: merchantIssue(e.target.value) } : curr));
          }}
        />
        <ManualField
          ref={dateRef}
          label="date"
          testId="manual-date"
          value={date}
          maxLength={40}
          placeholder="14 Aug 2026"
          error={fields.date}
          onChange={(e) => {
            setDate(e.target.value);
            setFields((curr) => (curr.date ? { ...curr, date: dateIssue(e.target.value) } : curr));
          }}
        />
        <ManualField
          ref={totalRef}
          label="total"
          required
          testId="manual-total"
          value={total}
          inputMode="decimal"
          placeholder="12.50"
          error={fields.total}
          onChange={(e) => {
            setTotal(e.target.value);
            setFields((curr) => (curr.total ? { ...curr, total: totalIssue(e.target.value) } : curr));
          }}
        />
        <div className={styles.lines}>
          <p className="mono">lines</p>
          {items.map((item, index) => {
            const lineErr = fields.items[index] ?? { name: null, price: null };
            const nameErrId = `manual-item-name-${index}-error`;
            const priceErrId = `manual-item-price-${index}-error`;
            return (
              <div className={styles.line} key={index}>
                <div className={styles.lineField}>
                  <input
                    ref={(node) => {
                      itemNameRefs.current[index] = node;
                    }}
                    data-testid={`manual-item-name-${index}`}
                    value={item.name}
                    onChange={(e) => {
                      const name = e.target.value;
                      setLine(index, { name });
                      setFields((curr) => {
                        if (!curr.items[index]?.name && !curr.items[index]?.price) return curr;
                        const nextItems = curr.items.slice();
                        nextItems[index] = lineIssues({ name, price: item.price }, index);
                        return { ...curr, items: nextItems };
                      });
                    }}
                    maxLength={80}
                    placeholder="Coffee"
                    aria-label={`Line ${index + 1} name`}
                    aria-invalid={lineErr.name ? true : undefined}
                    aria-describedby={lineErr.name ? nameErrId : undefined}
                  />
                  {lineErr.name ? (
                    <p className={styles.fieldErr} id={nameErrId} data-testid={nameErrId}>
                      {lineErr.name}
                    </p>
                  ) : null}
                </div>
                <div className={styles.lineField}>
                  <input
                    ref={(node) => {
                      itemPriceRefs.current[index] = node;
                    }}
                    data-testid={`manual-item-price-${index}`}
                    value={item.price}
                    onChange={(e) => {
                      const price = e.target.value;
                      setLine(index, { price });
                      setFields((curr) => {
                        if (!curr.items[index]?.name && !curr.items[index]?.price) return curr;
                        const nextItems = curr.items.slice();
                        nextItems[index] = lineIssues({ name: item.name, price }, index);
                        return { ...curr, items: nextItems };
                      });
                    }}
                    inputMode="decimal"
                    placeholder="4.50"
                    aria-label={`Line ${index + 1} price`}
                    aria-invalid={lineErr.price ? true : undefined}
                    aria-describedby={lineErr.price ? priceErrId : undefined}
                  />
                  {lineErr.price ? (
                    <p className={styles.fieldErr} id={priceErrId} data-testid={priceErrId}>
                      {lineErr.price}
                    </p>
                  ) : null}
                </div>
                {items.length > 1 ? (
                  <button
                    className={styles.remove}
                    type="button"
                    onClick={() => {
                      setItems((rows) => rows.filter((_, i) => i !== index));
                      setFields((curr) => ({
                        ...curr,
                        items: curr.items.filter((_, i) => i !== index),
                      }));
                    }}
                  >
                    Remove
                  </button>
                ) : null}
              </div>
            );
          })}
          <button
            className="btn"
            type="button"
            data-testid="manual-add-line"
            onClick={() => {
              setItems((rows) => [...rows, EMPTY_LINE]);
              setFields((curr) => ({ ...curr, items: [...curr.items, { name: null, price: null }] }));
            }}
          >
            Add a line
          </button>
        </div>
        <div className={styles.actions}>
          <button className="btn" type="button" onClick={onBack}>
            Use a photo
          </button>
          <button className="btn btn-primary" type="submit" data-testid="manual-submit" disabled={busy}>
            {busy ? "Saving…" : "Open the split"}
          </button>
        </div>
      </form>
    </main>
  );
}
