import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

function safeNextPath(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//")
    ? value
    : "/muziqobbiz";
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const allowedEmail = process.env.ALLOWED_EMAIL?.trim().toLowerCase();

      if (allowedEmail && user?.email?.toLowerCase() === allowedEmail) {
        return NextResponse.redirect(new URL(next, request.url));
      }

      await supabase.auth.signOut();
      return NextResponse.redirect(new URL("/login?error=private", request.url));
    }
  }

  return NextResponse.redirect(new URL("/login?error=link", request.url));
}
