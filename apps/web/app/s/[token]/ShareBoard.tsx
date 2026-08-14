"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BrandMark } from "@/components/Brand";
import { ReviewCanvas, type CanvasField, type CanvasPage } from "@/components/ReviewCanvas";
import { SplitBoard } from "@/components/SplitBoard";
import { NAME_KEY, commitSplitName } from "@/lib/identity";
import { parseDisplayName, prettyTitle, receiptHeadline, sanitizeFieldValue, type ClaimStance, type SplitClaim } from "@/lib/split";
import styles from "./split.module.css";

export type ShareViewer = { displayName: string } | null;

export function ShareBoard({ token, viewer }: { token: string; viewer: ShareViewer }) {
  const [title, setTitle] = useState("Split");
  const [fields, setFields] = useState<CanvasField[]>([]);
  const [claims, setClaims] = useState<SplitClaim[]>([]);
  const [page, setPage] = useState<CanvasPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [confirmed, setConfirmed] = useState<string | null>(null);

  useEffect(() => {
    const stored = parseDisplayName(window.localStorage.getItem(NAME_KEY));
    const account = parseDisplayName(viewer?.displayName);
    setName(stored || account || "");
  }, [viewer]);

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
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fieldId, value }),
    });
    if (!res.ok) {
      setError("Could not save that line.");
      return;
    }
    await load(token);
  }

  async function claimLine(fieldId: string, stance: ClaimStance) {
    if (!viewer) {
      window.location.assign(`/signup?next=${encodeURIComponent(`/s/${token}`)}`);
      return;
    }
    const res = await fetch(`/api/splits/${token}/claims`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fieldId, stance }),
    });
    if (res.status === 401) {
      window.location.assign(`/login?next=${encodeURIComponent(`/s/${token}`)}`);
      return;
    }
    if (!res.ok) {
      setError("Could not save that claim.");
      return;
    }
    setError(null);
    await load(token);
  }

  async function confirmName() {
    const next = parseDisplayName(name);
    if (!next) return;
    const result = await commitSplitName(token, confirmed, next);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    window.localStorage.setItem(NAME_KEY, result.name);
    setName(result.name);
    setConfirmed(result.name);
    setError(null);
    await load(token);
  }

  const next = `/s/${token}`;

  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <Link href="/" className={styles.brand} aria-label="Vouch home">
          <BrandMark />
          Vouch
        </Link>
        <h1>{title}</h1>
      </header>

      {error ? <p className={styles.err}>{error}</p> : null}

      {viewer ? null : (
        <div className={styles.gate} data-testid="share-gate">
          <p className="mono">this split</p>
          <h2>Log in to vouch your lines.</h2>
          <p>You can look at the receipt now. Claiming a line needs an account — no anonymous names.</p>
          <div className={styles.cta}>
            <Link className="btn btn-primary" href={`/signup?next=${encodeURIComponent(next)}`} data-testid="share-signup">
              Sign up
            </Link>
            <Link className="btn" href={`/login?next=${encodeURIComponent(next)}`} data-testid="share-login">
              Log in
            </Link>
          </div>
        </div>
      )}

      {!page ? <p className={styles.note}>Loading the receipt.</p> : null}

      {page ? (
        <>
          <p className={styles.note}>
            {viewer
              ? "Type your amount and tap I owe this to take the whole line. Split equally only if you are sharing it. The board below is the same for everyone."
              : "This is the receipt. Sign up or log in to tap the lines you owe."}
          </p>
          <div className={styles.stage}>
            <ReviewCanvas
              page={page}
              fields={fields}
              claims={claims}
              displayName={viewer ? confirmed : null}
              name={name}
              onNameChange={viewer ? setName : undefined}
              onConfirmName={viewer ? () => void confirmName() : undefined}
              readOnly={!viewer}
              onSaveField={viewer ? saveField : undefined}
              onClaim={claimLine}
            />
          </div>
          <SplitBoard fields={fields} claims={claims} />
        </>
      ) : null}
    </div>
  );
}
