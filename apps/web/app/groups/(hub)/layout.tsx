import type { ReactNode } from "react";
import { AppShell } from "@/components/AppShell";

export default function GroupsHubLayout({ children }: { children: ReactNode }) {
  return <AppShell title="Your groups">{children}</AppShell>;
}
