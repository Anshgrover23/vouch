"use client";

import { createContext, use, useMemo, useState, type FormEvent, type ReactNode } from "react";
import styles from "./invite-sheet.module.css";

type InviteState = {
  copied: boolean;
  adding: boolean;
};

type InviteActions = {
  copy: () => Promise<void>;
  dismiss: () => void;
  addFriend: (name: string) => Promise<void>;
};

type InviteMeta = {
  shareUrl: string;
  message: string;
};

type InviteContextValue = {
  state: InviteState;
  actions: InviteActions;
  meta: InviteMeta;
};

const InviteContext = createContext<InviteContextValue | null>(null);

function useInvite() {
  const ctx = use(InviteContext);
  if (!ctx) throw new Error("Invite parts must render inside Invite.Root");
  return ctx;
}

function Root({
  shareUrl,
  onDismiss,
  onAddFriend,
  children,
}: {
  shareUrl: string;
  onDismiss: () => void;
  onAddFriend: (name: string) => Promise<void>;
  children: ReactNode;
}) {
  const [copied, setCopied] = useState(false);
  const [adding, setAdding] = useState(false);
  const message = `You're on this split. Tap what you owe: ${shareUrl}`;

  const value = useMemo<InviteContextValue>(
    () => ({
      state: { copied, adding },
      actions: {
        copy: async () => {
          await navigator.clipboard.writeText(shareUrl);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1600);
        },
        dismiss: onDismiss,
        addFriend: async (name) => {
          setAdding(true);
          try {
            await onAddFriend(name);
          } finally {
            setAdding(false);
          }
        },
      },
      meta: { shareUrl, message },
    }),
    [copied, adding, shareUrl, message, onDismiss, onAddFriend],
  );

  return <InviteContext value={value}>{children}</InviteContext>;
}

function Frame({ children }: { children: ReactNode }) {
  const {
    actions: { dismiss },
  } = useInvite();
  return (
    <div
      className={styles.overlay}
      data-testid="invite-sheet"
      onClick={dismiss}
      onKeyDown={(e) => {
        if (e.key === "Escape") dismiss();
      }}
    >
      <div
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby="invite-title"
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
      <h2 id="invite-title">Invite your friend</h2>
    </>
  );
}

function Lede() {
  return (
    <p className={styles.lede}>
      Send the join link. Your friend needs to create an account before they can accept. Adding a name here only holds
      their seat — it does not tap I owe this for them.
    </p>
  );
}

function WhatsApp() {
  const {
    meta: { message },
    state: { adding },
  } = useInvite();
  return (
    <a
      className="btn btn-lime"
      data-testid="invite-whatsapp"
      href={`https://wa.me/?text=${encodeURIComponent(message)}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-disabled={adding}
    >
      WhatsApp
    </a>
  );
}

function CopyLink() {
  const {
    state: { copied },
    actions: { copy },
    meta: { shareUrl },
  } = useInvite();
  return (
    <button className="btn btn-primary" type="button" data-testid="invite-copy" disabled={!shareUrl} onClick={() => void copy()}>
      {copied ? "Copied" : "Copy join link"}
    </button>
  );
}

function Dismiss() {
  const {
    actions: { dismiss },
  } = useInvite();
  return (
    <button className="btn" type="button" data-testid="invite-dismiss" onClick={dismiss}>
      Skip for now
    </button>
  );
}

function Friend() {
  const {
    state: { adding },
    actions: { addFriend },
  } = useInvite();
  const [name, setName] = useState("");

  return (
    <form
      className={styles.friend}
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        void addFriend(name).then(() => setName(""));
      }}
    >
      <label>
        <span className="mono">friend</span>
        <input
          data-testid="invite-friend-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={48}
          placeholder="Riley"
        />
      </label>
      <button className="btn" type="submit" data-testid="invite-friend-add" disabled={adding || !name.trim()}>
        {adding ? "Adding…" : "Add friend"}
      </button>
    </form>
  );
}

function Actions({ children }: { children: ReactNode }) {
  return <div className={styles.actions}>{children}</div>;
}

export const Invite = {
  Root,
  Frame,
  Title,
  Lede,
  WhatsApp,
  CopyLink,
  Dismiss,
  Friend,
  Actions,
};
