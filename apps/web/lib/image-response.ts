function fromDataUrl(url: string) {
  const match = url.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { mime: match[1], body: Buffer.from(match[2], "base64") };
}

export function imageResponse(stored: string | null) {
  if (!stored) return Response.json({ error: "not found" }, { status: 404 });
  const data = fromDataUrl(stored);
  if (data) {
    return new Response(data.body, {
      headers: {
        "content-type": data.mime,
        "cache-control": "private, max-age=86400, immutable",
      },
    });
  }
  if (stored.startsWith("/") && !stored.startsWith("//")) {
    return new Response(null, { status: 302, headers: { Location: stored } });
  }
  return Response.redirect(stored, 302);
}

export function displayImageUrl(stored: string | null | undefined, proxyPath: string) {
  if (!stored) return proxyPath;
  if (stored.startsWith("data:")) return proxyPath;
  if (stored.startsWith("https://") || stored.startsWith("http://")) return stored;
  if (stored.startsWith("/uploads/") || stored.startsWith("/samples/")) return stored;
  return proxyPath;
}
