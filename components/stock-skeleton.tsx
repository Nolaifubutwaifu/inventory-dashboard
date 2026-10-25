export function StockSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-[1200px] animate-pulse flex-col gap-4 px-4 py-5 sm:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="h-8 w-56 rounded bg-white" />
          <div className="mt-2 h-4 w-72 rounded bg-white" />
        </div>
        <div className="h-9 w-64 rounded-lg bg-white" />
      </div>
      <div className="h-8 w-full max-w-3xl rounded bg-white" />
      <div className="h-80 rounded-2xl bg-white" />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="h-64 rounded-2xl bg-white" />
        <div className="h-64 rounded-2xl bg-white" />
        <div className="h-64 rounded-2xl bg-white" />
      </div>
    </div>
  );
}
