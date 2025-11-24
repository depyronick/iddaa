import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export default function proxy(request: NextRequest) {
  const username = process.env.BASIC_AUTH_USER;
  const password = process.env.BASIC_AUTH_PASS;

  // If creds are not configured, skip auth (prevents hard-lock when envs missing).
  if (!username || !password) {
    return NextResponse.next();
  }

  const auth = request.headers.get("authorization");
  const { pathname } = new URL(request.url);

  const allowPrefixes = ["/_next/static", "/_next/image", "/favicon.ico", "/robots.txt", "/sitemap.xml", "/assets/"];
  const allowExtensions = [".png", ".jpg", ".jpeg", ".gif", ".svg", ".css", ".js"];
  if (allowPrefixes.some((prefix) => pathname.startsWith(prefix)) || allowExtensions.some((ext) => pathname.endsWith(ext))) {
    return NextResponse.next();
  }

  if (auth) {
    const [scheme, encoded] = auth.split(" ");
    if (scheme?.toLowerCase() === "basic" && encoded) {
      const credentials = Buffer.from(encoded, "base64").toString("utf8");
      const [user, pass] = credentials.split(":");
      if (user === username && pass === password) {
        return NextResponse.next();
      }
    }
  }

  return new NextResponse("Unauthorized", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Protected"' },
  });
}

export const config = {
  matcher: ["/:path*"],
};
