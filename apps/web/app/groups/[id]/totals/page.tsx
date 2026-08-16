import { redirect } from "next/navigation";

export default async function GroupTotalsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/groups/${id}/analytics`);
}
