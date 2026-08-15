import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { listWorkspaceSplits } from "@/lib/splits-list";
import { SplitsHome } from "./InboxHome";

export default async function InboxPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/inbox");
  const documents = await listWorkspaceSplits(db(), session.workspaceId);
  return (
    <SplitsHome
      initialDocs={documents.map((doc) => ({
        id: doc.id,
        status: doc.status,
        createdAt: doc.createdAt.toISOString(),
        error: doc.error,
        merchant: doc.merchant,
        date: doc.date,
        total: doc.total,
        people: doc.people,
      }))}
    />
  );
}
