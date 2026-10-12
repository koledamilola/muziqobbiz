"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "./nav-items";

// Bottom bar on phones, side bar on desktop (md and up).
export default function Nav() {
  const pathname = usePathname();

  if (pathname === "/login") return null;

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-10 border-t border-zinc-800 bg-zinc-950 md:static md:w-52 md:shrink-0 md:border-t-0 md:border-r"
    >
      <ul className="flex md:flex-col md:gap-1 md:p-3">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <li key={item.href} className="flex-1 md:flex-none">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs md:min-h-11 md:flex-row md:justify-start md:gap-3 md:rounded-lg md:px-3 md:text-sm ${
                  active
                    ? "text-violet-400 md:bg-zinc-900"
                    : "text-zinc-400 hover:text-zinc-100 md:hover:bg-zinc-900"
                }`}
              >
                <span aria-hidden className="text-lg md:text-base">
                  {item.icon}
                </span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
