function firstHeaderValue(value) {
  return String(value || "").split(",")[0].trim();
}

function normalizedOrigin(value) {
  try { return new URL(value).origin; }
  catch { return ""; }
}

export function isAllowedRequestOrigin(request, origin, publicAppUrl = "") {
  if (!origin) return true;
  const suppliedOrigin = normalizedOrigin(origin);
  if (!suppliedOrigin) return false;

  const allowed = new Set([normalizedOrigin(request.url), normalizedOrigin(publicAppUrl)].filter(Boolean));
  const headers = request.headers;
  const host = firstHeaderValue(headers.get("x-forwarded-host") || headers.get("host"));
  const protocol = firstHeaderValue(headers.get("x-forwarded-proto")) || new URL(request.url).protocol.slice(0, -1);
  if (host && /^[a-z][a-z\d+.-]*$/i.test(protocol)) {
    const forwardedOrigin = normalizedOrigin(`${protocol}://${host}`);
    if (forwardedOrigin) allowed.add(forwardedOrigin);
  }
  return allowed.has(suppliedOrigin);
}
