import { NextResponse } from "next/server";
import {
  attachSessionCookie,
  createSession,
  extractRequestMetadata,
  registerUser
} from "@/lib/auth";

export async function POST(request: Request) {
  const formData = await request.formData();
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const companyName = String(formData.get("companyName") || "").trim();
  const password = String(formData.get("password") || "");

  if (!name || !email || !companyName || password.length < 8) {
    return NextResponse.redirect(
      new URL("/signup?error=Please%20fill%20all%20fields%20and%20use%20an%208%20character%20password.", request.url),
      { status: 303 }
    );
  }

  try {
    const user = await registerUser({ name, email, companyName, password });
    const token = await createSession(user.id, extractRequestMetadata(request));
    const response = NextResponse.redirect(new URL("/dashboard", request.url), { status: 303 });
    return attachSessionCookie(response, token);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Signup failed.";
    return NextResponse.redirect(
      new URL(`/signup?error=${encodeURIComponent(message)}`, request.url),
      { status: 303 }
    );
  }
}
