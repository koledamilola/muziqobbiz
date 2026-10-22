import Recorder from "@/components/Recorder";

export const metadata = { title: "muziqobbiz · muziqobbiz" };

export default function Page() {
  return (
    <section className="max-w-3xl">
      <h1 className="text-2xl font-semibold">muziqobbiz</h1>
      <p className="mt-2 text-zinc-400">
        Record your vocal, analyze it, generate a beat and mix.
      </p>
      <Recorder />
    </section>
  );
}
