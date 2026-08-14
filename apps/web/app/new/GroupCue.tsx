"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import styles from "./new.module.css";

export function GroupCue() {
  const [groupId, setGroupId] = useState<string | null>(null);
  const [name, setName] = useState("");

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("group");
    if (!id) return;
    setGroupId(id);
    void fetch(`/api/groups/${id}`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((json: { group?: { name?: string } } | null) => {
        setName(json?.group?.name?.trim() || "Group");
      })
      .catch(() => setName("Group"));
  }, []);

  if (!groupId) return null;
  const label = name || "Group";
  return (
    <p className={styles.groupCue} data-testid="new-group-context">
      <Link href={`/groups/${groupId}`} data-testid="new-back-group">
        ← {label}
      </Link>
      <span>This receipt lands in {label}.</span>
    </p>
  );
}
