import { NextResponse } from "next/server";
import {
  attachSessionCookie,
  authenticateUser,
  createSession,
  extractRequestMetadata
} from "@/lib/auth";

export async function POST(request: Request) {
  const formData = await request.formData();
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");

  try {
    const user = await authenticateUser(email, password);
    const token = await createSession(user.id, extractRequestMetadata(request));
    const response = NextResponse.redirect(new URL("/dashboard", request.url), { status: 303 });
    return attachSessionCookie(response, token);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Login failed.";
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(message)}`, request.url),
      { status: 303 }
    );
  }
}
