"use client";

import Link from "next/link";
import { BrandMark } from "./Brand";
import styles from "./chrome.module.css";

export function SiteNav() {
  return (
    <header className={styles.nav}>
      <Link href="/" className={styles.brand}>
        <BrandMark />
        Vouch
      </Link>
      <Link className="btn btn-primary" href="/new">
        New receipt
      </Link>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className={styles.ft}>
      <span>Vouch © 2026</span>
      <span>Made for group chats</span>
    </footer>
  );
}
