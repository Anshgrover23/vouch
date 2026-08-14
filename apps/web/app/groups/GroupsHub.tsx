"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { AppShell } from "@/components/AppShell";
import { IconStar } from "@/components/Brand";
import styles from "./groups.module.css";

export type GroupMember = {
  id: string;
  displayName: string;
  status: string;
};

export type GroupRow = {
  id: string;
  name: string;
  starred?: boolean;
  members: GroupMember[];
};

function memberLabel(member: GroupMember) {
  return member.status === "invited" ? `${member.displayName} · waiting` : member.displayName;
}

function peopleLine(members: GroupMember[]) {
  if (members.length === 0) return "Just you for now";
  return members.map(memberLabel).join(", ");
}

function sortGroups(groups: GroupRow[]) {
  return [...groups].sort(
    (a, b) => Number(Boolean(b.starred)) - Number(Boolean(a.starred)) || a.name.localeCompare(b.name),
  );
}

function GroupListItem({ group, onStar }: { group: GroupRow; onStar: (group: GroupRow) => void }) {
  const starred = Boolean(group.starred);
  return (
    <li className={styles.row}>
      <Link href={`/groups/${group.id}`} className={styles.rowLink}>
        <div className={styles.meta}>
          <strong>{group.name}</strong>
          <span>{peopleLine(group.members)}</span>
        </div>
      </Link>
      <button
        type="button"
        className={styles.star}
        data-testid="group-star"
        aria-pressed={starred}
        aria-label={starred ? `Unstar ${group.name}` : `Star ${group.name}`}
        onClick={() => onStar(group)}
      >
        <IconStar />
      </button>
    </li>
  );
}

async function fetchGroups() {
  return fetch("/api/groups", { credentials: "include" });
}

export function CreateGroupForm({
  onCreated,
}: {
  onCreated: (group: { id: string; name: string }) => void;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/groups", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string; group?: { id: string; name: string } };
    if (!res.ok || !json.group) {
      setBusy(false);
      setError(json.error || "Could not create that group.");
      return;
    }
    setName("");
    setBusy(false);
    onCreated(json.group);
  }

  return (
    <form className={styles.create} onSubmit={(e) => void submit(e)}>
      <h2>Start a group</h2>
      <p>Name a household or a trip. You can add people after.</p>
      {error ? <p className={styles.err}>{error}</p> : null}
      <div className={styles.fields}>
        <label>
          <span className="mono">group name</span>
          <input
            data-testid="group-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            placeholder="Household or trip"
            required
          />
        </label>
        <button className="btn btn-primary" type="submit" data-testid="groups-create" disabled={busy || !name.trim()}>
          {busy ? "Creating…" : "Create group"}
        </button>
      </div>
    </form>
  );
}

export function GroupsHome() {
  const router = useRouter();
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load(alive: () => boolean) {
    setLoading(true);
    try {
      const res = await fetchGroups();
      if (!alive()) return;
      if (res.status === 401) {
        window.location.href = `/login?next=${encodeURIComponent("/groups")}`;
        return;
      }
      if (!res.ok) {
        setError("Groups could not load. Try again.");
        return;
      }
      const json = (await res.json()) as { groups?: GroupRow[] };
      if (!alive()) return;
      setGroups(json.groups ?? []);
      setError(null);
    } catch {
      if (!alive()) return;
      setError("Groups could not load. Try again.");
    } finally {
      if (alive()) setLoading(false);
    }
  }

  useEffect(() => {
    let alive = true;
    void load(() => alive);
    return () => {
      alive = false;
    };
  }, []);

  async function toggleStar(group: GroupRow) {
    const next = !group.starred;
    setGroups((curr) => sortGroups(curr.map((row) => (row.id === group.id ? { ...row, starred: next } : row))));
    const res = await fetch(`/api/groups/${group.id}/star`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ starred: next }),
    });
    if (res.ok) return;
    setGroups((curr) =>
      sortGroups(curr.map((row) => (row.id === group.id ? { ...row, starred: Boolean(group.starred) } : row))),
    );
    setError("Could not star that group.");
  }

  return (
    <AppShell title="Your groups">
      {error ? (
        <p className={styles.err}>
          {error}{" "}
          <button
            type="button"
            className={styles.retry}
            onClick={() => {
              setError(null);
              void load(() => true);
            }}
          >
            Try again
          </button>
        </p>
      ) : null}
      {loading && !groups.length && !error ? <p className={styles.pending}>Loading groups…</p> : null}
      {groups.length === 0 && !error && !loading ? (
        <div className={styles.empty}>
          <h2>No groups yet.</h2>
          <p>Skipped this on the way in? Name a house or a trip here. One-off receipts still work without one.</p>
        </div>
      ) : null}
      <CreateGroupForm onCreated={(group) => router.push(`/groups/${group.id}`)} />
      <ul className={styles.list} data-testid="groups-list">
        {groups.map((group) => (
          <GroupListItem key={group.id} group={group} onStar={(row) => void toggleStar(row)} />
        ))}
      </ul>
    </AppShell>
  );
}

