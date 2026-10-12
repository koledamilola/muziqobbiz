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
          className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-3 text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-violet-500"
          placeholder="you@example.com"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-violet-500 px-4 py-3 font-medium text-white hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-60"
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
