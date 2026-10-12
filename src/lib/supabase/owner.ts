import "server-only";

import type { User } from "@supabase/supabase-js";
import { createClient } from "./server";

export class OwnerAuthError extends Error {
  readonly status = 401;

  constructor() {
    super("Unauthorized");
    this.name = "OwnerAuthError";
  }
}

export async function requireOwner(): Promise<User> {
  const allowedEmail = process.env.ALLOWED_EMAIL?.trim().toLowerCase();

  if (!allowedEmail) {
    throw new Error("ALLOWED_EMAIL is not configured.");
  }

  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user?.email || user.email.toLowerCase() !== allowedEmail) {
    throw new OwnerAuthError();
  }

  return user;
}
