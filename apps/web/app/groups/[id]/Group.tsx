"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, use, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { BrandMark } from "@/components/Brand";
import { activityCopy } from "@/lib/activity-copy";
import { formatMoney, parseDisplayName } from "@/lib/split";
import { moneyLabel, nameKey } from "@/lib/ledger";
import styles from "../groups.module.css";

export type GroupMember = {
  id: string;
  displayName: string;
  status: string;
};

export type GroupReceipt = {
  id: string;
  merchant: string;
  date: string;
  total: string;
  paidByName: string;
  people: number;
};

export type GroupBalance = { name: string; net: number };
export type GroupSuggested = { from: string; to: string; amount: number };
export type GroupTotals = { groupSpending: number; youPaid: number; yourShare: number };
export type GroupActivity = {
  id: string;
  actorName: string;
  action: string;
  detail: Record<string, unknown> | null;
  createdAt: string;
};

type GroupState = {
  groupId: string;
  name: string;
  information: string;
  members: GroupMember[];
  receipts: GroupReceipt[];
  balances: GroupBalance[];
  suggested: GroupSuggested[];
  totals: GroupTotals;
  activity: GroupActivity[];
  loading: boolean;
  error: string | null;
};

type GroupActions = {
  reload: () => Promise<void>;
  settle: (row: GroupSuggested) => Promise<void>;
  saveSettings: (name: string, information: string) => Promise<void>;
  addMember: (displayName: string) => Promise<void>;
};

type GroupContextValue = {
  state: GroupState;
  actions: GroupActions;
};

const GroupContext = createContext<GroupContextValue | null>(null);

function useGroup() {
  const ctx = use(GroupContext);
  if (!ctx) throw new Error("Group parts must render inside GroupProvider");
  return ctx;
}

function emptyTotals(): GroupTotals {
  return { groupSpending: 0, youPaid: 0, yourShare: 0 };
}

export function GroupProvider({ groupId, children }: { groupId: string; children: ReactNode }) {
  const [name, setName] = useState("Group");
  const [information, setInformation] = useState("");
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [receipts, setReceipts] = useState<GroupReceipt[]>([]);
  const [balances, setBalances] = useState<GroupBalance[]>([]);
  const [suggested, setSuggested] = useState<GroupSuggested[]>([]);
  const [totals, setTotals] = useState<GroupTotals>(emptyTotals);
  const [activity, setActivity] = useState<GroupActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    setLoading(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/ledger`, { credentials: "include" });
      if (res.status === 401) {
        window.location.href = `/login?next=${encodeURIComponent(`/groups/${groupId}`)}`;
        return;
      }
      if (!res.ok) {
        setError("This group could not load. Try again.");
        return;
      }
      const json = (await res.json()) as {
        group?: { name?: string; information?: string };
        members?: GroupMember[];
        receipts?: GroupReceipt[];
        balances?: GroupBalance[];
        suggested?: GroupSuggested[];
        totals?: GroupTotals;
        activity?: GroupActivity[];
      };
      setName(json.group?.name || "Group");
      setInformation(json.group?.information ?? "");
      setMembers(json.members ?? []);
      setReceipts(json.receipts ?? []);
      setBalances(json.balances ?? []);
      setSuggested(json.suggested ?? []);
      setTotals(json.totals ?? emptyTotals());
      setActivity(json.activity ?? []);
      setError(null);
    } catch {
      setError("This group could not load. Try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, [groupId]);

  async function settle(row: GroupSuggested) {
    const res = await fetch(`/api/groups/${groupId}/settlements`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ from: row.from, to: row.to, amount: row.amount }),
    });
    if (!res.ok) {
      setError("Could not mark that settled.");
      return;
    }
    await reload();
  }

  async function saveSettings(nextName: string, nextInformation: string) {
    const res = await fetch(`/api/groups/${groupId}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: nextName, information: nextInformation }),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string; group?: { name?: string; information?: string } };
    if (!res.ok) {
      setError(json.error || "Could not save the group.");
      return;
    }
    setName(json.group?.name || nextName);
    setInformation(json.group?.information ?? nextInformation);
    setError(null);
    await reload();
  }

  async function addMember(displayName: string) {
    const parsed = parseDisplayName(displayName);
    if (!parsed) {
      setError("Use a name between 1 and 48 characters.");
      return;
    }
    const res = await fetch(`/api/groups/${groupId}/members`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ displayName: parsed }),
    });
    if (!res.ok) {
      setError("Could not add that friend.");
      return;
    }
    await reload();
  }

  const state: GroupState = {
    groupId,
    name,
    information,
    members,
    receipts,
    balances,
    suggested,
    totals,
    activity,
    loading,
    error,
  };

  return (
    <GroupContext value={{ state, actions: { reload, settle, saveSettings, addMember } }}>
      {children}
    </GroupContext>
  );
}

