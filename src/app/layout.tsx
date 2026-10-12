import type { Metadata, Viewport } from "next";
import "./globals.css";
import Nav from "@/components/Nav";
import SignOutButton from "@/components/SignOutButton";

export const metadata: Metadata = {
  title: "muziqobbiz",
  description: "Your personal AI music producer.",
};

export const viewport: Viewport = {
  themeColor: "#09090b",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-800 bg-zinc-950/90 px-4 py-3 backdrop-blur">
          <span className="text-lg font-semibold tracking-tight">muziqobbiz</span>
          <SignOutButton />
        </header>
        <div className="flex flex-1 flex-col md:flex-row">
          <Nav />
          {/* bottom padding keeps content clear of the mobile nav bar */}
          <main className="flex-1 p-4 pb-24 md:order-last md:p-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
