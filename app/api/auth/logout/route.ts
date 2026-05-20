import { NextResponse } from "next/server";
import { clearSessionCookie, destroySession } from "@/lib/auth";

export async function POST(request: Request) {
  const sessionToken = request.headers.get("cookie")?.match(/apr_session=([^;]+)/)?.[1];

  if (sessionToken) {
    await destroySession(sessionToken);
  }

  const response = NextResponse.redirect(
    new URL("/login?message=You%20have%20been%20logged%20out.", request.url),
    { status: 303 }
  );
  return clearSessionCookie(response);
}
