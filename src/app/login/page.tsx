import { Suspense } from "react";
import LoginForm from "./LoginForm";

export const metadata = { title: "Sign in · muziqobbiz" };

async function LoginNotice({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  if (error === "private") {
    return (
      <p className="mt-6 rounded-lg border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">
        This is a private app.
      </p>
    );
  }

  if (error === "link") {
    return (
      <p className="mt-6 rounded-lg border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">
        That sign-in link is invalid or expired. Request a new one.
      </p>
    );
  }

  return null;
}

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {

  return (
    <section className="mx-auto max-w-md py-8 md:py-16">
      <div className="studio-card rounded-2xl p-6 sm:p-8">
        <p className="text-xs font-semibold tracking-[0.22em] text-cyan-200 uppercase">Private studio</p>
        <h1 className="studio-title mt-3 text-3xl font-bold tracking-tight">Welcome back.</h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          Enter your owner email address. We&apos;ll send you a one-time sign-in link.
        </p>
        <Suspense fallback={null}>
          <LoginNotice searchParams={searchParams} />
        </Suspense>
        <LoginForm />
      </div>
    </section>
  );
}
