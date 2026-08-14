"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { BrandMark } from "./Brand";
import styles from "./app-shell.module.css";

export function AppShell({
  children,
  title,
  action,
}: {
  children: ReactNode;
  title?: string;
  action?: ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const showTitle = Boolean(title) || Boolean(action);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div className={styles.frame}>
      <header className={styles.top}>
        <Link href="/" className={styles.brand} aria-label="Vouch home">
          <BrandMark />
          <span className={styles.brandWord}>Vouch</span>
        </Link>
        <nav id="app-nav-links" className={open ? `${styles.nav} ${styles.navOpen}` : styles.nav} aria-label="App">
          <Link href="/inbox" className={pathname.startsWith("/inbox") ? styles.active : undefined} data-testid="nav-splits">
            Splits
          </Link>
          <Link href="/groups" className={pathname.startsWith("/groups") ? styles.active : undefined} data-testid="nav-groups">
            Groups
          </Link>
          <Link href="/account" className={pathname.startsWith("/account") ? styles.active : undefined} data-testid="nav-account">
            Account
          </Link>
        </nav>
        <button
          type="button"
          className={styles.menuBtn}
          data-testid="nav-menu"
          aria-expanded={open}
          aria-controls="app-nav-links"
          onClick={() => setOpen((current) => !current)}
        >
          {open ? "Close" : "Menu"}
        </button>
        <Link className={`btn btn-primary ${styles.cta}`} href="/new">
          New receipt
        </Link>
      </header>
      <div className={styles.main}>
        {showTitle ? (
          <div className={styles.titleRow}>
            {title ? <h1>{title}</h1> : <span />}
            <div className={styles.topActions}>{action}</div>
          </div>
        ) : null}
        <div className={styles.body}>{children}</div>
      </div>
    </div>
  );
}
