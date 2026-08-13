"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SiteNav } from "@/components/Chrome";
import { IconArrow, IconCamera, IconUpload } from "@/components/Brand";
import styles from "./new.module.css";

type Kind = "grocery-receipt" | "payment-screenshot";

const chips: Array<{ slug: Kind; label: string }> = [
  { slug: "grocery-receipt", label: "Grocery receipt" },
  { slug: "grocery-receipt", label: "Restaurant bill" },
  { slug: "payment-screenshot", label: "Venmo screenshot" },
];

export default function NewReceiptPage() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [kind, setKind] = useState<Kind>("grocery-receipt");
  const [chip, setChip] = useState("Grocery receipt");
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<"idle" | "reading">("idle");
  const [error, setError] = useState<string | null>(null);

  async function ensureSession() {
    await fetch("/api/auth/demo", { method: "POST", credentials: "include" });
  }

  async function createDocument(slug: Kind, upload?: File | null) {
    if (upload) {
      const body = new FormData();
      body.set("slug", slug);
      body.set("file", upload);
      return fetch("/api/documents", { method: "POST", body, credentials: "include" });
    }
    return fetch("/api/documents", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug }),
    });
  }

  async function start(slug: Kind, upload?: File | null) {
    setBusy(true);
    setError(null);
    setPhase("reading");
    await ensureSession();
    let res = await createDocument(slug, upload);
    if (res.status === 401) {
      await fetch("/api/auth/demo", { method: "POST", credentials: "include" });
      res = await createDocument(slug, upload);
    }
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setBusy(false);
      setPhase("idle");
      setError(
        json.error === "unauthorized"
          ? "Session expired. Tap Read the receipt again."
          : json.error === "file too large"
            ? "That image is over 8MB."
            : json.error === "unknown template"
              ? "Unknown receipt type."
              : "Could not start that receipt. Try again.",
      );
      return;
    }
    const id = json.document.id as string;
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 1200));
      const check = await fetch(`/api/documents/${id}`, { credentials: "include" });
      if (!check.ok) continue;
      const doc = await check.json();
      const status = doc.document?.status as string;
      if (status && status !== "uploaded" && status !== "processing") {
        router.push(`/review/${id}`);
        return;
      }
    }
    router.push(`/review/${id}`);
  }

  function takeFile(next: File | null) {
    if (!next) return;
    if (next.size > 8 * 1024 * 1024) {
      setError("Max 8MB.");
      return;
    }
    if (!/image\/(jpeg|png|webp)/.test(next.type)) {
      setError("JPG, PNG, or WEBP.");
      return;
    }
    setError(null);
    setFile(next);
    setPreview(URL.createObjectURL(next));
  }

  return (
    <>
      <SiteNav />
      <main className={styles.page}>
        <p className={styles.step}>Step 1 of 2</p>
        <h1>Show us the paper.</h1>
        <p className={styles.lede}>
          Drop a photo of the receipt — or a Venmo/Zelle screenshot. AI pulls every line item onto the page.
        </p>

        {error ? <p className={styles.err}>{error}</p> : null}

        {phase === "reading" ? (
          <section className={styles.card}>
            <div className={styles.scan}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview || "/samples/receipt.png"} alt="Receipt being read" />
              <span className={styles.beam} />
            </div>
            <div className={styles.status}>
              <p className={styles.reading}>Reading paper</p>
              <h2>Extracting line items...</h2>
              <ul>
                <li>Merchant + date</li>
                <li>Every priced line</li>
                <li>Confidence per line</li>
                <li>Grand total</li>
              </ul>
              <p className={styles.wait}>Usually a few seconds.</p>
            </div>
          </section>
        ) : (
          <>
            <label
              className={styles.drop}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                takeFile(e.dataTransfer.files[0] ?? null);
              }}
            >
              <input
                ref={input}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                onChange={(e) => takeFile(e.target.files?.[0] ?? null)}
              />
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="Selected receipt" className={styles.preview} />
              ) : (
                <>
                  <span className={styles.uploadMark}>
                    <IconUpload />
                  </span>
                  <strong>Drop receipt here</strong>
                  <span className={styles.hint}>or click to browse · JPG, PNG, WEBP · max 8MB</span>
                </>
              )}
              <div className={styles.chips}>
                {chips.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    className={chip === item.label ? styles.chipOn : styles.chip}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setKind(item.slug);
                      setChip(item.label);
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </label>
            <div className={styles.actions}>
              <button className="btn" type="button" onClick={() => input.current?.click()}>
                <IconCamera />
                Choose file
              </button>
              <button
                className="btn btn-primary"
                type="button"
                disabled={busy}
                onClick={() => start(kind, file)}
              >
                Read the receipt
                <IconArrow />
              </button>
            </div>
          </>
        )}
      </main>
    </>
  );
}
