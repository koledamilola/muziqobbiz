import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getPublicSupabaseEnv } from "./env";

const PUBLIC_PATHS = new Set(["/login", "/auth/callback"]);

function redirectWithCookies(
  request: NextRequest,
  response: NextResponse,
  pathname: string,
  searchParams?: Record<string, string>,
) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";

  Object.entries(searchParams ?? {}).forEach(([key, value]) =>
    url.searchParams.set(key, value),
  );

  const redirectResponse = NextResponse.redirect(url);
  response.cookies.getAll().forEach((cookie) =>
    redirectResponse.cookies.set(cookie),
  );

  return redirectResponse;
}

function unauthorizedApi(response: NextResponse) {
  const denied = NextResponse.json({ error: "Please sign in again before saving. Keep this tab open so your take is not lost." }, { status: 401 });
  response.cookies.getAll().forEach((cookie) => denied.cookies.set(cookie));
  return denied;
}

// Docs: https://supabase.com/docs/guides/auth/server-side/creating-a-client
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, key } = getPublicSupabaseEnv();

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const pathname = request.nextUrl.pathname;
  const isPublicPath = PUBLIC_PATHS.has(pathname);

  if (error || !claims) {
    if (isPublicPath) return response;
    if (pathname.startsWith("/api/")) return unauthorizedApi(response);

    return redirectWithCookies(request, response, "/login", {
      next: pathname,
    });
  }

  const allowedEmail = process.env.ALLOWED_EMAIL?.trim().toLowerCase();
  const email = typeof claims.email === "string" ? claims.email.toLowerCase() : "";

  if (!allowedEmail || email !== allowedEmail) {
    await supabase.auth.signOut();
    if (pathname.startsWith("/api/")) return unauthorizedApi(response);
    return redirectWithCookies(request, response, "/login", {
      error: "private",
    });
  }

  if (pathname === "/login") {
    return redirectWithCookies(request, response, "/muziqobbiz");
  }

  return response;
}
