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
      <p className="text-sm font-medium text-violet-400">Private studio</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Sign in</h1>
      <p className="mt-3 text-zinc-400">
        Enter the owner email address. Supabase will send a one-time sign-in link.
      </p>
      <Suspense fallback={null}>
        <LoginNotice searchParams={searchParams} />
      </Suspense>
      <LoginForm />
    </section>
  );
}
