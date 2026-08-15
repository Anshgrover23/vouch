import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { listWorkspaceGroups } from "@/lib/groups-list";
import { GroupsHome } from "../GroupsHub";

export default async function GroupsPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/groups");
  const groups = await listWorkspaceGroups(db(), session);
  return (
    <GroupsHome
      initialGroups={groups.map((group) => ({
        id: group.id,
        name: group.name,
        starred: group.starred,
        members: group.members.map((member) => ({
          id: member.id,
          displayName: member.displayName,
          status: member.status,
        })),
      }))}
    />
  );
}
