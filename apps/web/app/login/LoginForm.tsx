"use client";

import { useRef, useState, type FormEvent } from "react";
import { AuthField } from "@/app/AuthField";
import { afterAuthPath, emailIssue, passwordIssue } from "@/lib/paths";
import styles from "../auth.module.css";

type FieldErrors = {
  email: string | null;
  password: string | null;
};

const NONE: FieldErrors = { email: null, password: null };

export function LoginForm({ next }: { next: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fields, setFields] = useState<FieldErrors>(NONE);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const nextFields: FieldErrors = {
      email: emailIssue(email),
      password: passwordIssue(password),
    };
    setFields(nextFields);
    setError(null);
    if (nextFields.email) {
      emailRef.current?.focus();
      return;
    }
    if (nextFields.password) {
      passwordRef.current?.focus();
      return;
    }

    setBusy(true);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      error?: string;
      session?: { onboarded: boolean };
    };
    if (!res.ok) {
      setBusy(false);
      setError(json.error || "Could not log in.");
      return;
    }
    window.location.assign(afterAuthPath(Boolean(json.session?.onboarded), next));
  }

  return (
    <form className={styles.form} onSubmit={(e) => void submit(e)} noValidate data-testid="login-form">
      {error ? (
        <p className={styles.err} data-testid="auth-error">
          {error}
        </p>
      ) : null}
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
        autoComplete="current-password"
        value={password}
        error={fields.password}
        onChange={(e) => {
          setPassword(e.target.value);
          setFields((curr) => (curr.password ? { ...curr, password: passwordIssue(e.target.value) } : curr));
        }}
      />
      <button className="btn btn-primary" type="submit" data-testid="auth-submit" disabled={busy}>
        Log in
      </button>
    </form>
  );
}
