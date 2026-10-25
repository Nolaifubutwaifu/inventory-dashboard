"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Brand } from "@/components/brand";
import {
  LOW_STOCK_MAX,
  categorySummaries,
  displayLocations,
  displayText,
  filterItems,
  formatNumber,
  formatUpdatedAt,
  lowStockCount,
  onHandTotal,
  sortItems,
  stockLevel,
  totalCount,
  type Inventory,
  type InventoryItem,
  type SortDirection,
  type SortKey,
} from "@/lib/inventory";

const COLOUR_SWATCH: Record<string, string> = {
  Black: "#1a1a1a",
  "Royal Blue": "#1d4e89",
  "Dark Green": "#1f4d3a",
  "Dark Grey": "#4b5563",
  "Lime Green": "#84cc16",
  Red: "#b91c1c",
  Yellow: "#eab308",
  Orange: "#ea580c",
  "Light Blue": "#7dd3fc",
  White: "#f8fafc",
  Purple: "#7e22ce",
  "Shadow Green": "#3f6212",
};

const SORT_COLUMNS: { key: SortKey; label: string; align: "left" | "right" }[] =
  [
    { key: "category", label: "Category", align: "left" },
    { key: "item", label: "Item", align: "left" },
    { key: "sku", label: "SKU", align: "left" },
    { key: "color", label: "Colour", align: "left" },
    { key: "size", label: "Size", align: "left" },
    { key: "count", label: "Count", align: "right" },
  ];

type DashboardProps = {
  inventory: Inventory;
  sourceLabel: string;
};

