"use client";

import Link from "next/link";
import { BrandMark, IconGithub } from "./Brand";
import styles from "./chrome.module.css";

const REPO_URL = "https://github.com/Anshgrover23/vouch";
const CREATOR_URL = "https://github.com/Anshgrover23";
const INTERFAZE_URL = "https://interfaze.ai";
const YC_URL = "https://www.ycombinator.com/companies/interfaze";

export function SiteNav() {
  return (
    <header className={styles.nav}>
      <Link href="/" className={styles.brand} aria-label="Vouch home">
        <BrandMark />
        Vouch
      </Link>
      <div className={styles.actions}>
        <Link href="/inbox" className={styles.splits}>
          Splits
        </Link>
        <Link className="btn btn-primary" href="/new">
          New receipt
        </Link>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className={styles.ft}>
      <p className={styles.ftMeta}>Vouch © 2026</p>
      <p className={styles.ftBy}>
        Created by{" "}
        <a href={CREATOR_URL} target="_blank" rel="noopener noreferrer">
          Ansh Grover
        </a>
        <span className={styles.sep} aria-hidden="true">
          ·
        </span>
        <a className={styles.git} href={REPO_URL} target="_blank" rel="noopener noreferrer">
          <IconGithub size={14} />
          GitHub
        </a>
      </p>
      <p className={styles.ftPowered}>
        <span className={styles.muted}>Powered by</span>
        <a className={styles.mark} href={INTERFAZE_URL} target="_blank" rel="noopener noreferrer">
          <img
            className={styles.interfaze}
            src="/partners/interfaze.svg"
            alt=""
            width={48}
            height={25}
          />
          Interfaze
        </a>
        <span className={styles.sep} aria-hidden="true">
          ·
        </span>
        <a className={styles.mark} href={YC_URL} target="_blank" rel="noopener noreferrer">
          <img className={styles.yc} src="/partners/yc.svg" alt="" width={14} height={14} />
          YC P26
        </a>
      </p>
    </footer>
  );
}
