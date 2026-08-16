"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BrandMark } from "@/components/Brand";
import { ReviewCanvas, type CanvasField, type CanvasPage } from "@/components/ReviewCanvas";
import { SplitBoard } from "@/components/SplitBoard";
import { seatLoginPath, seatSignupPath } from "@/lib/seat";
import { parseDisplayName, prettyTitle, receiptHeadline, sanitizeFieldValue, type ClaimStance, type SplitClaim } from "@/lib/split";
import styles from "./split.module.css";

export type ShareViewer = { displayName: string } | null;

type Seat = { displayName: string; memberId: string; status: string };

export function ShareBoard({ token, viewer, as }: { token: string; viewer: ShareViewer; as?: string | null }) {
  const [title, setTitle] = useState("Split");
  const [fields, setFields] = useState<CanvasField[]>([]);
  const [claims, setClaims] = useState<SplitClaim[]>([]);
  const [people, setPeople] = useState<string[]>([]);
  const [paidByName, setPaidByName] = useState("");
  const [page, setPage] = useState<CanvasPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [seat, setSeat] = useState<Seat | null>(null);
  const invite = String(as ?? "").trim() || null;
  const displayName = parseDisplayName(seat?.displayName ?? viewer?.displayName);
  const memberId = seat?.memberId ?? null;
  const signupHref = invite ? seatSignupPath(token, invite) : `/signup?next=${encodeURIComponent(`/s/${token}`)}`;
  const loginHref = invite ? seatLoginPath(token, invite) : `/login?next=${encodeURIComponent(`/s/${token}`)}`;

  async function load(share: string) {
    const path = invite ? `/api/splits/${share}?as=${encodeURIComponent(invite)}` : `/api/splits/${share}`;
    const res = await fetch(path, { credentials: "include" });
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
        memberId: c.memberId ?? null,
      })),
    );
    setPaidByName(typeof json.document?.paidByName === "string" ? json.document.paidByName : "");
    setPeople(
      ((json.people ?? []) as unknown[])
        .map((row) => parseDisplayName(row))
        .filter((row): row is string => Boolean(row)),
    );
    const nextSeat = json.seat as Seat | null | undefined;
    setSeat(nextSeat?.memberId ? nextSeat : null);
    const first = json.pages[0];
    if (first) setPage({ imageUrl: first.imageUrl, width: first.width, height: first.height });
    setError(null);
  }

  useEffect(() => {
    if (!token) return;
    load(token);
    const t = setInterval(() => load(token), 4000);
    return () => clearInterval(t);
  }, [token, invite]);

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

  async function claimLine(fieldId: string, stance: ClaimStance, withNames?: string[]) {
    if (!viewer) {
      window.location.assign(signupHref);
      return;
    }
    const res = await fetch(`/api/splits/${token}/claims`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fieldId, stance, with: withNames, as: invite }),
    });
    if (res.status === 401) {
      window.location.assign(loginHref);
      return;
    }
    if (res.status === 409) {
      const json = (await res.json().catch(() => ({}))) as { code?: string; error?: string };
      if (json.code === "needs_friend") {
        setError("Add a friend on the receipt first, then split equally.");
        return;
      }
      setError(json.error || "Could not save that claim.");
      return;
    }
    if (!res.ok) {
      setError("Could not save that claim.");
      return;
    }
    setError(null);
    await load(token);
  }

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
          <p className="mono">{seat ? "your seat" : "this split"}</p>
          <h2>{seat ? `Log in to vouch as ${seat.displayName}.` : "Log in to vouch your lines."}</h2>
          <p>
            {seat
              ? `This link is ${seat.displayName}'s seat. You can look now. Claiming needs an account — the name stays ${seat.displayName}.`
              : "You can look at the receipt now. Claiming a line needs an account — no anonymous names."}
          </p>
          <div className={styles.cta}>
            <Link className="btn btn-primary" href={signupHref} data-testid="share-signup">
              Sign up
            </Link>
            <Link className="btn" href={loginHref} data-testid="share-login">
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
              ? "Type your amount and tap I owe this to take the whole line. Split equally shares it with a friend on this receipt."
              : "This is the receipt. Sign up or log in to tap the lines you owe."}
          </p>
          <div className={styles.stage}>
            <ReviewCanvas
              page={page}
              fields={fields}
              claims={claims}
              displayName={displayName}
              memberId={memberId}
              people={people}
              paidByName={paidByName}
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
