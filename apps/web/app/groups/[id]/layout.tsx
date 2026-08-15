import type { ReactNode } from "react";
import { GroupChrome, GroupProvider } from "./Group";

export default async function GroupLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <GroupProvider groupId={id}>
      <GroupChrome>{children}</GroupChrome>
    </GroupProvider>
  );
}
