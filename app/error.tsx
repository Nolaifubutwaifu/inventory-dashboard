"use client";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-full max-w-lg flex-col justify-center gap-4 px-4 py-16">
      <h1 className="text-xl font-semibold">Inventory could not be loaded</h1>
      <p className="text-sm text-[var(--muted)]">
        The stock file could not be read. Try again, or check the Blob store if
        this keeps happening.
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="w-fit rounded-md bg-[var(--header)] px-3 py-2 text-sm text-white"
      >
        Try again
      </button>
    </main>
  );
}
