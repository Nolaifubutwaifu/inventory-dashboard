import { Brand } from "@/components/brand";

export function StockSkeleton() {
  return (
    <div className="animate-pulse">
      <header className="bg-[var(--header)]">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between">
          <Brand />
          <div className="h-12 w-48 rounded bg-white/10" />
        </div>
      </header>
      <div className="mx-auto grid w-full max-w-6xl gap-3 px-4 py-6 sm:grid-cols-2 lg:grid-cols-3">
        <div className="h-24 rounded-md bg-white" />
        <div className="h-24 rounded-md bg-white" />
        <div className="h-24 rounded-md bg-white" />
      </div>
    </div>
  );
}
