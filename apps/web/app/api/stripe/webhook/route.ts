import Stripe from "stripe";
import { eq } from "drizzle-orm";
import { stripeEvents, workspaces } from "@proofsheet/db";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!secret || !key) {
    return Response.json({ error: "stripe not configured" }, { status: 501 });
  }
  const stripe = new Stripe(key);
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  if (!sig) return Response.json({ error: "missing signature" }, { status: 400 });
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch (error) {
    return Response.json({ error: String(error) }, { status: 400 });
  }

  const existing = await db().select().from(stripeEvents).where(eq(stripeEvents.id, event.id)).limit(1);
  if (existing.length) return Response.json({ ok: true, duplicate: true });

  await db().insert(stripeEvents).values({
    id: event.id,
    type: event.type,
    payload: event as unknown as Record<string, unknown>,
  });

  if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.created") {
    const sub = event.data.object as Stripe.Subscription;
    const customerId = String(sub.customer);
    await db()
      .update(workspaces)
      .set({
        stripeSubscriptionId: sub.id,
        billingStatus: sub.status,
        updatedAt: new Date(),
      })
      .where(eq(workspaces.stripeCustomerId, customerId));
  }

  return Response.json({ ok: true });
}
