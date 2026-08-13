import Stripe from "stripe";
import { eq } from "drizzle-orm";
import { workspaces } from "@proofsheet/db";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { stripeEnabled } from "@/lib/flags";

export async function POST() {
  if (!stripeEnabled()) {
    return Response.json({ error: "Add Stripe test keys to enable checkout" }, { status: 501 });
  }
  try {
    const session = await requireSession();
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    const [ws] = await db().select().from(workspaces).where(eq(workspaces.id, session.workspaceId)).limit(1);
    let customer = ws?.stripeCustomerId;
    if (!customer) {
      const created = await stripe.customers.create({
        email: session.email,
        metadata: { workspaceId: session.workspaceId },
      });
      customer = created.id;
      await db()
        .update(workspaces)
        .set({ stripeCustomerId: customer, updatedAt: new Date() })
        .where(eq(workspaces.id, session.workspaceId));
    }
    const checkout = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer,
      line_items: process.env.STRIPE_PRICE_ID
        ? [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }]
        : undefined,
      success_url: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/usage?checkout=ok`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/usage?checkout=cancel`,
    });
    return Response.json({ url: checkout.url });
  } catch (error) {
    return Response.json({ error: String(error) }, { status: 400 });
  }
}
