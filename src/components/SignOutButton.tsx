"use client";

import { usePathname } from "next/navigation";
import { signOut } from "@/app/auth/actions";

export default function SignOutButton() {
  const pathname = usePathname();

  if (pathname === "/login") return null;

  return (
    <form action={signOut}>
      <button
        type="submit"
        className="rounded-md px-3 py-1.5 text-sm text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
      >
        Sign out
      </button>
    </form>
  );
}
