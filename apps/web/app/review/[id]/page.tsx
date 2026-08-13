"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { StatusChip, statusLabel } from "@/components/StatusChip";
import { ReviewCanvas, type CanvasField, type CanvasPage } from "@/components/ReviewCanvas";
import { exportLine, parseDisplayName, type SplitClaim } from "@/lib/split";
import styles from "./review.module.css";

const NAME_KEY = "vouch-display-name";

export default function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const [id, setId] = useState<string>("");
  const [title, setTitle] = useState("Review");
  const [status, setStatus] = useState("processing");
  const [fields, setFields] = useState<CanvasField[]>([]);
  const [claims, setClaims] = useState<SplitClaim[]>([]);
  const [page, setPage] = useState<CanvasPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [approved, setApproved] = useState(false);
  const [shareToken, setShareToken] = useState("");
  const [copied, setCopied] = useState<"link" | "export" | null>(null);
  const [name, setName] = useState("");

  useEffect(() => {
    params.then((p) => setId(p.id));
    const stored = parseDisplayName(window.localStorage.getItem(NAME_KEY));
    if (stored) setName(stored);
  }, [params]);

  async function load(docId: string) {
    const res = await fetch(`/api/documents/${docId}`);
    if (!res.ok) {
      setError("This document is not available.");
      return;
    }
    const json = await res.json();
    setTitle(json.document.title);
    setStatus(json.document.status);
    setShareToken(json.document.shareToken ?? "");
    setFields(
      json.fields.map((f: {
        id: string;
        key: string;
        label: string;
        modelValue: string | null;
        humanValue: string | null;
        confidence: string | null;
        bounds: CanvasField["bounds"];
        status: string;
      }) => ({
        ...f,
        confidence: f.confidence == null ? null : Number(f.confidence),
      })),
    );
    setClaims(
      (json.claims ?? []).map((c: SplitClaim & { displayName?: string }) => ({
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
    const t = setInterval(() => load(id), 1500);
    return () => clearInterval(t);
  }, [id]);

  async function saveField(fieldId: string, value: string) {
    await fetch(`/api/documents/${id}/fields`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fieldId, value }),
    });
    await load(id);
  }

  async function claimLine(fieldId: string, stance: "owe" | "not_mine") {
    const displayName = parseDisplayName(name);
    if (!displayName || !shareToken) {
      setError("Add a display name before you vouch a line.");
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

  async function approve() {
    const res = await fetch(`/api/documents/${id}/approve`, { method: "POST" });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Check the flagged fields before you approve.");
      return;
    }
    setApproved(true);
    setError(null);
    await load(id);
  }

  async function copy(kind: "link" | "export", text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(kind);
    window.setTimeout(() => setCopied(null), 1600);
  }

  const flagged = fields.filter((f) => (f.confidence ?? 1) < 0.92).length;
  const split = exportLine(fields, claims);
  const shareUrl = shareToken && typeof window !== "undefined" ? `${window.location.origin}/s/${shareToken}` : "";

  return (
    <AppShell
      title={title}
      action={
        <>
          <StatusChip status={status} />
          <Link href="/inbox" className="btn">
            Back to queue
          </Link>
          <button className="btn btn-primary" type="button" onClick={approve}>
            Approve
          </button>
        </>
      }
    >
      {error ? <p className={styles.err}>{error}</p> : null}
      <p className={styles.step}>Step 2 of 2</p>
      {status === "processing" || status === "uploaded" ? (
        <p className={styles.note}>Reading the receipt. Line items land on the right when the boxes are ready.</p>
      ) : null}
      {flagged > 0 && page ? (
        <p className={styles.note}>
          {flagged} line{flagged === 1 ? "" : "s"} below the confidence line. {statusLabel(status)}.
        </p>
      ) : null}

      {page ? (
        <div className={styles.toolbar}>
          <label className={styles.name}>
            <span className="mono">your name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => {
                const next = parseDisplayName(name);
                if (next) window.localStorage.setItem(NAME_KEY, next);
              }}
              placeholder="Maya"
              maxLength={48}
            />
          </label>
          <button
            className="btn"
            type="button"
            disabled={!shareUrl}
            onClick={() => copy("link", shareUrl)}
          >
            {copied === "link" ? "Link copied" : "Copy share link"}
          </button>
        </div>
      ) : null}

      {page ? (
        <div className={styles.stage}>
          <ReviewCanvas
            page={page}
            fields={fields}
            onSaveField={saveField}
            onClaim={claimLine}
            claims={claims}
            displayName={parseDisplayName(name)}
          />
        </div>
      ) : status !== "processing" && status !== "uploaded" ? (
        <p className={styles.note}>No page to show yet.</p>
      ) : null}

      {page ? (
        <div className={styles.export}>
          <p className="mono">split</p>
          <p className={styles.exportLine}>{split}</p>
          <button className="btn" type="button" onClick={() => copy("export", split)}>
            {copied === "export" ? "Copied" : "Copy split"}
          </button>
        </div>
      ) : null}

      {approved ? (
        <p className={styles.done}>
          Approved. The split cites this receipt.{" "}
          <Link href="/inbox">Return to the queue</Link>
        </p>
      ) : null}
    </AppShell>
  );
}
