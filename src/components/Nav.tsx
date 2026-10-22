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
      className="fixed inset-x-0 bottom-0 z-10 border-t border-violet-300/15 bg-[#11102a]/95 shadow-[0_-10px_35px_rgba(0,0,0,.2)] backdrop-blur-xl md:static md:w-52 md:shrink-0 md:border-t-0 md:border-r md:shadow-none"
    >
      <ul className="flex md:flex-col md:gap-1 md:p-3">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          // Fetch the Library afresh, including takes saved since a previous visit.
          const NavigationLink = item.href === "/library" ? "a" : Link;
          return (
            <li key={item.href} className="flex-1 md:flex-none">
              <NavigationLink
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 border-t-2 text-xs transition-colors md:min-h-11 md:flex-row md:justify-start md:gap-3 md:rounded-lg md:border-t-0 md:border-l-2 md:px-3 md:text-sm ${
                  active
                    ? "border-violet-300 bg-violet-400/10 text-violet-200 md:bg-violet-400/15"
                    : "border-transparent text-zinc-400 hover:bg-violet-300/10 hover:text-white"
                }`}
              >
                <span aria-hidden className="text-lg md:text-base">
                  {item.icon}
                </span>
                {item.label}
              </NavigationLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
