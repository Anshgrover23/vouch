"use client";

import { useState, type FormEvent } from "react";
import { LogoutLink } from "@/components/Chrome";
import { parseDisplayName } from "@/lib/split";
import styles from "../auth.module.css";

export function AccountForm({
  email,
  displayName,
}: {
  email: string;
  displayName: string;
}) {
  const [name, setName] = useState(displayName);
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameBusy, setNameBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwBusy, setPwBusy] = useState(false);
  const [pwSaved, setPwSaved] = useState(false);

  async function saveName(e: FormEvent) {
    e.preventDefault();
    const parsed = parseDisplayName(name);
    if (!parsed) {
      setNameError("Use a name between 1 and 48 characters.");
      return;
    }
    setNameBusy(true);
    setNameError(null);
    setSaved(false);
    const res = await fetch("/api/account", {
      method: "PATCH",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ displayName: parsed }),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string; session?: { displayName?: string } };
    setNameBusy(false);
    if (!res.ok) {
      setNameError(json.error || "Could not save that name.");
      return;
    }
    setName(json.session?.displayName || parsed);
    setSaved(true);
  }

  async function savePassword(e: FormEvent) {
    e.preventDefault();
    setPwBusy(true);
    setPwError(null);
    setPwSaved(false);
    const res = await fetch("/api/account/password", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ current, next }),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    setPwBusy(false);
    if (!res.ok) {
      setPwError(json.error || "Could not change that password.");
      return;
    }
    setCurrent("");
    setNext("");
    setPwSaved(true);
  }

  return (
    <div className={styles.stack}>
      <div className={styles.card} data-testid="account-you">
        <p className="mono">you</p>
        <strong>{name.trim() || displayName}</strong>
        <span>{email}</span>
      </div>

      <div className={styles.panel}>
        <form className={styles.form} onSubmit={(e) => void saveName(e)} data-testid="account-name-form">
          {nameError ? (
            <p className={styles.err} data-testid="account-name-error">
              {nameError}
            </p>
          ) : null}
          {saved ? <p className={styles.ok}>Name saved. It is what friends see on splits.</p> : null}
          <label>
            <span className="mono">display name</span>
            <input data-testid="account-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={48} />
          </label>
          <button className="btn btn-primary" type="submit" data-testid="account-name-save" disabled={nameBusy}>
            {nameBusy ? "Saving…" : "Save name"}
          </button>
        </form>

        <hr className={styles.rule} />

        <form className={styles.form} onSubmit={(e) => void savePassword(e)} data-testid="account-password-form">
          {pwError ? (
            <p className={styles.err} data-testid="account-password-error">
              {pwError}
            </p>
          ) : null}
          {pwSaved ? <p className={styles.ok}>Password updated.</p> : null}
          <label>
            <span className="mono">current password</span>
            <input
              type="password"
              data-testid="account-password-current"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              autoComplete="current-password"
            />
          </label>
          <label>
            <span className="mono">new password</span>
            <input
              type="password"
              data-testid="account-password-next"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              minLength={8}
              autoComplete="new-password"
            />
          </label>
          <button className="btn" type="submit" data-testid="account-password-save" disabled={pwBusy}>
            {pwBusy ? "Saving…" : "Change password"}
          </button>
        </form>

        <hr className={styles.rule} />

        <div className={styles.foot} data-testid="account-logout">
          <LogoutLink className="btn" />
        </div>
      </div>
    </div>
  );
}
