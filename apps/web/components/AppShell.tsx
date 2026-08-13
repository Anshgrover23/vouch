"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode } from "react";
import { BrandMark } from "./Brand";
import styles from "./app-shell.module.css";

export function AppShell({
  children,
  title,
  action,
}: {
  children: ReactNode;
  title: string;
  action?: ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className={styles.frame}>
      <header className={styles.top}>
        <Link href="/" className={styles.brand}>
          <BrandMark />
          Vouch
        </Link>
        <nav className={styles.nav}>
          <Link href="/inbox" className={pathname.startsWith("/inbox") || pathname.startsWith("/review") ? styles.active : undefined}>
            Queue
          </Link>
        </nav>
        <Link className="btn btn-primary" href="/new">
          New receipt
        </Link>
      </header>
      <div className={styles.main}>
        <div className={styles.titleRow}>
          <h1>{title}</h1>
          <div className={styles.topActions}>{action}</div>
        </div>
        <div className={styles.body}>{children}</div>
      </div>
    </div>
  );
}
