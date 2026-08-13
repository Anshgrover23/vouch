"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { ReviewCanvas, type CanvasField, type CanvasPage } from "@/components/ReviewCanvas";
import { SplitBoard } from "@/components/SplitBoard";
import { parseDisplayName, prettyTitle, receiptHeadline, sanitizeFieldValue, type SplitClaim } from "@/lib/split";
import styles from "./review.module.css";

const NAME_KEY = "vouch-display-name";

function fieldFilled(field: CanvasField) {
  return Boolean(sanitizeFieldValue(field.humanValue) || sanitizeFieldValue(field.modelValue));
}

export default function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const [id, setId] = useState("");
  const [title, setTitle] = useState("Receipt");
  const [status, setStatus] = useState("processing");
  const [fields, setFields] = useState<CanvasField[]>([]);
  const [claims, setClaims] = useState<SplitClaim[]>([]);
  const [page, setPage] = useState<CanvasPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shareToken, setShareToken] = useState("");
  const [copied, setCopied] = useState(false);
  const [name, setName] = useState("");
  const [named, setNamed] = useState(false);
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    params.then((p) => setId(p.id));
    const stored = parseDisplayName(window.localStorage.getItem(NAME_KEY));
    if (stored) {
      setName(stored);
      setNamed(true);
    }
  }, [params]);

  async function load(docId: string) {
    const res = await fetch(`/api/documents/${docId}`, { credentials: "include" });
    if (!res.ok) {
      setError("This receipt is not available.");
      setStatus("missing");
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
    setStatus(json.document.status);
    setShareToken(json.document.shareToken ?? "");
    const filled = nextFields.some(fieldFilled);
    if (json.document.error && !filled) setError(json.document.error);
    else setError(null);
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
  }

  useEffect(() => {
    if (!id) return;
    load(id);
    if (status !== "uploaded" && status !== "processing") return;
    const t = setInterval(() => load(id), 1500);
    return () => clearInterval(t);
  }, [id, status]);

  async function saveField(fieldId: string, value: string) {
    await fetch(`/api/documents/${id}/fields`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fieldId, value }),
    });
    await load(id);
  }

  async function claimLine(fieldId: string, stance: "owe" | "not_mine") {
    const displayName = parseDisplayName(name);
    if (!displayName || !named || !shareToken) {
      setError("Add your name before you vouch a line.");
      return;
    }
    window.localStorage.setItem(NAME_KEY, displayName);
    const res = await fetch(`/api/splits/${shareToken}/claims`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ displayName, fieldId, stance }),
    });
    if (!res.ok) {
      setError("Could not save that claim.");
      return;
    }
    setError(null);
    await load(id);
  }

  function confirmName() {
    const next = parseDisplayName(name);
    if (!next) return;
    window.localStorage.setItem(NAME_KEY, next);
    setName(next);
    setNamed(true);
    setError(null);
  }

  const shareUrl = shareToken && typeof window !== "undefined" ? `${window.location.origin}/s/${shareToken}` : "";
  const reading = status === "processing" || status === "uploaded";
  const hasValues = fields.some(fieldFilled);
  const failedRead = Boolean(error) && !hasValues && !reading;
  const showCanvas = page && (!failedRead || typing);
  const showSplit = showCanvas && hasValues;

  return (
    <AppShell
      title={title}
      action={
        failedRead && !hasValues ? undefined : (
          <button
            className="btn btn-primary"
            type="button"
            disabled={!shareUrl}
            onClick={async () => {
              await navigator.clipboard.writeText(shareUrl);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1600);
            }}
          >
            {copied ? "Copied" : (
              <>
                <span className={styles.shareLong}>Share with housemates</span>
                <span className={styles.shareShort}>Share</span>
              </>
            )}
          </button>
        )
      }
    >
      {failedRead && !typing ? (
        <section className={styles.fail}>
          {page ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={page.imageUrl} alt="Receipt that could not be read" className={styles.failThumb} />
          ) : null}
          <p className={styles.failReason}>{error}</p>
          <div className={styles.failActions}>
            <Link className="btn btn-primary" href="/new">
              Try another photo
            </Link>
            <button className="btn" type="button" onClick={() => setTyping(true)}>
              I&apos;ll type it
            </button>
          </div>
        </section>
      ) : (
        <>
          {error && !failedRead ? <p className={styles.err}>{error}</p> : null}

          {reading ? (
            <p className={styles.note}>Reading the receipt. Line items land on the right when they are ready.</p>
          ) : typing && failedRead ? (
            <p className={styles.note}>Type the lines you can see. Then tap what you owe and send the link.</p>
          ) : (
            <p className={styles.note}>Fix a wrong line if you need to. Then tap what you owe and send the link.</p>
          )}

          {showCanvas && page ? (
            <div className={styles.stage}>
              <ReviewCanvas
                page={page}
                fields={fields}
                onSaveField={saveField}
                onClaim={claimLine}
                claims={claims}
                displayName={named ? parseDisplayName(name) : null}
                name={name}
                onNameChange={(value) => {
                  setName(value);
                  setNamed(false);
                }}
                onConfirmName={confirmName}
              />
            </div>
          ) : !reading ? (
            <p className={styles.note}>No page to show yet.</p>
          ) : null}

          {showSplit ? <SplitBoard fields={fields} claims={claims} /> : null}
        </>
      )}
    </AppShell>
  );
}
