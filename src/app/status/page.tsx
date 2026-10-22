import DatabaseCheck from "./DatabaseCheck";

export const metadata = { title: "Status · muziqobbiz" };

export default function Page() {
  return (
    <section>
      <h1 className="text-2xl font-semibold">Status</h1>
      <p className="mt-2 text-zinc-400">Check that your music can be saved.</p>
      <DatabaseCheck />
    </section>
  );
}
