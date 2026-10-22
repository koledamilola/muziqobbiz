import { NextResponse } from "next/server";
import { requireOwner, OwnerAuthError } from "@/lib/supabase/owner";
import { createClient } from "@/lib/supabase/server";
import { parseTakeInput } from "@/lib/tracks/take-input";
import { saveTake } from "@/lib/tracks/save-take";

export async function POST(request: Request) {
  try {
    const user = await requireOwner();
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
    if (!request.headers.get("content-type")?.includes("application/json")) return NextResponse.json({ error: "Expected take details." }, { status: 415 });
    const text = await request.text();
    if (text.length > 16000) return NextResponse.json({ error: "Take details are too large." }, { status: 413 });
    let body;
    try { body = JSON.parse(text); } catch { return NextResponse.json({ error: "Invalid take details." }, { status: 400 }); }
    const input = parseTakeInput(body?.take);
    if (!input || !["prepare", "finalize"].includes(body?.action)) return NextResponse.json({ error: "Check the tempo, key, and vocal file, then retry." }, { status: 400 });
    const result = await saveTake(await createClient(), user.id, input, body.action);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof OwnerAuthError) return NextResponse.json({ error: "Please sign in again before saving. Keep this tab open so your take is not lost." }, { status: 401 });
    // Never return upstream credentials, URLs with tokens, or raw provider errors.
    return NextResponse.json({ error: error instanceof Error && error.message.startsWith("Your vocal is uploaded")
      ? error.message : "Could not finish saving. Keep this tab open and retry." }, { status: 503 });
  }
}
