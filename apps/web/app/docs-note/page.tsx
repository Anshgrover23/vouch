"use client";

import { SiteFooter, SiteNav } from "@/components/Chrome";

export default function DocsNote() {
  return (
    <>
      <SiteNav />
      <main className="wrap prose">
        <p className="mono">why this exists</p>
        <h1>Precontext is the product</h1>
        <p>
          Interfaze returns structured JSON plus <code>precontext</code>: bounding boxes, confidence, STT timestamps.
          Most wrappers hide that. Vouch stores it and builds review rules on it.
        </p>
        <p>
          Read the Interfaze docs:{" "}
          <a href="https://interfaze.ai/docs/precontext">interfaze.ai/docs/precontext</a>
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
