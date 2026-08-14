"use client";

import { useId, type ComponentProps, type Ref } from "react";
import styles from "./auth.module.css";

export function AuthField({
  label,
  error,
  testId,
  ref,
  ...props
}: {
  label: string;
  error?: string | null;
  testId: string;
  ref?: Ref<HTMLInputElement>;
} & Omit<ComponentProps<"input">, "ref">) {
  const id = useId();
  const errId = `${id}-err`;
  return (
    <label>
      <span className="mono">{label}</span>
      <input
        {...props}
        ref={ref}
        id={id}
        data-testid={testId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errId : undefined}
      />
      {error ? (
        <p className={styles.fieldErr} id={errId} data-testid={`${testId}-error`}>
          {error}
        </p>
      ) : null}
    </label>
  );
}
