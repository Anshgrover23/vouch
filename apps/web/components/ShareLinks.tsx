"use client";

import { createContext, use, useMemo, useState, type ReactNode } from "react";
import { personSlug } from "@/lib/split";
import { seatInviteMessage, withSeatQuery } from "@/lib/seat";
import styles from "./invite-sheet.module.css";

export type ShareSeat = {
  displayName: string;
  inviteToken: string;
  status?: string;
};

type ShareLinksState = {
  copied: string | null;
};

type ShareLinksActions = {
  copy: (url: string, key: string) => Promise<void>;
  dismiss: () => void;
};

type ShareLinksMeta = {
  shareUrl: string;
  seats: ShareSeat[];
};

type ShareLinksContextValue = {
  state: ShareLinksState;
  actions: ShareLinksActions;
  meta: ShareLinksMeta;
};

const ShareLinksContext = createContext<ShareLinksContextValue | null>(null);

function useShareLinks() {
  const ctx = use(ShareLinksContext);
  if (!ctx) throw new Error("Share link parts must render inside ShareLinks.Root");
  return ctx;
}

function Root({
  shareUrl,
  seats,
  onDismiss,
  children,
}: {
  shareUrl: string;
  seats: ShareSeat[];
  onDismiss: () => void;
  children: ReactNode;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const value = useMemo<ShareLinksContextValue>(
    () => ({
      state: { copied },
      actions: {
        copy: async (url, key) => {
          await navigator.clipboard.writeText(url);
          setCopied(key);
          window.setTimeout(() => setCopied(null), 1600);
        },
        dismiss: onDismiss,
      },
      meta: { shareUrl, seats },
    }),
    [copied, shareUrl, seats, onDismiss],
  );
  return <ShareLinksContext value={value}>{children}</ShareLinksContext>;
}

function Frame({ children }: { children: ReactNode }) {
  const {
    actions: { dismiss },
  } = useShareLinks();
  return (
    <div
      className={styles.overlay}
      data-testid="share-picker"
      onClick={dismiss}
      onKeyDown={(e) => {
        if (e.key === "Escape") dismiss();
      }}
    >
      <div
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-picker-title"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function Title() {
  return (
    <>
      <p className="mono">share this split</p>
      <h2 id="share-picker-title">Send each person their link</h2>
    </>
  );
}

function Lede() {
  return (
    <p className={styles.lede}>
      Each friend gets a link that opens the bill as them. The view-only link is for looking — a new person can still
      join as themselves.
    </p>
  );
}

function SeatActions({
  url,
  name,
  testId,
}: {
  url: string;
  name: string;
  testId: string;
}) {
  const {
    state: { copied },
    actions: { copy },
  } = useShareLinks();
  const message = seatInviteMessage(url, name === "view" ? null : name);
  const copyKey = testId;
  return (
    <div className={styles.seatActions}>
      <a
        className="btn btn-lime"
        data-testid={`${testId}-whatsapp`}
        href={`https://wa.me/?text=${encodeURIComponent(message)}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        WhatsApp
      </a>
      <button className="btn btn-primary" type="button" data-testid={`${testId}-copy`} onClick={() => void copy(url, copyKey)}>
        {copied === copyKey ? "Copied" : "Copy link"}
      </button>
    </div>
  );
}

function ViewOnly() {
  const {
    meta: { shareUrl },
  } = useShareLinks();
  return (
    <div className={styles.seat} data-testid="share-view">
      <p className={styles.seatName}>View-only bill</p>
      <p className={styles.seatMeta}>Anyone can look. A new person joins as themselves, not as someone already on it.</p>
      <SeatActions url={shareUrl} name="view" testId="share-view" />
    </div>
  );
}

function Seats() {
  const {
    meta: { shareUrl, seats },
  } = useShareLinks();
  if (seats.length === 0) {
    return <p className={styles.lede}>Add a friend first, then you get a link that opens as them.</p>;
  }
  return (
    <ul className={styles.seats}>
      {seats.map((seat) => {
        const url = withSeatQuery(shareUrl, seat.inviteToken);
        const slug = personSlug(seat.displayName);
        return (
          <li className={styles.seat} key={seat.inviteToken} data-testid={`share-seat-${slug}`}>
            <p className={styles.seatName}>{seat.displayName}&apos;s link</p>
            <p className={styles.seatMeta}>Opens the bill as {seat.displayName}.</p>
            <SeatActions url={url} name={seat.displayName} testId={`share-seat-${slug}`} />
          </li>
        );
      })}
    </ul>
  );
}

function Dismiss() {
  const {
    actions: { dismiss },
  } = useShareLinks();
  return (
    <button className="btn" type="button" data-testid="share-picker-dismiss" onClick={dismiss}>
      Done
    </button>
  );
}

function Actions({ children }: { children: ReactNode }) {
  return <div className={styles.actions}>{children}</div>;
}

export const ShareLinks = {
  Root,
  Frame,
  Title,
  Lede,
  ViewOnly,
  Seats,
  Dismiss,
  Actions,
};
