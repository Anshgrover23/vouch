import type { ReactNode } from "react";
import { getSession } from "@/lib/auth";
import { GroupChrome, GroupProvider } from "./Group";

export default async function GroupLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  return (
    <GroupProvider groupId={id}>
      <GroupChrome accountName={session?.displayName || "Account"}>{children}</GroupChrome>
    </GroupProvider>
  );
}
