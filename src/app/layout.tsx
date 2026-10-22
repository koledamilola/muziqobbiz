import type { Metadata, Viewport } from "next";
import "./globals.css";
import Nav from "@/components/Nav";
import SignOutButton from "@/components/SignOutButton";

export const metadata: Metadata = {
  title: "muziqobbiz",
  description: "Your personal AI music producer.",
};

export const viewport: Viewport = {
  themeColor: "#0c0920",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-violet-300/15 bg-[#0d0b22]/90 px-4 py-3 shadow-[0_8px_30px_rgba(0,0,0,.15)] backdrop-blur-xl md:px-7">
          <span className="flex items-center gap-2.5 text-lg font-semibold tracking-tight">
            <span aria-hidden className="flex size-8 items-center justify-center rounded-xl bg-gradient-to-br from-violet-400 to-rose-400 text-base text-[#140c2b] shadow-[0_0_22px_rgba(168,85,247,.3)]">♫</span>
            <span className="studio-title">muziqobbiz</span>
          </span>
          <SignOutButton />
        </header>
        <div className="flex flex-1 flex-col md:flex-row">
          <Nav />
          {/* bottom padding keeps content clear of the mobile nav bar */}
          <main className="min-w-0 flex-1 p-4 pb-24 md:order-last md:p-8 lg:p-10">{children}</main>
        </div>
      </body>
    </html>
  );
}
