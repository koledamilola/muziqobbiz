export default function PagePlaceholder({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <section>
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="mt-2 text-zinc-400">{description}</p>
      <p className="mt-6 rounded-lg border border-dashed border-zinc-700 p-6 text-sm text-zinc-500">
        Coming in a later stage.
      </p>
    </section>
  );
}
