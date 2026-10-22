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
        className="rounded-lg border border-violet-300/20 px-3 py-1.5 text-sm text-slate-300 transition-colors hover:border-violet-300/45 hover:bg-violet-300/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
      >
        Sign out
      </button>
    </form>
  );
}
