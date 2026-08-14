"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { Invite } from "@/components/InviteSheet";
import { ReviewCanvas, type CanvasField, type CanvasPage } from "@/components/ReviewCanvas";
import { SplitBoard } from "@/components/SplitBoard";
import { NAME_KEY, commitSplitName } from "@/lib/identity";
import { parseDisplayName, prettyTitle, receiptHeadline, sanitizeFieldValue, type ClaimStance, type SplitClaim } from "@/lib/split";
import styles from "./review.module.css";

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
  const [confirmed, setConfirmed] = useState<string | null>(null);
  const [typing, setTyping] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteSeen, setInviteSeen] = useState(false);
  const [waiting, setWaiting] = useState<string[]>([]);
  const [paidByName, setPaidByName] = useState("");
  const [people, setPeople] = useState<string[]>([]);

  useEffect(() => {
    params.then((p) => setId(p.id));
    const stored = parseDisplayName(window.localStorage.getItem(NAME_KEY));
    if (stored) setName(stored);
    void fetch("/api/auth/me", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : { session: null }))
      .then((json: { session?: { displayName?: string } | null }) => {
        const account = parseDisplayName(json.session?.displayName);
        if (!account) return;
        setName((current) => current || account);
      })
      .catch(() => {});
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
    setWaiting(
      ((json.waiting ?? []) as Array<{ displayName?: string }>)
        .map((row) => parseDisplayName(row.displayName))
        .filter((row): row is string => Boolean(row)),
    );
    setPaidByName(typeof json.document.paidByName === "string" ? json.document.paidByName : "");
    setPeople(
      ((json.people ?? []) as unknown[])
        .map((row) => parseDisplayName(row))
        .filter((row): row is string => Boolean(row)),
    );
    const first = json.pages[0];
    if (first) setPage({ imageUrl: first.imageUrl, width: first.width, height: first.height });
  }

  useEffect(() => {
    if (!id) return;
    load(id);
    const ms = status === "uploaded" || status === "processing" ? 1500 : 4000;
    const t = setInterval(() => load(id), ms);
    return () => clearInterval(t);
  }, [id, status]);

  const reading = status === "processing" || status === "uploaded";
  const hasValues = fields.some(fieldFilled);
  const failedRead = Boolean(error) && !hasValues && !reading;
  const showCanvas = page && (!failedRead || typing);
  const showSplit = showCanvas && hasValues;

  useEffect(() => {
    if (hasValues && !reading && !inviteSeen) setInviteOpen(true);
  }, [hasValues, reading, inviteSeen]);

  async function saveField(fieldId: string, value: string) {
    await fetch(`/api/documents/${id}/fields`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fieldId, value }),
    });
    await load(id);
  }

  async function renameField(fieldId: string, label: string) {
    const res = await fetch(`/api/documents/${id}/fields`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fieldId, label }),
    });
    if (!res.ok) {
      setError("Could not rename that line.");
      return;
    }
    setError(null);
    await load(id);
  }

  async function removeField(fieldId: string) {
    const res = await fetch(`/api/documents/${id}/fields`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fieldId, ignored: true }),
    });
    if (!res.ok) {
      setError("Could not remove that line.");
      return;
    }
    setError(null);
    await load(id);
  }

  async function savePaidBy(next: string) {
    const parsed = parseDisplayName(next);
    if (!parsed || !id) return;
    setPaidByName(parsed);
    await fetch(`/api/documents/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ paidByName: parsed }),
    });
  }

  async function claimLine(fieldId: string, stance: ClaimStance) {
    const displayName = confirmed;
    if (!displayName || !shareToken) {
      setError("Add your name before you vouch a line.");
      return;
    }
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

  async function confirmName() {
    const next = parseDisplayName(name);
    if (!next) return;
    if (shareToken) {
      const result = await commitSplitName(shareToken, confirmed, next);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      window.localStorage.setItem(NAME_KEY, result.name);
      setName(result.name);
      setConfirmed(result.name);
      await load(id);
    } else {
      window.localStorage.setItem(NAME_KEY, next);
      setName(next);
      setConfirmed(next);
    }
    setError(null);
  }

  const dismissInvite = useCallback(() => {
    setInviteOpen(false);
    setInviteSeen(true);
  }, []);

  const addFriend = useCallback(
    async (displayName: string) => {
      const res = await fetch(`/api/documents/${id}/invites`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ displayName }),
      });
      if (!res.ok) {
        setError("Could not add that friend.");
        return;
      }
      setError(null);
      await load(id);
    },
    [id],
  );

  const shareUrl = shareToken && typeof window !== "undefined" ? `${window.location.origin}/s/${shareToken}` : "";

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
                <span className={styles.shareLong}>Share with friends</span>
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
            <p className={styles.note}>
              Type 60 and tap I owe this — that person owes $60. Split equally only if you are sharing the same line.
            </p>
          )}

          {showCanvas && page ? (
            <div className={styles.stage}>
              <ReviewCanvas
                page={page}
                fields={fields}
                onSaveField={saveField}
                onRenameField={renameField}
                onRemoveField={removeField}
                onClaim={claimLine}
                claims={claims}
                displayName={confirmed}
                name={name}
                onNameChange={setName}
                onConfirmName={() => void confirmName()}
                paidByName={paidByName}
                people={people}
                onPaidByChange={(next) => void savePaidBy(next)}
              />
            </div>
          ) : !reading ? (
            <p className={styles.note}>No page to show yet.</p>
          ) : null}

          {showSplit ? (
            <SplitBoard fields={fields} claims={claims}>
              {waiting.length > 0 ? (
                <p className={styles.waiting} data-testid="waiting-banner">
                  Waiting for {waiting.join(", ")}
                </p>
              ) : null}
            </SplitBoard>
          ) : null}

          {inviteOpen && shareUrl ? (
            <Invite.Root shareUrl={shareUrl} onDismiss={dismissInvite} onAddFriend={addFriend}>
              <Invite.Frame>
                <Invite.Title />
                <Invite.Lede />
                <Invite.Friend />
                <Invite.Actions>
                  <Invite.WhatsApp />
                  <Invite.CopyLink />
                  <Invite.Dismiss />
                </Invite.Actions>
              </Invite.Frame>
            </Invite.Root>
          ) : null}
        </>
      )}
    </AppShell>
  );
}
