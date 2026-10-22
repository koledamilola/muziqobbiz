"use client";

import { useActionState } from "react";
import { checkDatabase, type DatabaseCheckState } from "./actions";

const initialState: DatabaseCheckState = { status: "idle", message: "" };

export default function DatabaseCheck() {
  const [state, action, pending] = useActionState(checkDatabase, initialState);

  return (
    <div className="studio-panel mt-6 max-w-xl rounded-xl p-5">
      <h2 className="text-lg font-medium">Database connection</h2>
      <p className="mt-2 text-sm text-zinc-400">
        Save and read back a temporary test track and job using your account,
        then remove them. This does not generate music or change your saved tracks.
      </p>
      <form action={action} className="mt-4">
        <button type="submit" disabled={pending}
          className="min-h-11 rounded-md bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-50">
          {pending ? "Checking…" : "Run database check"}
        </button>
      </form>
      <p role="status" aria-live="polite" className={`mt-3 break-words text-sm ${state.status === "error" ? "text-red-300" : "text-zinc-300"}`}>
        {pending ? "Testing your connection…" : state.message}
      </p>
    </div>
  );
}
