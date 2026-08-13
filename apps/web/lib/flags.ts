export function providerMode(): "live" | "fixture" {
  if (process.env.PROOFSHEET_FIXTURE === "1") return "fixture";
  return process.env.INTERFAZE_API_KEY?.trim() ? "live" : "fixture";
}

export function stripeEnabled() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function supabaseEnabled() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
