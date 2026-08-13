export function providerMode(): "live" | "fixture" {
  if (process.env.PROOFSHEET_FIXTURE === "1") return "fixture";
  return process.env.INTERFAZE_API_KEY?.trim() ? "live" : "fixture";
}
