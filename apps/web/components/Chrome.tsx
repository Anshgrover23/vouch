"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BrandMark, IconGithub } from "./Brand";
import styles from "./chrome.module.css";

const REPO_URL = "https://github.com/Anshgrover23/vouch";
const CREATOR_URL = "https://github.com/Anshgrover23";
const INTERFAZE_URL = "https://interfaze.ai";
const YC_URL = "https://www.ycombinator.com/companies/interfaze";

export type NavSession = {
  email: string;
  displayName: string;
} | null;

export function SiteNav({ session }: { session: NavSession }) {
  return (
    <header className={session ? styles.nav : styles.navGuest}>
      <Link href="/" className={styles.brand} aria-label="Vouch home">
        <BrandMark />
        <span className={styles.brandWord}>Vouch</span>
      </Link>
      {session ? <SignedInActions /> : <GuestChrome />}
    </header>
  );
}

function GuestChrome() {
  return (
    <>
      <nav className={styles.links} aria-label="Product">
        <a href="/#how" className={styles.splits} data-testid="nav-how">
          How it works
        </a>
        <a href="/#features" className={styles.splits} data-testid="nav-features">
          Features
        </a>
      </nav>
      <div className={styles.actions}>
        <Link href="/login" className={styles.splits} data-testid="nav-login">
          Sign in
        </Link>
        <Link className="btn btn-primary" href="/signup" data-testid="nav-signup">
          Get started
        </Link>
      </div>
    </>
  );
}

function SignedInActions() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <>
      <nav
        id="site-nav-links"
        className={open ? `${styles.links} ${styles.linksOpen}` : styles.links}
        aria-label="App"
      >
        <Link href="/inbox" data-testid="nav-splits">
          Splits
        </Link>
        <Link href="/groups" data-testid="nav-groups">
          Groups
        </Link>
        <Link href="/account" data-testid="nav-account">
          Account
        </Link>
      </nav>
      <button
        type="button"
        className={styles.menuBtn}
        data-testid="nav-menu"
        aria-expanded={open}
        aria-controls="site-nav-links"
        onClick={() => setOpen((current) => !current)}
      >
        {open ? "Close" : "Menu"}
      </button>
      <Link className={`btn btn-primary ${styles.cta}`} href="/new">
        New receipt
      </Link>
    </>
  );
}

export function LogoutLink({ className }: { className?: string }) {
  return (
    <button
      type="button"
      className={className ?? styles.splits}
      onClick={() => {
        void fetch("/api/auth/logout", { method: "POST", credentials: "include" }).then(() => {
          window.location.href = "/";
        });
      }}
    >
      Log out
    </button>
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