const TABS = [
  { id: "receipts", label: "Receipts", suffix: "" },
  { id: "balances", label: "Balances", suffix: "/balances" },
  { id: "totals", label: "Totals", suffix: "/totals" },
  { id: "activity", label: "Activity", suffix: "/activity" },
  { id: "settings", label: "Settings", suffix: "/settings" },
] as const;

function GroupShellFrame({ children }: { children: ReactNode }) {
  return <div className={styles.frame}>{children}</div>;
}

function GroupShellTop({ children }: { children: ReactNode }) {
  return <header className={styles.shellTop}>{children}</header>;
}

function GroupShellTitle({ children }: { children: ReactNode }) {
  return <div className={styles.shellHead}>{children}</div>;
}

function GroupShellTabs() {
  const pathname = usePathname();
  const {
    state: { groupId },
  } = useGroup();
  return (
    <div className={styles.tabsWrap}>
      <nav className={styles.tabs} data-testid="group-tabs">
        {TABS.map((tab) => {
          const href = `/groups/${groupId}${tab.suffix}`;
          const active = tab.suffix === "" ? pathname === href : Boolean(pathname?.startsWith(href));
          return (
            <Link
              key={tab.id}
              href={href}
              className={active ? `${styles.tab} ${styles.tabActive}` : styles.tab}
              data-testid={`group-tab-${tab.id}`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function GroupShellBody({ children }: { children: ReactNode }) {
  return <div className={styles.shellBody}>{children}</div>;
}

export const GroupShell = {
  Frame: GroupShellFrame,
  Top: GroupShellTop,
  Title: GroupShellTitle,
  Tabs: GroupShellTabs,
  Body: GroupShellBody,
};

export function GroupChrome({ children }: { children: ReactNode }) {
  const {
    state: { groupId, name, error, loading },
  } = useGroup();
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = `${window.location.origin}/groups/${groupId}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <GroupShell.Frame>
      <div className={styles.chrome}>
        <GroupShell.Top>
          <Link href="/" className={styles.brand} aria-label="Vouch home">
            <BrandMark />
            <span className={styles.brandWord}>Vouch</span>
          </Link>
          <Link href="/groups" className={styles.back} data-testid="group-back">
            ← Groups
          </Link>
          <div className={styles.shellActions}>
            <Link href="/account" className={styles.accountChip} data-testid="nav-account">
              Account
            </Link>
            <Link className="btn btn-primary" href={`/new?group=${groupId}`} data-testid="group-new-receipt">
              New receipt
            </Link>
          </div>
        </GroupShell.Top>
        <GroupShell.Title>
          <div className={styles.shellTitleRow}>
            <h1>{name}</h1>
            <button className={styles.shareChip} type="button" data-testid="group-share" onClick={() => void share()}>
              {copied ? "Copied" : "Share"}
            </button>
          </div>
          <GroupShell.Tabs />
        </GroupShell.Title>
      </div>
      <GroupShell.Body>
        {error ? <p className={styles.err}>{error}</p> : null}
        {loading ? <p className={styles.pending}>Loading group…</p> : null}
        {children}
      </GroupShell.Body>
    </GroupShell.Frame>
  );
}

function peopleLine(members: GroupMember[]) {
  if (members.length === 0) return "Just you for now";
  return members
    .map((member) => (member.status === "invited" ? `${member.displayName} · waiting` : member.displayName))
    .join(", ");
}

export function GroupReceipts() {
  const {
    state: { receipts, members },
  } = useGroup();
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const visible = needle
    ? receipts.filter((row) => `${row.merchant} ${row.paidByName}`.toLowerCase().includes(needle))
    : receipts;

  return (
    <section className={styles.panel} data-testid="group-receipts">
      <p className={styles.stubs} data-testid="group-people">
        {peopleLine(members)}
      </p>
      <label className={styles.search}>
        <span className="mono">search</span>
        <input
          data-testid="receipts-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Merchant or who paid"
        />
      </label>
      {visible.length === 0 ? (
        <p className={styles.emptyCopy}>No receipts in this group yet. Snap or type one.</p>
      ) : (
        <ul className={styles.list} data-testid="receipts-list">
          {visible.map((row) => (
            <li key={row.id}>
              <Link href={`/review/${row.id}`} className={styles.card}>
                <div className={styles.meta}>
                  <strong>{row.merchant}</strong>
                  <span>
                    {row.date} · paid by {row.paidByName || "—"}
                    {row.people > 0 ? ` · ${row.people} vouched` : ""}
                  </span>
                </div>
                <span className={styles.amount}>{row.total}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function GroupBalances() {
  const {
    state: { balances, suggested },
    actions: { settle },
  } = useGroup();
  const max = Math.max(...balances.map((row) => Math.abs(row.net)), 0.01);

  return (
    <section className={styles.panel} data-testid="group-balances">
      {balances.length === 0 ? (
        <p className={styles.emptyCopy}>Nobody owes anybody yet. Claim lines on a receipt first.</p>
      ) : (
        <ul className={styles.balances} data-testid="balances-list">
          {balances.map((row) => (
            <li key={row.name} data-testid={`balance-${nameKey(row.name)}`}>
              <span>{row.name}</span>
              <div className={styles.barTrack}>
                <div
                  className={row.net >= 0 ? styles.barPos : styles.barNeg}
                  style={{ width: `${(Math.abs(row.net) / max) * 100}%` }}
                />
              </div>
              <strong data-testid={`balance-net-${nameKey(row.name)}`}>{moneyLabel(row.net)}</strong>
            </li>
          ))}
        </ul>
      )}
      <h2>Suggested</h2>
      {suggested.length === 0 ? (
        <p className={styles.emptyCopy} data-testid="suggested-empty">
          Nothing to settle.
        </p>
      ) : (
        <ul className={styles.suggested} data-testid="suggested-list">
          {suggested.map((row) => (
            <li key={`${row.from}-${row.to}`} data-testid={`suggested-${nameKey(row.from)}-${nameKey(row.to)}`}>
              <span>
                {row.from} → {row.to}{" "}
                <strong>{formatMoney(row.amount)}</strong>
              </span>
              <button
                className="btn"
                type="button"
                data-testid="mark-settled"
                onClick={() => void settle(row)}
              >
                Mark settled
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className={styles.hint}>Recorded in Vouch. This is not a bank transfer.</p>
    </section>
  );
}

export function GroupTotals() {
  const {
    state: { totals },
  } = useGroup();
  return (
    <section className={styles.panel} data-testid="group-totals">
      <dl className={styles.totals}>
        <div>
          <dt>Group spending</dt>
          <dd data-testid="totals-spending">{formatMoney(totals.groupSpending)}</dd>
        </div>
        <div>
          <dt>You paid</dt>
          <dd data-testid="totals-you-paid">{formatMoney(totals.youPaid)}</dd>
        </div>
        <div>
          <dt>Your share</dt>
          <dd data-testid="totals-your-share">{formatMoney(totals.yourShare)}</dd>
        </div>
      </dl>
      <p className={styles.hint}>Group spending excludes settlements.</p>
    </section>
  );
}

export function GroupActivity() {
  const {
    state: { activity },
  } = useGroup();
  return (
    <section className={styles.panel} data-testid="group-activity">
      {activity.length === 0 ? (
        <p className={styles.emptyCopy}>No activity yet.</p>
      ) : (
        <ol className={styles.activity} data-testid="activity-list">
          {activity.map((row) => (
            <li key={row.id}>
              <strong>{activityCopy(row)}</strong>
              <span suppressHydrationWarning>{new Date(row.createdAt).toLocaleString()}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function GroupSettings() {
  const {
    state: { groupId, name, information, members },
    actions: { saveSettings, addMember },
  } = useGroup();
  const [draftName, setDraftName] = useState(name);
  const [notes, setNotes] = useState(information);
  const [friend, setFriend] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setDraftName(name);
    setNotes(information);
  }, [name, information]);

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    await saveSettings(draftName, notes);
    setBusy(false);
  }

  async function add(e: FormEvent) {
    e.preventDefault();
    await addMember(friend);
    setFriend("");
  }

  return (
    <section className={styles.panel} data-testid="group-settings">
      <form className={styles.members} onSubmit={(e) => void save(e)}>
        <h2>Group</h2>
        <label>
          <span className="mono">name</span>
          <input data-testid="settings-name" value={draftName} onChange={(e) => setDraftName(e.target.value)} maxLength={80} />
        </label>
        <label>
          <span className="mono">notes</span>
          <textarea
            data-testid="settings-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={2000}
            rows={4}
          />
        </label>
        <div className={styles.settingsRow}>
          <button className="btn btn-primary" type="submit" data-testid="settings-save" disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </button>
          <a className="btn" href={`/api/groups/${groupId}/export`} data-testid="group-export">
            Download CSV
          </a>
        </div>
      </form>
      <div className={styles.members}>
        <h2>People</h2>
        <p>Add a name now. They can claim on a receipt before they sign up.</p>
        {members.length > 0 ? (
          <ul className={styles.people}>
            {members.map((member) => (
              <li key={member.id}>
                <strong>{member.displayName}</strong>
                <span>{member.status === "invited" ? "waiting" : "joined"}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p>No people on this group yet.</p>
        )}
        <form className={styles.fields} onSubmit={(e) => void add(e)}>
          <label>
            <span className="mono">friend</span>
            <input
              data-testid="group-add-member"
              value={friend}
              onChange={(e) => setFriend(e.target.value)}
              maxLength={48}
              placeholder="Riley"
            />
          </label>
          <button className="btn" type="submit" disabled={!friend.trim()}>
            Add
          </button>
        </form>
      </div>
    </section>
  );
}
