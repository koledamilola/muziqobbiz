"use client";

import { useActionState } from "react";
import { requestMagicLink } from "./actions";
import { initialLoginState } from "./state";

export default function LoginForm() {
  const [state, formAction, pending] = useActionState(
    requestMagicLink,
    initialLoginState,
  );

  return (
    <form action={formAction} className="mt-8 space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-zinc-200">
          Email address
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          disabled={pending}
          className="mt-2 w-full rounded-xl border border-violet-300/25 bg-[#0e1028] px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/20"
          placeholder="you@example.com"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="studio-primary w-full rounded-xl px-4 py-3 font-semibold disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Sending…" : "Email me a sign-in link"}
      </button>
      {state.message ? (
        <p
          role="status"
          className={state.status === "error" ? "text-sm text-red-400" : "text-sm text-emerald-400"}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