export function Dashboard({ inventory, sourceLabel }: DashboardProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [lowOnly, setLowOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("count");
  const [sortDir, setSortDir] = useState<SortDirection>("desc");

  const summaries = categorySummaries(inventory.items);
  const lineSum = totalCount(inventory.items);
  const onHand = onHandTotal(inventory);
  const lowCount = lowStockCount(inventory.items);
  const visible = sortItems(
    filterItems(inventory.items, query, category, lowOnly),
    sortKey,
    sortDir,
  );
  const showLocations = inventory.items.some(
    (item) => displayLocations(item.locations) !== "",
  );
  const chartMax = summaries.reduce(
    (max, summary) => Math.max(max, summary.total),
    0,
  );
  const filtersActive = query.trim() !== "" || category !== "all" || lowOnly;

  function onSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir(key === "count" ? "desc" : "asc");
  }

  function clearFilters() {
    setQuery("");
    setCategory("all");
    setLowOnly(false);
  }

  return (
    <div className="min-h-full">
      <header className="bg-[var(--header)] text-white">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-5 sm:flex-row sm:items-start sm:justify-between">
          <Brand />
          <div className="sm:text-right">
            <p className="text-[0.7rem] font-semibold tracking-[0.14em] text-[#d7ebe3]">
              LAST UPDATED
            </p>
            <p className="text-base font-medium">
              {formatUpdatedAt(inventory.updated_at)}
            </p>
            <p className="mt-1 text-sm text-[#d7ebe3]">
              {metaLine(inventory)}
            </p>
            <p className="text-xs text-[#b7d4c9]">{sourceLabel}</p>
            <button
              type="button"
              onClick={() => router.refresh()}
              className="mt-2 rounded-md border border-white/25 px-2.5 py-1 text-xs text-white hover:bg-white/10"
            >
              Reload
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6">
        <section aria-label="Stock totals">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
            <article className="col-span-2 rounded-md border border-[var(--line)] border-l-4 border-l-[var(--accent)] bg-[var(--card)] px-4 py-3">
              <p className="text-xs font-medium tracking-wide text-[var(--muted)] uppercase">
                On hand
              </p>
              <p
                className={`mt-1 text-3xl font-semibold tabular-nums ${onHand < 0 ? "text-[#6e1d24]" : "text-[var(--accent)]"}`}
                title={
                  inventory.meta.grand_total !== null && inventory.meta.grand_total !== lineSum
                    ? `Sheet total ${formatNumber(onHand)}. Line counts sum to ${formatNumber(lineSum)}.`
                    : undefined
                }
              >
                {formatNumber(onHand)}
              </p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                {formatNumber(inventory.items.length)} SKUs
                {inventory.meta.grand_total !== null && inventory.meta.grand_total !== lineSum ? (
                  <> · Line sum {formatNumber(lineSum)}</>
                ) : null}
              </p>
            </article>
            {summaries.map((summary) => (
              <button
                key={summary.category}
                type="button"
                aria-pressed={category === summary.category}
                onClick={() =>
                  setCategory((current) =>
                    current === summary.category ? "all" : summary.category,
                  )
                }
                className={`cursor-pointer rounded-md border bg-[var(--card)] px-3 py-3 text-left hover:bg-[#f7f3ec] ${
                  category === summary.category
                    ? "border-[var(--accent)] ring-1 ring-[var(--accent)]"
                    : "border-[var(--line)]"
                }`}
              >
                <p className="text-xs text-[var(--muted)]">{summary.category}</p>
                <p
                  className={`mt-1 text-xl font-semibold tabular-nums ${summary.total < 0 ? "text-[#6e1d24]" : ""}`}
                >
                  {formatNumber(summary.total)}
                </p>
                <p className="text-xs text-[var(--muted)]">
                  {formatNumber(summary.skus)} SKUs
                </p>
              </button>
            ))}
            <button
              type="button"
              aria-pressed={lowOnly}
              onClick={() => setLowOnly((current) => !current)}
              className={`cursor-pointer rounded-md border bg-[var(--card)] px-3 py-3 text-left hover:bg-[#fff6ee] ${
                lowOnly
                  ? "border-[var(--low)] ring-1 ring-[var(--low)]"
                  : "border-[var(--line)]"
              }`}
            >
              <p className="text-xs text-[var(--muted)]">
                Low stock (≤ {LOW_STOCK_MAX})
              </p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-[var(--low)]">
                {formatNumber(lowCount)}
              </p>
              <p className="text-xs text-[var(--muted)]">SKUs</p>
            </button>
          </div>
        </section>

        <section aria-label="Stock by category" className="rounded-md border border-[var(--line)] bg-[var(--card)] px-4 py-4">
          <h2 className="text-sm font-semibold">Stock by category</h2>
          <ul className="mt-3 flex flex-col gap-2.5">
            {[...summaries]
              .toSorted((a, b) => b.total - a.total)
              .map((summary) => {
                const width =
                  chartMax <= 0
                    ? 0
                    : Math.max(
                        summary.total > 0 ? 2 : 0,
                        Math.round((Math.max(summary.total, 0) / chartMax) * 100),
                      );
                return (
                  <li
                    key={summary.category}
                    className="grid grid-cols-[6.5rem_1fr_auto] items-center gap-3 text-sm"
                  >
                    <span className="truncate">{summary.category}</span>
                    <span className="h-2.5 overflow-hidden rounded-full bg-[#efeae2]">
                      <span
                        className="block h-2.5 rounded-full bg-[var(--accent)]"
                        style={{ width: `${width}%` }}
                      />
                    </span>
                    <span className="w-16 text-right tabular-nums">
                      {formatNumber(summary.total)}
                    </span>
                  </li>
                );
              })}
          </ul>
        </section>

        <section aria-label="Stock lines" className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
              <span className="font-medium">Search</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Item, SKU, or colour"
                className="rounded-md border border-[var(--line)] bg-white px-3 py-2"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Category</span>
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="rounded-md border border-[var(--line)] bg-white px-3 py-2"
              >
                <option value="all">All categories</option>
                {summaries.map((summary) => (
                  <option key={summary.category} value={summary.category}>
                    {summary.category}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 pb-2 text-sm">
              <input
                type="checkbox"
                checked={lowOnly}
                onChange={(event) => setLowOnly(event.target.checked)}
              />
              Low stock only
            </label>
            {filtersActive ? (
              <button
                type="button"
                onClick={clearFilters}
                className="pb-2 text-sm text-[var(--accent)] underline-offset-2 hover:underline"
              >
                Clear filters
              </button>
            ) : null}
          </div>

          <p className="text-sm text-[var(--muted)]" aria-live="polite">
            Showing {formatNumber(visible.length)} of{" "}
            {formatNumber(inventory.items.length)}
            {lowOnly
              ? ` · count ≤ ${LOW_STOCK_MAX}, including backorders`
              : " · backorders in dark red, zero out of stock, 5 or fewer highlighted"}
          </p>

          <ul className="flex flex-col gap-2 md:hidden">
            {visible.map((item) => (
              <StockCard key={item.sku} item={item} showLocations={showLocations} />
            ))}
          </ul>

          <div className="hidden overflow-x-auto rounded-md border border-[var(--line)] bg-[var(--card)] md:block">
            <table className="w-full border-collapse text-sm">
              <caption className="sr-only">
                Brisbins warehouse stock by SKU
              </caption>
              <thead className="bg-[#f7f3ec] text-left text-xs tracking-wide text-[var(--muted)] uppercase">
                <tr>
                  {SORT_COLUMNS.map((column) => (
                    <SortHeader
                      key={column.key}
                      label={column.label}
                      column={column.key}
                      active={sortKey}
                      direction={sortDir}
                      align={column.align}
                      onSort={onSort}
                    />
                  ))}
                  {showLocations ? (
                    <th scope="col" className="px-3 py-2 font-medium">
                      Locations
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {visible.map((item) => {
                  return (
                    <tr
                      key={item.sku}
                      className={rowTone(item.total_count)}
                    >
                      <td className="border-t border-[var(--line)] px-3 py-2">
                        {item.category}
                      </td>
                      <td className="border-t border-[var(--line)] px-3 py-2 font-medium">
                        {item.item}
                      </td>
                      <td className="border-t border-[var(--line)] px-3 py-2 font-mono text-xs">
                        {item.sku}
                      </td>
                      <td className="border-t border-[var(--line)] px-3 py-2">
                        <ColourLabel colour={item.color} />
                      </td>
                      <td className="border-t border-[var(--line)] px-3 py-2">
                        {displayText(item.size)}
                      </td>
                      <td className="border-t border-[var(--line)] px-3 py-2 text-right">
                        <CountReadout count={item.total_count} />
                      </td>
                      {showLocations ? (
                        <td className="border-t border-[var(--line)] px-3 py-2">
                          {displayText(displayLocations(item.locations))}
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {visible.length === 0 ? (
            <p className="rounded-md border border-dashed border-[var(--line)] bg-[var(--card)] px-4 py-8 text-center text-sm text-[var(--muted)]">
              No SKUs match these filters.
            </p>
          ) : null}
        </section>
      </main>
    </div>
  );
}

function metaLine(inventory: Inventory): string {
  const parts = [inventory.meta.title, inventory.meta.date].filter(Boolean);
  const generated = inventory.meta.generated;
  if (generated) parts.push(generated);
  return parts.join(" · ");
}

function StockCard({
  item,
  showLocations,
}: {
  item: InventoryItem;
  showLocations: boolean;
}) {
  const level = stockLevel(item.total_count);
  return (
    <li
      className={`rounded-md border px-3 py-3 ${cardTone(level)}`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="font-medium">{item.item}</p>
        <CountReadout count={item.total_count} />
      </div>
      <p className="mt-1 font-mono text-xs text-[var(--muted)]">{item.sku}</p>
      <p className="mt-1 text-sm text-[var(--muted)]">
        {item.category}
        {" · "}
        <ColourLabel colour={item.color} />
        {" · "}
        {displayText(item.size)}
      </p>
      {showLocations ? (
        <p className="mt-1 text-sm">{displayText(displayLocations(item.locations))}</p>
      ) : null}
    </li>
  );
}

function CountReadout({ count }: { count: number }) {
  const level = stockLevel(count);
  const number = formatNumber(count);
  if (level === "backorder") {
    return (
      <span className="font-semibold text-[#6e1d24] tabular-nums">
        {number}
        <span className="ml-2 text-xs font-medium">Backorder</span>
      </span>
    );
  }
  if (level === "out") {
    return (
      <span className="font-semibold text-neutral-700 tabular-nums">
        {number}
        <span className="ml-2 text-xs font-semibold tracking-wide text-neutral-500">
          Out
        </span>
      </span>
    );
  }
  if (level === "reorder") {
    return (
      <span className="font-semibold tabular-nums">
        {number}
        <span className="ml-2 text-xs font-medium text-[var(--low)]">Low</span>
      </span>
    );
  }
  return <span className="font-semibold tabular-nums">{number}</span>;
}

function rowTone(count: number): string {
  const level = stockLevel(count);
  if (level === "backorder") return "bg-[#fde8e8]";
  if (level === "out") return "bg-[#f4f4f5]";
  if (level === "reorder") return "bg-[var(--low-bg)]";
  return "bg-[var(--card)]";
}

function cardTone(level: ReturnType<typeof stockLevel>): string {
  if (level === "backorder") return "border-[#e7c3c3] bg-[#fde8e8]";
  if (level === "out") return "border-neutral-300 bg-[#f4f4f5]";
  if (level === "reorder") return "border-[#f0d3b8] bg-[var(--low-bg)]";
  return "border-[var(--line)] bg-[var(--card)]";
}

function ColourLabel({ colour }: { colour: string }) {
  const fill = COLOUR_SWATCH[colour];
  const light =
    colour === "White" || colour === "Yellow" || colour === "Lime Green";
  return (
    <span className="inline-flex items-center gap-1.5">
      {fill ? (
        <span
          aria-hidden="true"
          className={`inline-block h-2.5 w-2.5 rounded-full ${light ? "ring-1 ring-stone-400" : ""}`}
          style={{ backgroundColor: fill }}
        />
      ) : null}
      {displayText(colour)}
    </span>
  );
}

function SortHeader({
  label,
  column,
  active,
  direction,
  align,
  onSort,
}: {
  label: string;
  column: SortKey;
  active: SortKey;
  direction: SortDirection;
  align: "left" | "right";
  onSort: (key: SortKey) => void;
}) {
  const selected = active === column;
  return (
    <th
      scope="col"
      aria-sort={
        selected ? (direction === "asc" ? "ascending" : "descending") : "none"
      }
      className={`px-3 py-2 font-medium ${align === "right" ? "text-right" : "text-left"}`}
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        className={`inline-flex items-center gap-1 ${align === "right" ? "ml-auto" : ""}`}
      >
        {label}
        {selected ? (
          <span aria-hidden="true">{direction === "asc" ? "↑" : "↓"}</span>
        ) : null}
      </button>
    </th>
  );
}
