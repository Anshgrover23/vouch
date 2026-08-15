import type { ReactNode } from "react";
import { AppShell } from "@/components/AppShell";

export default function InboxLayout({ children }: { children: ReactNode }) {
  return <AppShell title="Your splits">{children}</AppShell>;
}
