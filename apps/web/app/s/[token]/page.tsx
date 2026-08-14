import { getSession } from "@/lib/auth";
import { ShareBoard } from "./ShareBoard";

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const session = await getSession();
  return (
    <ShareBoard
      token={token}
      viewer={session ? { displayName: session.displayName } : null}
    />
  );
}
