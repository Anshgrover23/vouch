import { getSession } from "@/lib/auth";
import { ShareBoard } from "./ShareBoard";

export default async function SharePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ as?: string }>;
}) {
  const { token } = await params;
  const { as } = await searchParams;
  const session = await getSession();
  return (
    <ShareBoard
      token={token}
      viewer={session ? { displayName: session.displayName } : null}
      as={as?.trim() || null}
    />
  );
}
