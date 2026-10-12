"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import type { LoginState } from "./state";

function requestOrigin(requestHeaders: Headers) {
  const origin = requestHeaders.get("origin");
  if (origin) return origin;

  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "http";

  if (!host) throw new Error("Could not determine the application URL.");
  return `${protocol}://${host}`;
}

export async function requestMagicLink(
  _previousState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const emailValue = formData.get("email");
  const email = typeof emailValue === "string" ? emailValue.trim().toLowerCase() : "";
  const allowedEmail = process.env.ALLOWED_EMAIL?.trim().toLowerCase();

  if (!email || !allowedEmail || email !== allowedEmail) {
    return { status: "error", message: "This is a private app." };
  }

  try {
    const requestHeaders = await headers();
    const callbackUrl = new URL("/auth/callback", requestOrigin(requestHeaders));
    callbackUrl.searchParams.set("next", "/muziqobbiz");

    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: callbackUrl.toString(),
        shouldCreateUser: true,
      },
    });

    if (error) {
      return {
        status: "error",
        message: "We could not send the sign-in link. Please try again.",
      };
    }

    return {
      status: "success",
      message: "Check your email for a secure sign-in link.",
    };
  } catch {
    return {
      status: "error",
      message: "Login is not configured yet. Check the environment variables.",
    };
  }
}
