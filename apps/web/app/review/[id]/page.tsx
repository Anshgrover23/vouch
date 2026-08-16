"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { Invite, type InviteFriend } from "@/components/InviteSheet";
import { ReviewCanvas, type CanvasField, type CanvasPage } from "@/components/ReviewCanvas";
import { ShareLinks, type ShareSeat } from "@/components/ShareLinks";
import { SplitBoard } from "@/components/SplitBoard";
import { parseDisplayName, prettyTitle, receiptHeadline, sanitizeFieldValue, type ClaimStance, type SplitClaim } from "@/lib/split";
import { openInviteSeats } from "@/lib/seat";
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
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [typing, setTyping] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteSeen, setInviteSeen] = useState(false);
  const [inviteReason, setInviteReason] = useState<"share" | "split">("share");
  const [shareOpen, setShareOpen] = useState(false);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [seats, setSeats] = useState<ShareSeat[]>([]);
  const pendingSplit = useRef<string | null>(null);
  const [waiting, setWaiting] = useState<string[]>([]);
  const [paidByName, setPaidByName] = useState("");
  const [people, setPeople] = useState<string[]>([]);

  useEffect(() => {
    params.then((p) => setId(p.id));
    void fetch("/api/auth/me", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : { session: null }))
      .then((json: { session?: { displayName?: string } | null }) => {
        const account = parseDisplayName(json.session?.displayName);
        if (account) setDisplayName(account);
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
        memberId: c.memberId ?? null,
      })),
    );
    setMemberId(typeof json.you?.memberId === "string" ? json.you.memberId : null);
    const youName = parseDisplayName(json.you?.displayName);
    if (youName) setDisplayName(youName);
    setSeats(
      openInviteSeats((json.seats ?? []) as Array<ShareSeat & { you?: boolean }>).map((row) => ({
        displayName: row.displayName,
        inviteToken: row.inviteToken,
        status: row.status,
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
    if (hasValues && !reading && !inviteSeen) {
      setInviteReason("share");
      setInviteOpen(true);
    }
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

  const claimLine = useCallback(async (fieldId: string, stance: ClaimStance, withNames?: string[]) => {
    if (!shareToken) {
      setError("This receipt is not ready to split yet.");
      return;
    }
    const res = await fetch(`/api/splits/${shareToken}/claims`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fieldId, stance, with: withNames }),
    });
    if (res.status === 409) {
      const json = (await res.json().catch(() => ({}))) as { code?: string };
      if (json.code === "needs_friend") {
        pendingSplit.current = fieldId;
        setInviteReason("split");
        setInviteOpen(true);
        return;
      }
    }
    if (!res.ok) {
      setError("Could not save that claim.");
      return;
    }
    setError(null);
    await load(id);
  }, [id, shareToken]);

  const dismissInvite = useCallback(() => {
    pendingSplit.current = null;
    setInviteOpen(false);
    setInviteSeen(true);
  }, []);

  const needFriend = useCallback((fieldId: string) => {
    pendingSplit.current = fieldId;
    setInviteReason("split");
    setInviteOpen(true);
  }, []);

  const addFriend = useCallback(
    async (name: string): Promise<InviteFriend | void> => {
      const parsed = parseDisplayName(name);
      const res = await fetch(`/api/documents/${id}/invites`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ displayName: name }),
      });
      if (!res.ok) {
        setError("Could not add that friend.");
        return;
      }
      const json = (await res.json().catch(() => ({}))) as {
        member?: { displayName?: string; inviteToken?: string };
      };
      setError(null);
      await load(id);
      const fieldId = pendingSplit.current;
      if (fieldId && parsed) {
        pendingSplit.current = null;
        await claimLine(fieldId, "split", [parsed]);
        setInviteOpen(false);
        setInviteSeen(true);
      }
      const friendName = parseDisplayName(json.member?.displayName) ?? parsed;
      const inviteToken = String(json.member?.inviteToken ?? "").trim();
      if (friendName && inviteToken) return { displayName: friendName, inviteToken };
    },
    [id, claimLine],
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
            data-testid="share-open"
            disabled={!shareUrl}
            onClick={() => setShareOpen(true)}
          >
            <>
              <span className={styles.shareLong}>Share with friends</span>
              <span className={styles.shareShort}>Share</span>
            </>
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
              Type 60 and tap I owe this — that person owes $60. Split equally shares the line with a friend on this receipt.
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
                onClaim={displayName ? claimLine : undefined}
                onNeedFriend={displayName ? needFriend : undefined}
                claims={claims}
                displayName={displayName}
                memberId={memberId}
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
                {inviteReason === "split" ? <Invite.SplitTitle /> : <Invite.Title />}
                {inviteReason === "split" ? <Invite.SplitLede /> : <Invite.Lede />}
                <Invite.Friend />
                <Invite.Actions>
                  <Invite.WhatsApp />
                  <Invite.CopyLink />
                  <Invite.Dismiss />
                </Invite.Actions>
              </Invite.Frame>
            </Invite.Root>
          ) : null}

          {shareOpen && shareUrl ? (
            <ShareLinks.Root shareUrl={shareUrl} seats={seats} onDismiss={() => setShareOpen(false)}>
              <ShareLinks.Frame>
                <ShareLinks.Title />
                <ShareLinks.Lede />
                <ShareLinks.ViewOnly />
                <ShareLinks.Seats />
                <ShareLinks.Actions>
                  <ShareLinks.Dismiss />
                </ShareLinks.Actions>
              </ShareLinks.Frame>
            </ShareLinks.Root>
          ) : null}
        </>
      )}
    </AppShell>
  );
}
