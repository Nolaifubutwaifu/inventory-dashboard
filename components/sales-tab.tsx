"use client";

import { useMemo, useSyncExternalStore, type ReactNode } from "react";
import { ColourName } from "@/components/count-chip";
import { formatNumber } from "@/lib/inventory";
import type { InventoryItem } from "@/lib/inventory";
import {
  buildSalesView,
  brisbaneToday,
  DEFAULT_ORDER_ASSUMPTIONS,
  formatMoney,
  formatQty,
  ORDER_ASSUMPTIONS_STORAGE_KEY,
  readOrderAssumptions,
  sanitiseAssumptions,
  type LineGroup,
  type OrderAssumptions,
  type Sales,
  type SalesLoadDetail,
  type SuggestionLine,
} from "@/lib/sales";

type SalesTabProps = {
  sales: Sales | null;
  salesDetail: SalesLoadDetail;
  items: readonly InventoryItem[];
};

export function SalesTab({ sales, salesDetail, items }: SalesTabProps) {
  if (!sales) return <SalesEmpty detail={salesDetail} />;
  return <SalesReport sales={sales} salesDetail={salesDetail} items={items} />;
}

function SalesReport({
  sales,
  salesDetail,
  items,
}: {
  sales: Sales;
  salesDetail: SalesLoadDetail;
  items: readonly InventoryItem[];
}) {
  const assumptions = useSyncExternalStore(
    subscribeAssumptions,
    assumptionsSnapshot,
    serverAssumptions,
  );

  const today = brisbaneToday();
  const view = useMemo(
    () => buildSalesView(sales, items, today, assumptions),
    [sales, items, today, assumptions],
  );

  return (
    <div className="flex flex-col gap-4">
      {salesDetail === "preview" ? (
        <p className="rounded-xl border border-dashed border-neutral-300 bg-white px-3 py-2 text-[13px] text-neutral-600">
          Showing the sample sales file. No sales.json has been uploaded yet.
        </p>
      ) : null}

      <section className="rounded-2xl border border-neutral-200 bg-white px-4 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:px-5">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
          <h2 className="text-[15px] font-semibold text-neutral-900">Sold this month</h2>
          <p className="text-[12.5px] text-neutral-500">{view.month.label}</p>
        </div>
        {view.month.hasRows ? (
          <>
            <p className="mt-2 text-[13px] text-neutral-600">
              Covered dates: {view.month.rangeLabel}
              {view.month.tradingDays > 0
                ? ` (${formatNumber(view.month.tradingDays)} trading ${view.month.tradingDays === 1 ? "day" : "days"}).`
                : "."}
            </p>
            {view.month.partial ? (
              <p className="mt-1 text-[13px] text-neutral-600">
                {view.month.partial.label} is a running total, so this month can still change.
              </p>
            ) : null}
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="Invoices" value={formatNumber(view.month.invoices)} />
              <Stat label="Bins" value={formatNumber(view.month.bins)} />
              <Stat label="Lids" value={formatNumber(view.month.lids)} />
              <Stat label="Parts" value={formatNumber(view.month.parts)} />
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              <Stat label="Sales ex GST" value={formatMoney(view.month.salesExGst)} />
              <Stat label="Sales incl GST" value={formatMoney(view.month.salesInclGst)} />
              <Stat label="Freight ex GST" value={formatMoney(view.month.freightExGst)} />
            </div>
            <div className="mt-4 flex flex-col gap-4">
              {view.month.groups.map((group) => (
                <LineTable
                  key={group.kind}
                  title={group.title}
                  columns={group.kind === "part" || group.kind === "other" ? partColumns : itemColumns}
                >
                  {group.lines.map((row) => (
                    <tr key={row.id}>
                      {group.kind === "bin" || group.kind === "lid" ? (
                        <>
                          <SizeCell value={row.size} />
                          <ColourCell colour={row.colour} />
                        </>
                      ) : (
                        <td className="py-1.5 pr-3 text-[13px] text-neutral-800">{row.size}</td>
                      )}
                      <QtyCell value={formatQty(row.qty)} />
                    </tr>
                  ))}
                </LineTable>
              ))}
            </div>
          </>
        ) : (
          <p className="mt-3 text-sm text-neutral-500">No sales recorded in {view.month.label}.</p>
        )}
      </section>

      <section className="rounded-2xl border border-neutral-200 bg-white px-4 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:px-5">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
          <h2 className="text-[15px] font-semibold text-neutral-900">Expected sales next month</h2>
          <p className="text-[12.5px] text-neutral-500">{view.forecast.monthLabel}</p>
        </div>
        {view.forecast.hasHistory && view.forecast.basisLabel ? (
          <>
            <p className="mt-2 text-sm font-medium text-neutral-800">{view.forecast.basisLabel}</p>
            {view.forecast.lowConfidence ? (
              <p className="mt-2 rounded-lg bg-[#fff7ed] px-3 py-2 text-[13px] leading-relaxed text-[#9a3412]">
                Low confidence. This history is under 3 months, so treat the forecast as a rough guide.
              </p>
            ) : null}
            {view.forecast.partial ? (
              <p className="mt-2 text-[13px] leading-relaxed text-neutral-600">
                {view.forecast.partial.label} is a partial day. The file marks it as a running total,
                and it still counts as one trading day, so the daily average is a little low.
              </p>
            ) : null}
            <p className="mt-2 text-[13px] leading-relaxed text-neutral-600">
              Expected quantity is the average sold on each trading day, multiplied by the{" "}
              {formatNumber(view.forecast.weekdays)} weekdays in {view.forecast.monthLabel}.
              Weekends are not trading days. Days before the first sale are not filled in.
              The window uses at most the last 6 months.
            </p>
            <div className="mt-4 flex flex-col gap-4">
              {view.forecast.groups.map((group) => (
                <LineTable
                  key={group.kind}
                  title={group.title}
                  columns={
                    group.kind === "part" || group.kind === "other"
                      ? ["Name", "Sold", "Per trading day", view.forecast.monthLabel]
                      : ["Size", "Colour", "Sold", "Per trading day", view.forecast.monthLabel]
                  }
                >
                  {group.lines.map((row) => (
                    <tr key={row.id}>
                      {group.kind === "bin" || group.kind === "lid" ? (
                        <>
                          <SizeCell value={row.size} />
                          <ColourCell colour={row.colour} />
                        </>
                      ) : (
                        <td className="py-1.5 pr-3 text-[13px] text-neutral-800">{row.size}</td>
                      )}
                      <QtyCell value={formatQty(row.sold)} />
                      <QtyCell value={formatQty(row.perDay)} />
                      <QtyCell value={formatQty(row.expected)} strong />
                    </tr>
                  ))}
                </LineTable>
              ))}
            </div>
          </>
        ) : (
          <p className="mt-3 text-sm text-neutral-500">No sales history to forecast from yet.</p>
        )}
      </section>

      <section className="rounded-2xl border border-neutral-200 bg-white px-4 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:px-5">
        <h2 className="text-[15px] font-semibold text-neutral-900">Next container suggestion</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <NumberField
            id="lead-weeks"
            label="Lead time (weeks)"
            value={assumptions.leadWeeks}
            onChange={(value) => updateWeeks("leadWeeks", value)}
          />
          <NumberField
            id="cover-weeks"
            label="Cover after arrival (weeks)"
            value={assumptions.coverWeeks}
            onChange={(value) => updateWeeks("coverWeeks", value)}
          />
          <label className="block text-[13px] font-medium text-neutral-700" htmlFor="container-capacity">
            Container capacity (units)
            <input
              id="container-capacity"
              type="number"
              min={0}
              max={100000}
              step={1}
              inputMode="numeric"
              placeholder="Not set"
              value={assumptions.capacity ?? ""}
              onChange={(event) => updateCapacity(event.target.value)}
              className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm font-normal text-neutral-900"
            />
          </label>
        </div>
        <div className="mt-3 space-y-2 text-[13px] leading-relaxed text-neutral-600">
          <p>
            Cover is {formatNumber(view.container.totalWeeks)} weeks:{" "}
            {formatNumber(view.container.leadWeeks)} weeks lead time plus{" "}
            {formatNumber(view.container.coverWeeks)} weeks after arrival. That is{" "}
            {formatNumber(view.container.coverTradingDays)} trading days, at 5 trading days a week.
            Suggested quantity is demand over that cover, minus stock on hand. A backorder adds to
            the amount. The result is never below 0, and it is rounded up to a whole unit.
          </p>
          <p>
            {view.container.capacity == null ? (
              "Container capacity is not set, so this list is not capped."
            ) : (
              <>
                Container capacity is {formatNumber(view.container.capacity)} units.
                {view.container.limited
                  ? ` ${formatNumber(view.container.ordered.all)} units fit. The largest gaps are kept first, and parts come after bins and lids.`
                  : " The suggested units fit in that capacity."}
              </>
            )}
          </p>
          <p>
            80L and 120L lids are one shared lid, shown as 80/120L. Colour matching ignores
            capitals and extra spaces. Parts are listed by name and are not matched to stock, so
            stock is not subtracted. A bin or lid that is not in the stock file counts as 0 on
            hand. Backorders with no sales in this window are still listed.
          </p>
          <p className="font-medium text-neutral-800">
            Suggested total: {formatNumber(view.container.suggested.all)} units (
            {formatNumber(view.container.suggested.bins)} bins,{" "}
            {formatNumber(view.container.suggested.lids)} lids,{" "}
            {formatNumber(view.container.suggested.parts)} parts).
            {view.container.capacity != null
              ? ` In this container: ${formatNumber(view.container.ordered.all)} units.`
              : ""}
          </p>
        </div>
        {view.container.groups.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-500">Nothing to suggest from the current file.</p>
        ) : (
          <div className="mt-4 flex flex-col gap-4">
            {view.container.groups.map((group) => (
              <SuggestionTable
                key={group.kind}
                group={group}
                showOrder={view.container.capacity != null}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

const itemColumns = ["Size", "Colour", "Qty"];
const partColumns = ["Name", "Qty"];

function SalesEmpty({ detail }: { detail: SalesLoadDetail }) {
  const invalid = detail === "invalid" || detail === "error";
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white px-4 py-8 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:px-5">
      <h2 className="text-[15px] font-semibold text-neutral-900">
        {invalid ? "Sales file could not be read" : "No sales yet"}
      </h2>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-neutral-600">
        {invalid
          ? "The sales file in the store is not valid. The stock matrix is unchanged. The next upload replaces the file."
          : "This tab fills in after the office PC uploads sales.json. Until then there is nothing to total, forecast, or order."}
      </p>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-neutral-50 px-3 py-2">
      <p className="text-[11px] font-medium tracking-wide text-neutral-500 uppercase">{label}</p>
      <p className="mt-1 text-lg font-semibold text-neutral-900 tabular-nums">{value}</p>
    </div>
  );
}

function NumberField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block text-[13px] font-medium text-neutral-700" htmlFor={id}>
      {label}
      <input
        id={id}
        type="number"
        min={0}
        max={104}
        step={1}
        inputMode="numeric"
        value={value}
        onChange={(event) => onChange(event.target.valueAsNumber)}
        className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm font-normal text-neutral-900"
      />
    </label>
  );
}

function LineTable({
  title,
  columns,
  children,
}: {
  title: string;
  columns: string[];
  children: ReactNode;
}) {
  return (
    <div className="overflow-x-auto">
      <h3 className="text-[12px] font-semibold tracking-wide text-neutral-400 uppercase">{title}</h3>
      <table className="mt-1 w-full min-w-[28rem] border-separate border-spacing-0">
        <caption className="sr-only">{title}</caption>
        <thead>
          <tr>
            {columns.map((column, index) => {
              const labels = columns[0] === "Name" ? 1 : 2;
              return (
                <th
                  key={column}
                  scope="col"
                  className={`pb-1 text-[11px] font-medium text-neutral-500 ${index < labels ? "pr-3 text-left" : "text-right"}`}
                >
                  {column}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function SuggestionTable({
  group,
  showOrder,
}: {
  group: LineGroup<SuggestionLine>;
  showOrder: boolean;
}) {
  const named = group.kind === "part" || group.kind === "other";
  const columns = named
    ? ["Name", "Sold", "On hand", "Cover demand", "Suggested"]
    : ["Size", "Colour", "Sold", "On hand", "Cover demand", "Suggested"];
  if (showOrder) columns.push("In container");
  return (
    <LineTable title={group.title} columns={columns}>
      {group.lines.map((row) => (
        <tr key={row.id}>
          {named ? (
            <td className="py-1.5 pr-3 text-[13px] text-neutral-800">{row.size}</td>
          ) : (
            <>
              <SizeCell value={row.size} />
              <ColourCell colour={row.colour} />
            </>
          )}
          <QtyCell value={formatQty(row.sold)} />
          <td
            className={`py-1.5 text-right text-[13px] tabular-nums ${row.onHand != null && row.onHand < 0 ? "font-semibold text-[#6e1d24]" : "text-neutral-700"}`}
          >
            {stockText(row)}
          </td>
          <QtyCell value={formatQty(row.coverDemand)} />
          <QtyCell value={formatNumber(row.suggested)} strong />
          {showOrder ? <QtyCell value={formatNumber(row.orderQty)} strong /> : null}
        </tr>
      ))}
    </LineTable>
  );
}

function SizeCell({ value }: { value: string }) {
  return <td className="py-1.5 pr-3 text-[13px] font-medium whitespace-nowrap text-neutral-800">{value}</td>;
}

function ColourCell({ colour }: { colour: string }) {
  return (
    <td className="py-1.5 pr-3">
      {colour ? <ColourName color={colour} /> : <span className="text-[13px] text-neutral-400">None</span>}
    </td>
  );
}

function QtyCell({ value, strong }: { value: string; strong?: boolean }) {
  return (
    <td
      className={`py-1.5 text-right text-[13px] tabular-nums ${strong ? "font-semibold text-neutral-900" : "text-neutral-700"}`}
    >
      {value}
    </td>
  );
}

function stockText(line: SuggestionLine): string {
  if (line.onHand == null) return "Not matched";
  if (!line.matched) return "Not in file";
  return formatNumber(line.onHand);
}

const ASSUMPTIONS_EVENT = "brisbins-assumptions";

let cachedRaw: string | null | undefined;
let cachedAssumptions = DEFAULT_ORDER_ASSUMPTIONS;

function assumptionsSnapshot(): OrderAssumptions {
  const raw = localStorage.getItem(ORDER_ASSUMPTIONS_STORAGE_KEY);
  if (raw === cachedRaw) return cachedAssumptions;
  cachedRaw = raw;
  cachedAssumptions = readOrderAssumptions(raw);
  return cachedAssumptions;
}

function serverAssumptions(): OrderAssumptions {
  return DEFAULT_ORDER_ASSUMPTIONS;
}

function subscribeAssumptions(onChange: () => void) {
  window.addEventListener(ASSUMPTIONS_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(ASSUMPTIONS_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function writeAssumptions(next: OrderAssumptions) {
  const raw = JSON.stringify(next);
  localStorage.setItem(ORDER_ASSUMPTIONS_STORAGE_KEY, raw);
  cachedRaw = raw;
  cachedAssumptions = next;
  window.dispatchEvent(new Event(ASSUMPTIONS_EVENT));
}

function updateWeeks(field: "leadWeeks" | "coverWeeks", value: number) {
  if (!Number.isFinite(value)) return;
  writeAssumptions(sanitiseAssumptions({ ...assumptionsSnapshot(), [field]: value }));
}

function updateCapacity(raw: string) {
  if (raw.trim() === "") {
    writeAssumptions(sanitiseAssumptions({ ...assumptionsSnapshot(), capacity: null }));
    return;
  }
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) return;
  writeAssumptions(sanitiseAssumptions({ ...assumptionsSnapshot(), capacity: value }));
}
