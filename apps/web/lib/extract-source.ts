import { access, readFile } from "node:fs/promises";
import { join } from "node:path";

export async function interfazeImageSource(sourceUrl: string, mimeType: string | null) {
  if (sourceUrl.startsWith("https://")) return sourceUrl;
  if (sourceUrl.startsWith("data:")) return sourceUrl;
  const filePath = await findPublicFile(sourceUrl);
  if (!filePath) return sourceUrl;
  const buf = await readFile(filePath);
  const mime = mimeType || (sourceUrl.endsWith(".png") ? "image/png" : "image/jpeg");
  return `data:${mime};base64,${buf.toString("base64")}`;
}

async function findPublicFile(sourceUrl: string) {
  let pathname = sourceUrl;
  try {
    pathname = new URL(sourceUrl, "http://local.invalid").pathname;
  } catch {
    pathname = sourceUrl;
  }
  if (!pathname.startsWith("/samples/") && !pathname.startsWith("/uploads/")) return null;
  const rel = pathname.replace(/^\//, "");
  const bases = [
    join(process.cwd(), "public"),
    join(process.cwd(), "apps/web/public"),
    join(process.cwd(), "../web/public"),
  ];
  for (const base of bases) {
    const full = join(base, rel);
    try {
      await access(full);
      return full;
    } catch {
      // try next
    }
  }
  return null;
}
