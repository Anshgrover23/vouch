"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { BrandMark } from "@/components/Brand";
import { ReviewCanvas, type CanvasField, type CanvasPage } from "@/components/ReviewCanvas";
import { SplitBoard } from "@/components/SplitBoard";
import { parseDisplayName, prettyTitle, receiptHeadline, sanitizeFieldValue, type SplitClaim } from "@/lib/split";
import styles from "./split.module.css";

const NAME_KEY = "vouch-display-name";

export default function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const [token, setToken] = useState("");
  const [title, setTitle] = useState("Split");
  const [fields, setFields] = useState<CanvasField[]>([]);
  const [claims, setClaims] = useState<SplitClaim[]>([]);
  const [page, setPage] = useState<CanvasPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    params.then((p) => setToken(p.token));
    const stored = parseDisplayName(window.localStorage.getItem(NAME_KEY));
    if (stored) {
      setName(stored);
      setJoined(true);
    }
  }, [params]);

  async function load(share: string) {
    const res = await fetch(`/api/splits/${share}`);
    if (!res.ok) {
      setError("This split link is not available.");
      return;
    }
    const json = await res.json();
    const nextFields = json.fields.map((f: CanvasField & { confidence: string | null }) => ({
      ...f,
      modelValue: sanitizeFieldValue(f.modelValue) || null,
      humanValue: sanitizeFieldValue(f.humanValue) || null,
      confidence: f.confidence == null ? null : Number(f.confidence),
    }));
    setTitle(receiptHeadline(nextFields, prettyTitle(json.document.title)));
    setFields(nextFields);
    setClaims(
      (json.claims ?? []).map((c: SplitClaim) => ({
        fieldId: c.fieldId,
        displayName: c.displayName,
        stance: c.stance,
      })),
    );
    const first = json.pages[0];
    if (first) setPage({ imageUrl: first.imageUrl, width: first.width, height: first.height });
    setError(null);
  }

  useEffect(() => {
    if (!token) return;
    load(token);
    const t = setInterval(() => load(token), 4000);
    return () => clearInterval(t);
  }, [token]);

  async function saveField(fieldId: string, value: string) {
    const res = await fetch(`/api/splits/${token}/fields`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fieldId, value }),
    });
    if (!res.ok) {
      setError("Could not save that line.");
      return;
    }
    await load(token);
  }

  async function claimLine(fieldId: string, stance: "owe" | "not_mine") {
    const displayName = parseDisplayName(name);
    if (!displayName) {
      setError("Add a display name before you vouch a line.");
      return;
    }
    const res = await fetch(`/api/splits/${token}/claims`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ displayName, fieldId, stance }),
    });
    if (!res.ok) {
      setError("Could not save that claim.");
      return;
    }
    setError(null);
    await load(token);
  }

  function join(e: FormEvent) {
    e.preventDefault();
    const displayName = parseDisplayName(name);
    if (!displayName) {
      setError("Use a name between 1 and 48 characters.");
      return;
    }
    window.localStorage.setItem(NAME_KEY, displayName);
    setName(displayName);
    setJoined(true);
    setError(null);
  }

  const displayName = parseDisplayName(name);

  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <Link href="/" className={styles.brand}>
          <BrandMark />
          Vouch
        </Link>
        <h1>{title}</h1>
      </header>

      {error ? <p className={styles.err}>{error}</p> : null}

      {!joined ? (
        <form className={styles.gate} onSubmit={join}>
          <p className="mono">join this split</p>
          <h2>What should housemates see?</h2>
          <p>A first name only. No account yet.</p>
          <label>
            <span className="mono">your name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={48} placeholder="Rio" autoFocus />
          </label>
          <button className="btn btn-primary" type="submit">
            Open the receipt
          </button>
        </form>
      ) : null}

      {joined && !page ? <p className={styles.note}>Loading the receipt.</p> : null}

      {joined && page ? (
        <>
          <p className={styles.note}>Tap the lines you owe. Fix a price if the reading is wrong — everyone on this link can.</p>
          <div className={styles.stage}>
            <ReviewCanvas
              page={page}
              fields={fields}
              claims={claims}
              displayName={displayName}
              name={name}
              onNameChange={setName}
              onConfirmName={() => {
                const next = parseDisplayName(name);
                if (!next) {
                  setError("Use a name between 1 and 48 characters.");
                  return;
                }
                window.localStorage.setItem(NAME_KEY, next);
                setName(next);
                setError(null);
              }}
              onSaveField={saveField}
              onClaim={claimLine}
            />
          </div>
          <SplitBoard fields={fields} claims={claims} />
        </>
      ) : null}
    </div>
  );
}
