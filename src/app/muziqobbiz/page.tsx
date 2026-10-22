import Recorder from "@/components/Recorder";

export const metadata = { title: "muziqobbiz · muziqobbiz" };

export default function Page() {
  return (
    <section className="max-w-3xl">
      <div className="studio-card relative overflow-hidden rounded-2xl p-6 sm:p-8">
        <div aria-hidden className="pointer-events-none absolute -top-24 -right-14 size-56 rounded-full bg-fuchsia-400/15 blur-3xl" />
        <p className="text-xs font-semibold tracking-[0.22em] text-cyan-200 uppercase">Your private music studio</p>
        <h1 className="studio-title relative mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Make something worth replaying.</h1>
        <p className="relative mt-3 max-w-xl text-sm leading-6 text-slate-300 sm:text-base">
          Start with your voice. Record a take, find its rhythm, then build the music around it.
        </p>
      </div>
      <Recorder />
    </section>
  );
}
