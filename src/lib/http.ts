// A response can be non-JSON (an HTML error page from a platform-level
// timeout/gateway, for example) even when route handlers always return
// NextResponse.json(...) themselves. Calling res.json() directly on that
// produces a confusing raw parse error ("Unexpected token '<'...") instead of
// something a user can act on.
export async function readJsonResponse<T = unknown>(res: Response): Promise<T> {
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new Error(
      `Server returned an unexpected response (status ${res.status}, not JSON) — this usually means a temporary server or network issue. Try refreshing again in a moment.`,
    );
  }
  return res.json();
}
