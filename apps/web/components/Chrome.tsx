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
        <a
          className={styles.github}
          href={REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Vouch on GitHub"
        >
          <IconGithub size={18} />
        </a>
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
      <div className={styles.ftMeta}>
        <span>Vouch © 2026</span>
        <span>
          Created by{" "}
          <a href={CREATOR_URL} target="_blank" rel="noopener noreferrer">
            Ansh Grover
          </a>
        </span>
      </div>
      <div className={styles.ftCredits}>
        <a
          className={styles.ftLink}
          href={REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          <IconGithub />
          GitHub
        </a>
        <span className={styles.powered}>
          <a href={INTERFAZE_URL} target="_blank" rel="noopener noreferrer">
            Powered by
            <img
              className={styles.interfaze}
              src="/partners/interfaze.svg"
              alt=""
              width={72}
              height={37}
            />
            Interfaze
          </a>
          <a href={YC_URL} target="_blank" rel="noopener noreferrer">
            <img className={styles.yc} src="/partners/yc.svg" alt="" width={18} height={18} />
            YC P26
          </a>
        </span>
      </div>
    </footer>
  );
}
