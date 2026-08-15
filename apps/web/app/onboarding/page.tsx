"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BrandMark } from "@/components/Brand";
import { LogoutLink } from "@/components/Chrome";
import styles from "./onboarding.module.css";

type Screen = "pick" | "group";

export default function OnboardingPage() {
  const router = useRouter();
  const [screen, setScreen] = useState<Screen>("pick");
  const [groupName, setGroupName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function finish(body: { path: "group" | "one-off" | "skip"; groupName?: string }) {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/onboarding", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setBusy(false);
      setError(json.error || "Could not finish that step.");
      return;
    }
    router.push("/new");
    router.refresh();
  }

  return (
    <main className={styles.page}>
      <div className={styles.top}>
        <Link href="/" className={styles.brand} aria-label="Vouch home">
          <BrandMark />
          Vouch
        </Link>
        <div className={styles.row}>
          <button className={styles.skip} type="button" data-testid="onboarding-skip" disabled={busy} onClick={() => void finish({ path: "skip" })}>
            Skip
          </button>
          <LogoutLink />
        </div>
      </div>

      {error ? <p className={styles.err}>{error}</p> : null}

      {screen === "pick" ? (
        <>
          <p className="mono">first receipt</p>
          <h1>How do you split?</h1>
          <p className={styles.lede}>
            A house tab you reuse, or a one-off photo. You can skip this and upload a receipt now.
          </p>
          <div className={styles.grid}>
            <button type="button" className={styles.card} data-testid="onboarding-group" onClick={() => setScreen("group")}>
              <p className="mono">path 01</p>
              <h2>Group expense</h2>
              <p>Name the house. Invite people later. Receipts land in one place.</p>
            </button>
            <button
              type="button"
              className={styles.card}
              data-testid="onboarding-one-off"
              disabled={busy}
              onClick={() => void finish({ path: "one-off" })}
            >
              <p className="mono">path 02</p>
              <h2>One-off receipt</h2>
              <p>Snap this grocery run or Venmo shot. No group required.</p>
            </button>
          </div>
        </>
      ) : (
        <form
          className={styles.form}
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            void finish({ path: "group", groupName });
          }}
        >
          <p className="mono">name the house</p>
          <h2>What should we call this group?</h2>
          <p>Invite friends later. You do not have to add anyone now.</p>
          <label>
            <span className="mono">group name</span>
            <input
              data-testid="onboarding-group-name"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              maxLength={80}
              placeholder="412 Oak"
              autoFocus
              required
            />
          </label>
          <div className={styles.row}>
            <button className="btn" type="button" onClick={() => setScreen("pick")}>
              Back
            </button>
            <button className="btn btn-primary" type="submit" data-testid="onboarding-continue" disabled={busy}>
              Continue
            </button>
          </div>
        </form>
      )}
    </main>
  );
}
