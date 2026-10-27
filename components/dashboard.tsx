"use client";

import { useState, type ReactNode } from "react";
import { ColourName, CountChip, Swatch } from "@/components/count-chip";
import {
  formatCountedAt,
  formatNumber,
  onHandTotal,
  stockLevel,
  totalCount,
  type Inventory,
  type StockLevel,
} from "@/lib/inventory";
import {
  buildStockView,
  cellDetail,
  inventoryToCsv,
  type AttentionLine,
  type MatrixCell,
  type SimpleRow,
  type SizeColumn,
  type StockView,
} from "@/lib/matrix";
import type { Sales, SalesLoadDetail } from "@/lib/sales";
import { SalesTab } from "@/components/sales-tab";

type ViewMode = "all" | "attention" | "sales";

type DashboardProps = {
  inventory: Inventory;
  sourceLabel: string;
  sales: Sales | null;
  salesDetail: SalesLoadDetail;
};

export function Dashboard({ inventory, sourceLabel, sales, salesDetail }: DashboardProps) {
  const [mode, setMode] = useState<ViewMode>("all");
  const [showLow, setShowLow] = useState(false);
  const view = buildStockView(inventory.items);
  const onHand = onHandTotal(inventory);
  const lineSum = totalCount(inventory.items);
  const sheetDiffers =
    inventory.meta.grand_total !== null && inventory.meta.grand_total !== lineSum;
  const lowOpen = mode === "attention" || showLow;
  const wheelieAttention = view.attention.urgent
    .concat(view.attention.low)
    .filter((line) => line.kind === "body" || line.kind === "lid").length;

  return (
    <div className="min-h-full">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-4 px-4 py-5 sm:px-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex flex-wrap items-baseline gap-x-2.5">
              <p className="text-[11px] font-semibold tracking-[0.18em] text-neutral-400">
                BRISBINS
              </p>
              <h1 className="text-[1.7rem] font-semibold tracking-tight text-neutral-900">
                {mode === "sales" ? "Sales" : "Stock matrix"}
              </h1>
            </div>
            {mode === "sales" ? (
              <p className="mt-1 text-sm text-neutral-500">
                {sales ? (
                  <>
                    Updated {formatCountedAt(sales.updated_at)}
                    <span className="text-neutral-400"> · {sales.source}</span>
                  </>
                ) : (
                  "No sales file yet"
                )}
              </p>
            ) : (
              <p className="mt-1 text-sm text-neutral-500">
                <span
                  className={
                    onHand < 0
                      ? "font-semibold text-[#6e1d24]"
                      : "font-medium text-neutral-800"
                  }
                  title={
                    sheetDiffers
                      ? `Sheet total ${formatNumber(inventory.meta.grand_total ?? 0)}. Line counts sum to ${formatNumber(lineSum)}.`
                      : undefined
                  }
                >
                  {formatNumber(onHand)} on hand
                </span>
                {" · "}
                counted {formatCountedAt(inventory.updated_at)}
                <span className="text-neutral-400"> · {sourceLabel}</span>
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Dashboard views">
              <FilterButton
                pressed={mode === "all"}
                onClick={() => setMode("all")}
              >
                All lines
              </FilterButton>
              <FilterButton
                pressed={mode === "attention"}
                onClick={() => setMode("attention")}
              >
                Needs attention
              </FilterButton>
              <FilterButton
                pressed={mode === "sales"}
                onClick={() => setMode("sales")}
              >
                Sales
              </FilterButton>
            </div>
            <button
              type="button"
              onClick={() => downloadInventory(inventory)}
              className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
            >
              Export
            </button>
          </div>
        </header>

        {mode === "sales" ? (
          <SalesTab sales={sales} salesDetail={salesDetail} items={inventory.items} />
        ) : (
          <>
        <Legend />

        <section className="rounded-2xl border border-neutral-200 bg-white px-3 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:px-5">
          <div className="flex flex-col gap-1 px-1 sm:flex-row sm:items-baseline sm:justify-between">
            <h2 className="text-[15px] font-semibold text-neutral-900">
              Wheelie bins by colour
            </h2>
            <p className="text-[12.5px] text-neutral-500">
              {mode === "all" ? (
                <>
                  {formatNumber(view.wheelie.bodyTotal)} bodies ·{" "}
                  {formatNumber(view.wheelie.lidTotal)} lids ·{" "}
                  {formatNumber(view.wheelie.lines)} lines
                </>
              ) : (
                <>{formatNumber(wheelieAttention)} need attention</>
              )}
            </p>
          </div>
          <WheelieTable wheelie={view.wheelie} mode={mode} />
          <p className="mt-3 px-1 text-[12px] leading-relaxed text-neutral-500">
            Colours per size follow brisbins.com.au. 80L and 120L lids share one
            lid, so those lids are pooled in the 80 / 120L column and can come in
            any colour either size is sold in. 100L, 160L and 500L have no
            separate lid.
          </p>
        </section>

        <div className="grid items-start gap-4 lg:grid-cols-3">
          <Panel
            title="Pedal bins"
            total={view.pedal.total}
          >
          {hasVisibleRows(view.pedal.columns, view.pedal.rows, mode) ? (
            <SizeMatrix
              caption="Pedal bins"
              columns={view.pedal.columns}
              rows={view.pedal.rows}
              mode={mode}
            />
          ) : (
            <EmptyLines mode={mode} />
          )}
        </Panel>
        <Panel title="Vermin lids and parts" total={view.vermin.total}>
          {hasVisibleRows(view.vermin.columns, view.vermin.rows, mode) ? (
            <SizeMatrix
              caption="Vermin lids"
              columns={view.vermin.columns}
              rows={view.vermin.rows}
              mode={mode}
            />
          ) : null}
          <PartsFooter parts={view.vermin.parts} mode={mode} />
          {verminPanelEmpty(view, mode) ? <EmptyLines mode={mode} /> : null}
        </Panel>
          <AttentionPanel
            urgent={view.attention.urgent}
            low={view.attention.low}
            lowOpen={lowOpen}
            canToggleLow={mode === "all" && view.attention.low.length > 0}
            showLow={showLow}
            onToggleLow={() => setShowLow((open) => !open)}
          />
        </div>

        <OtherLines items={view.other} mode={mode} />
          </>
        )}
      </div>
    </div>
  );
}

function Legend() {
  return (
    <ul
      className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[12.5px] text-neutral-600"
      aria-label="Stock legend"
    >
      <li className="inline-flex items-center gap-1.5">
        <CountChip count={-2} />
        Backorder
      </li>
      <li className="inline-flex items-center gap-1.5">
        <CountChip count={0} />
        Out of stock
      </li>
      <li className="inline-flex items-center gap-1.5">
        <CountChip count={3} />
        Reorder (1 to 5)
      </li>
      <li className="inline-flex items-center gap-1.5">
        <CountChip count={12} />
        Low (6 to 15)
      </li>
      <li className="inline-flex items-center gap-1.5">
        <CountChip count={40} />
        In stock (row tinted in the bin colour)
      </li>
      <li className="inline-flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className="inline-block h-7 w-8 rounded-[7px] border border-dashed border-neutral-300"
        />
        Blank: not sold in that size
      </li>
    </ul>
  );
}

function FilterButton({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={
        pressed
          ? "rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white"
          : "rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
      }
    >
      {children}
    </button>
  );
}

function Panel({
  title,
  total,
  children,
}: {
  title: string;
  total: number;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white px-4 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[15px] font-semibold text-neutral-900">{title}</h2>
        <p className="text-sm font-semibold text-neutral-700 tabular-nums">
          {formatNumber(total)}
        </p>
      </div>
      {children}
    </section>
  );
}

function WheelieTable({
  wheelie,
  mode,
}: {
  wheelie: StockView["wheelie"];
  mode: ViewMode;
}) {
  const bodies = projectMatrix(
    wheelie.bodyColumns,
    wheelie.rows.map((row) => row.bodies),
    mode,
  );
  const lids = projectMatrix(
    wheelie.lidColumns,
    wheelie.rows.map((row) => row.lids),
    mode,
  );
  const rows = wheelie.rows.flatMap((row, index) => {
    const bodyCells = bodies.rows[index] ?? [];
    const lidCells = lids.rows[index] ?? [];
    if (mode === "attention" && !bodyCells.some(Boolean) && !lidCells.some(Boolean)) {
      return [];
    }
    return [
      {
        color: row.color,
        bodies: bodyCells,
        lids: lidCells,
        bodyTotal: row.bodyTotal,
        lidTotal: row.lidTotal,
      },
    ];
  });

  if (rows.length === 0) {
    return (
      <p className="px-1 py-6 text-sm text-neutral-500">
        {mode === "attention" ? "None need attention." : "No wheelie bins in this stock file."}
      </p>
    );
  }

  const lidEdge = bodies.columns.length > 0;
  const totalEdge = bodies.columns.length > 0 || lids.columns.length > 0;

  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full min-w-[920px] border-separate border-spacing-0">
        <caption className="sr-only">Wheelie bins by colour and size</caption>
        <thead>
          <tr>
            <th
              scope="col"
              rowSpan={2}
              className="sticky left-0 z-20 min-w-[9.5rem] border-r border-neutral-100 bg-white px-2 pb-2 text-left text-[11px] font-medium text-neutral-500"
            >
              Colour
            </th>
            {bodies.columns.length > 0 ? (
              <th
                scope="colgroup"
                colSpan={bodies.columns.length}
                className="pb-1 text-center text-[11px] font-semibold tracking-[0.16em] text-neutral-400"
              >
                BODIES
              </th>
            ) : null}
            {lids.columns.length > 0 ? (
              <th
                scope="colgroup"
                colSpan={lids.columns.length}
                className={`pb-1 text-center text-[11px] font-semibold tracking-[0.16em] text-neutral-400 ${lidEdge ? "border-l border-neutral-200" : ""}`}
              >
                LIDS
              </th>
            ) : null}
            {mode === "all" ? (
              <th
                scope="colgroup"
                colSpan={2}
                className={`pb-1 text-center text-[11px] font-semibold tracking-[0.16em] text-neutral-400 ${totalEdge ? "border-l border-neutral-200" : ""}`}
              >
                TOTAL
              </th>
            ) : null}
          </tr>
          <tr>
            {bodies.columns.map((column) => (
              <SizeHeading key={`body-${column.key}`} column={column} />
            ))}
            {lids.columns.map((column, index) => (
              <SizeHeading
                key={`lid-${column.key}`}
                column={column}
                edge={index === 0 && lidEdge}
              />
            ))}
            {mode === "all" ? (
              <>
                <SizeHeading label="Bodies" edge={totalEdge} />
                <SizeHeading label="Lids" />
              </>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.color || "unspecified"} className="group">
              <th
                scope="row"
                className="sticky left-0 z-10 border-r border-neutral-100 bg-white px-2 py-1 text-left group-hover:bg-[#fafafa]"
              >
                <ColourName color={row.color} />
              </th>
              {row.bodies.map((cell, index) => (
                <StockCell
                  key={`body-${bodies.columns[index]?.key ?? index}`}
                  cell={cell}
                  color={row.color}
                />
              ))}
              {row.lids.map((cell, index) => (
                <StockCell
                  key={`lid-${lids.columns[index]?.key ?? index}`}
                  cell={cell}
                  color={row.color}
                  edge={index === 0 && lidEdge}
                />
              ))}
              {mode === "all" ? (
                <>
                  <TotalCell value={row.bodyTotal} edge={totalEdge} />
                  <TotalCell value={row.lidTotal} />
                </>
              ) : null}
            </tr>
          ))}
        </tbody>
        {mode === "all" ? (
          <tfoot>
            <tr className="border-t border-neutral-200">
              <th
                scope="row"
                className="sticky left-0 z-10 border-t border-r border-neutral-200 border-r-neutral-100 bg-white px-2 pt-2 text-left text-[13px] font-semibold text-neutral-900"
              >
                Total
              </th>
              {wheelie.bodyColumnTotals.map((value, index) => (
                <TotalCell key={`body-total-${wheelie.bodyColumns[index]?.key ?? index}`} value={value} head />
              ))}
              {wheelie.lidColumnTotals.map((value, index) => (
                <TotalCell
                  key={`lid-total-${wheelie.lidColumns[index]?.key ?? index}`}
                  value={value}
                  edge={index === 0 && lidEdge}
                  head
                />
              ))}
              <TotalCell value={wheelie.bodyTotal} edge={totalEdge} head />
              <TotalCell value={wheelie.lidTotal} head />
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  );
}

function SizeMatrix({
  caption,
  columns,
  rows,
  mode,
}: {
  caption: string;
  columns: SizeColumn[];
  rows: SimpleRow[];
  mode: ViewMode;
}) {
  const projected = projectMatrix(
    columns,
    rows.map((row) => row.cells),
    mode,
  );
  const visible = rows.flatMap((row, index) => {
    const cells = projected.rows[index] ?? [];
    if (!cells.some(Boolean)) return [];
    return [{ color: row.color, cells }];
  });

  if (visible.length === 0) return null;

  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full border-separate border-spacing-0">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th
              scope="col"
              className="sticky left-0 z-10 min-w-[8.5rem] border-r border-neutral-100 bg-white pb-2 text-left text-[11px] font-medium text-neutral-500"
            >
              Colour
            </th>
            {projected.columns.map((column) => (
              <SizeHeading key={column.key} column={column} />
            ))}
          </tr>
        </thead>
        <tbody>
          {visible.map((row) => (
            <tr key={row.color || "unspecified"} className="group">
              <th
                scope="row"
                className="sticky left-0 z-10 border-r border-neutral-100 bg-white py-1 pr-2 text-left group-hover:bg-[#fafafa]"
              >
                <ColourName color={row.color} />
              </th>
              {row.cells.map((cell, index) => (
                <StockCell
                  key={projected.columns[index]?.key ?? index}
                  cell={cell}
                  color={row.color}
                />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PartsFooter({
  parts,
  mode,
}: {
  parts: StockView["vermin"]["parts"];
  mode: ViewMode;
}) {
  const visible = parts.filter((part) => mode === "all" || part.level !== "in");
  if (visible.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 border-t border-neutral-100 pt-3">
      {visible.map((part) => (
        <div key={part.item.sku} className="flex items-center gap-2" title={part.item.sku}>
          <span className="text-[13px] text-neutral-600">{part.item.item}</span>
          <CountChip count={part.item.total_count} title={part.item.sku} />
        </div>
      ))}
    </div>
  );
}

function AttentionPanel({
  urgent,
  low,
  lowOpen,
  canToggleLow,
  showLow,
  onToggleLow,
}: {
  urgent: AttentionLine[];
  low: AttentionLine[];
  lowOpen: boolean;
  canToggleLow: boolean;
  showLow: boolean;
  onToggleLow: () => void;
}) {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white px-4 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <h2 className="flex items-center gap-2 text-[15px] font-semibold text-neutral-900">
        <span aria-hidden="true" className="h-2 w-2 rounded-full bg-[#e11d2e]" />
        Out or reorder now
        <span className="font-semibold text-neutral-500 tabular-nums">
          {formatNumber(urgent.length)}
        </span>
      </h2>
      {urgent.length === 0 ? (
        <p className="mt-3 text-sm text-neutral-500">Nothing is out or due for reorder.</p>
      ) : (
        <AttentionRows lines={urgent} />
      )}
      {lowOpen && low.length > 0 ? (
        <div className="mt-3 border-t border-neutral-100 pt-3">
          <h3 className="text-[12px] font-semibold tracking-wide text-neutral-400 uppercase">
            Running low
          </h3>
          <AttentionRows lines={low} />
        </div>
      ) : null}
      {canToggleLow ? (
        <button
          type="button"
          onClick={onToggleLow}
          className="mt-3 text-[13px] font-medium text-[#2563eb] hover:underline"
          aria-expanded={showLow}
        >
          {showLow ? "Hide running low" : `+${formatNumber(low.length)} running low`}
        </button>
      ) : null}
    </section>
  );
}

function AttentionRows({ lines }: { lines: AttentionLine[] }) {
  return (
    <ul className="mt-2 divide-y divide-neutral-100">
      {lines.map((line) => (
        <li key={line.id} className="flex items-center gap-2 py-1.5" title={line.detail}>
          {line.color ? <Swatch color={line.color} /> : <span className="w-3.5 shrink-0" />}
          <span className="min-w-0 flex-1 text-[13px] text-neutral-800">{line.label}</span>
          <ListBadge count={line.count} level={line.level} />
        </li>
      ))}
    </ul>
  );
}

function OtherLines({
  items,
  mode,
}: {
  items: StockView["other"];
  mode: ViewMode;
}) {
  const visible = items.filter((item) => mode === "all" || stockLevel(item.total_count) !== "in");
  if (visible.length === 0) return null;
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white px-4 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <h2 className="text-[15px] font-semibold text-neutral-900">Other lines</h2>
      <p className="mt-1 text-[12.5px] text-neutral-500">
        These did not match a wheelie, pedal, or vermin size.
      </p>
      <ul className="mt-3 divide-y divide-neutral-100">
        {visible.map((item) => (
          <li key={`${item.sku}:${item.item}`} className="flex items-center gap-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-neutral-800">{item.item}</p>
              <p className="truncate text-[12px] text-neutral-500">
                {item.category}
                {item.sku ? ` · ${item.sku}` : ""}
              </p>
            </div>
            <CountChip count={item.total_count} color={item.color} title={item.sku} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function SizeHeading({
  column,
  label,
  edge,
}: {
  column?: SizeColumn;
  label?: string;
  edge?: boolean;
}) {
  const text = label ?? column?.label ?? "";
  const wide = text.length > 4;
  return (
    <th
      scope="col"
      className={`pb-2 text-center text-[11px] font-medium whitespace-nowrap text-neutral-500 ${wide ? "min-w-[4.4rem]" : "min-w-[3.15rem]"} ${edge ? "border-l border-neutral-200" : ""}`}
    >
      {text}
    </th>
  );
}

function StockCell({
  cell,
  color,
  edge,
}: {
  cell: MatrixCell | null;
  color: string;
  edge?: boolean;
}) {
  return (
    <td
      className={`px-0.5 py-1 text-center align-middle ${edge ? "border-l border-neutral-200" : ""}`}
      {...(cell ? {} : { "aria-label": "Not sold" })}
    >
      {cell ? (
        <CountChip count={cell.count} color={color} title={cellDetail(cell)} />
      ) : null}
    </td>
  );
}

function TotalCell({
  value,
  edge,
  head,
}: {
  value: number;
  edge?: boolean;
  head?: boolean;
}) {
  return (
    <td
      className={`px-1 text-center text-[13px] font-semibold tabular-nums ${head ? "border-t border-neutral-200 pt-2" : "py-1"} ${value < 0 ? "text-[#6e1d24]" : "text-neutral-900"} ${edge ? "border-l border-neutral-200" : ""}`}
    >
      {formatNumber(value)}
    </td>
  );
}

function ListBadge({ count, level }: { count: number; level: StockLevel }) {
  if (level === "out") {
    return (
      <span className="rounded-[6px] bg-[#6e1d24] px-1.5 py-[3px] text-[10px] font-bold tracking-[0.08em] text-white">
        OUT
      </span>
    );
  }
  if (level === "backorder") {
    return (
      <span className="rounded-[6px] bg-[#6e1d24] px-1.5 py-[3px] text-[12px] font-semibold text-white tabular-nums">
        {formatNumber(count)}
      </span>
    );
  }
  if (level === "reorder") {
    return (
      <span className="rounded-[6px] bg-[#e11d2e] px-1.5 py-[3px] text-[12px] font-semibold text-white tabular-nums">
        {formatNumber(count)}
      </span>
    );
  }
  return (
    <span className="rounded-[6px] border-[1.5px] border-[#f97316] bg-white px-1.5 py-[2px] text-[12px] font-semibold text-[#ea580c] tabular-nums">
      {formatNumber(count)}
    </span>
  );
}

function EmptyLines({ mode }: { mode: ViewMode }) {
  return (
    <p className="mt-3 text-sm text-neutral-500">
      {mode === "attention" ? "None need attention." : "None in this stock file."}
    </p>
  );
}

function hasVisibleRows(
  columns: readonly SizeColumn[],
  rows: readonly SimpleRow[],
  mode: ViewMode,
): boolean {
  return projectMatrix(
    columns,
    rows.map((row) => row.cells),
    mode,
  ).rows.some((cells) => cells.some(Boolean));
}

function verminPanelEmpty(view: StockView, mode: ViewMode): boolean {
  const lids = hasVisibleRows(view.vermin.columns, view.vermin.rows, mode);
  const parts = view.vermin.parts.some((part) => mode === "all" || part.level !== "in");
  return !lids && !parts;
}

function projectMatrix(
  columns: readonly SizeColumn[],
  matrixRows: readonly (readonly (MatrixCell | null)[])[],
  mode: ViewMode,
): { columns: SizeColumn[]; rows: (MatrixCell | null)[][] } {
  const indexes = columns
    .map((_, index) => index)
    .filter((index) => {
      if (mode === "all") return true;
      return matrixRows.some((row) => {
        const cell = row[index];
        return cell != null && cell.level !== "in";
      });
    });
  return {
    columns: indexes.map((index) => columns[index]!),
    rows: matrixRows.map((row) =>
      indexes.map((index) => {
        const cell = row[index] ?? null;
        if (mode === "attention" && cell && cell.level === "in") return null;
        return cell;
      }),
    ),
  };
}

function downloadInventory(inventory: Inventory) {
  const csv = `\uFEFF${inventoryToCsv(inventory.items)}`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const day = inventory.updated_at.slice(0, 10);
  anchor.href = url;
  anchor.download = /^\d{4}-\d{2}-\d{2}$/.test(day)
    ? `brisbins-inventory-${day}.csv`
    : "brisbins-inventory.csv";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
