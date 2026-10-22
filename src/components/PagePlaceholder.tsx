export default function PagePlaceholder({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <section className="max-w-3xl">
      <div className="studio-card rounded-2xl p-6 sm:p-8">
        <p className="text-xs font-semibold tracking-[0.22em] text-cyan-200 uppercase">In the works</p>
        <h1 className="studio-title mt-3 text-3xl font-bold tracking-tight">{title}</h1>
        <p className="mt-3 text-slate-300">{description}</p>
        <p className="studio-panel mt-7 rounded-xl border-dashed p-5 text-sm text-slate-400">
          Coming in a later stage.
        </p>
      </div>
    </section>
  );
}
