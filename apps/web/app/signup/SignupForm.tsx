"use client";

import { useRef, useState, type FormEvent } from "react";
import { AuthField } from "@/app/AuthField";
import { goAfterAuth } from "@/lib/auth-client";
import { emailIssue, passwordIssue } from "@/lib/paths";
import { displayNameIssue } from "@/lib/split";
import styles from "../auth.module.css";

type FieldErrors = {
  displayName: string | null;
  email: string | null;
  password: string | null;
};

const NONE: FieldErrors = { displayName: null, email: null, password: null };

export function SignupForm({ next, invite }: { next: string; invite: string | null }) {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fields, setFields] = useState<FieldErrors>(NONE);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const nextFields: FieldErrors = {
      displayName: displayNameIssue(displayName),
      email: emailIssue(email),
      password: passwordIssue(password),
    };
    setFields(nextFields);
    setError(null);
    if (nextFields.displayName) {
      nameRef.current?.focus();
      return;
    }
    if (nextFields.email) {
      emailRef.current?.focus();
      return;
    }
    if (nextFields.password) {
      passwordRef.current?.focus();
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password, displayName, invite }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(json.error || "Could not create that account.");
        return;
      }
      const saved = await goAfterAuth(next);
      if (!saved) setError("Could not save your session.");
    } catch {
      setError("Could not create that account.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={(e) => void submit(e)} noValidate data-testid="signup-form">
      {error ? (
        <p className={styles.err} data-testid="auth-error">
          {error}
        </p>
      ) : null}
      <AuthField
        ref={nameRef}
        label="your name"
        testId="auth-name"
        autoComplete="name"
        maxLength={48}
        value={displayName}
        error={fields.displayName}
        placeholder="Rio"
        onChange={(e) => {
          setDisplayName(e.target.value);
          setFields((curr) => (curr.displayName ? { ...curr, displayName: displayNameIssue(e.target.value) } : curr));
        }}
      />
      <AuthField
        ref={emailRef}
        label="email"
        testId="auth-email"
        type="email"
        inputMode="email"
        autoComplete="email"
        value={email}
        error={fields.email}
        placeholder="you@example.com"
        onChange={(e) => {
          setEmail(e.target.value);
          setFields((curr) => (curr.email ? { ...curr, email: emailIssue(e.target.value) } : curr));
        }}
      />
      <AuthField
        ref={passwordRef}
        label="password"
        testId="auth-password"
        type="password"
        autoComplete="new-password"
        value={password}
        error={fields.password}
        onChange={(e) => {
          setPassword(e.target.value);
          setFields((curr) => (curr.password ? { ...curr, password: passwordIssue(e.target.value) } : curr));
        }}
      />
      <button className="btn btn-primary" type="submit" data-testid="auth-submit" disabled={busy}>
        Create account
      </button>
    </form>
  );
}
