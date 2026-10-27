"use client";

import { useState, type ReactNode } from "react";
import { ColourName } from "@/components/count-chip";
import {
  CUSTOMER_WINDOWS,
  formatShare,
  formatSignedPercent,
  type CustomerWindow,
  type HistoryView,
  type RateGroup,
  type UnitGroup,
  type UnitMonthView,
} from "@/lib/history";
import { formatNumber } from "@/lib/inventory";
import {
  formatMoney,
  formatQty,
  type LineGroup,
  type OrderAssumptions,
  type SuggestionLine,
} from "@/lib/sales";

type HistoryInsightsProps = {
  view: HistoryView;
  assumptions: OrderAssumptions;
  customerWindow: CustomerWindow;
  onCustomerWindow: (window: CustomerWindow) => void;
  seasonal: boolean;
  onSeasonal: () => void;
  onLeadWeeks: (value: number) => void;
  onCoverWeeks: (value: number) => void;
  onCapacity: (raw: string) => void;
  salesLoaded: boolean;
};

export function HistoryInsights({
  view,
  assumptions,
  customerWindow,
  onCustomerWindow,
  seasonal,
  onSeasonal,
  onLeadWeeks,
  onCoverWeeks,
  onCapacity,
  salesLoaded,
}: HistoryInsightsProps) {
  return (
    <>
      {view.currentMonth ? <SoldMonth month={view.currentMonth} /> : null}
      <HistorySummary view={view} />
      <Seasonality view={view} />
      {view.customers ? (
        <Customers
          label={view.customers.label}
          rows={view.customers.rows}
          window={customerWindow}
          onWindow={onCustomerWindow}
        />
      ) : null}
      <Units view={view} />
      {view.unitForecast ? (
        <Forecast
          view={view}
          assumptions={assumptions}
          seasonal={seasonal}
          onSeasonal={onSeasonal}
          onLeadWeeks={onLeadWeeks}
          onCoverWeeks={onCoverWeeks}
          onCapacity={onCapacity}
        />
      ) : !salesLoaded && view.moneyForecast ? (
        <MoneyOnly view={view} seasonal={seasonal} onSeasonal={onSeasonal} />
      ) : null}
    </>
  );
}

function SoldMonth({ month }: { month: NonNullable<HistoryView["currentMonth"]> }) {
  return (
    <section
      id="sold-this-month"
      className="rounded-2xl border border-neutral-200 bg-white px-4 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:px-5"
    >
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <h2 className="text-[15px] font-semibold text-neutral-900">Sold this month</h2>
        <p className="text-[12.5px] text-neutral-500">{month.label}</p>
      </div>
      <p className="mt-2 text-[13px] text-neutral-600">
        {formatNumber(month.daysInPeriod)} {month.daysInPeriod === 1 ? "day" : "days"} in this period.
      </p>
      {month.partial ? (
        <p className="mt-1 text-[13px] text-neutral-600">
          This month is partial, so the total can still change.
        </p>
      ) : null}
      {month.provisional ? (
        <p className="mt-1 text-[13px] text-neutral-600">This month is provisional.</p>
      ) : null}
      <p className="mt-1 text-[13px] text-neutral-600">
        {month.yoy == null || !month.priorLabel
          ? "No same month last year is in this file."
          : `${month.priorLabel} compared with this month: ${formatSignedPercent(month.yoy)} ex GST.`}
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Invoices" value={formatNumber(month.invoices)} />
        <Stat label="Credit notes" value={formatNumber(month.creditNotes)} />
        <Stat label="Bins" value={formatNumber(month.bins)} />
        <Stat label="Lids" value={formatNumber(month.lids)} />
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        <Stat label="Sales ex GST" value={formatMoney(month.salesExGst)} />
        <Stat label="Average order" value={month.avgOrderValueExGst == null ? "n/a" : formatMoney(month.avgOrderValueExGst)} />
        <Stat label="Freight share" value={month.freightShare == null ? "n/a" : formatShare(month.freightShare)} />
      </div>
      {month.groups.length > 0 ? (
        <div className={`mt-4 flex flex-col gap-4 ${month.fullUnitCoverage ? "" : "opacity-60"}`}>
          {!month.fullUnitCoverage ? (
            <p className="text-[13px] font-medium text-neutral-500">
              {month.coverageLabel}. These item quantities are not the full month.
            </p>
          ) : null}
          {month.groups.map((group) => (
            <UnitTable key={group.title} group={group} />
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-neutral-500">No item rows for this month.</p>
      )}
    </section>
  );
}

function HistorySummary({ view }: { view: HistoryView }) {
  return (
    <section
      id="sales-by-month"
      className="rounded-2xl border border-neutral-200 bg-white px-4 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:px-5"
    >
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <h2 className="text-[15px] font-semibold text-neutral-900">Sales by month</h2>
        <p className="text-[12.5px] text-neutral-500">{view.periodLabel}</p>
      </div>
      <p className="mt-2 text-[13px] leading-relaxed text-neutral-600">
        Net sales ex GST, including freight. Credit notes reduce the total. Average order value is
        net sales ex GST divided by invoices.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Invoices" value={formatNumber(view.totals.invoices)} />
        <Stat label="Credit notes" value={formatNumber(view.totals.creditNotes)} />
        <Stat label="Sales ex GST" value={formatMoney(view.totals.salesExGst)} />
        <Stat
          label="Average order"
          value={view.averageOrderValue == null ? "n/a" : formatMoney(view.averageOrderValue)}
        />
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <Stat
          label="Freight share"
          value={view.freightShare == null ? "n/a" : formatShare(view.freightShare)}
        />
        <Stat label="Credit notes ex GST" value={formatMoney(view.totals.creditNotesExGst)} />
      </div>
      {view.warnings.map((warning) => (
        <p key={warning} className="mt-3 text-[13px] leading-relaxed text-neutral-600">
          {warning}
        </p>
      ))}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[44rem] border-separate border-spacing-0 text-left">
          <caption className="sr-only">Sales by month</caption>
          <thead>
            <tr>
              {["Month", "Invoices", "Credits", "Sales ex GST", "Vs last year", "Average order", "Freight", "Items"].map(
                (column, index) => (
                  <th
                    key={column}
                    scope="col"
                    className={`pb-1 text-[11px] font-medium text-neutral-500 ${index === 0 ? "pr-3 text-left" : "text-right"}`}
                  >
                    {column}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {view.months.map((month) => (
              <tr key={month.month} className={month.partial || month.provisional ? "text-neutral-600" : ""}>
                <th scope="row" className="py-1.5 pr-3 text-left text-[13px] font-medium text-neutral-800">
                  {month.label}{" "}
                  {month.partial ? <Badge>Partial</Badge> : null}{" "}
                  {month.provisional ? <Badge>Provisional</Badge> : null}
                </th>
                <Qty value={formatNumber(month.invoices)} />
                <Qty value={formatNumber(month.creditNotes)} />
                <Qty value={formatMoney(month.salesExGst)} />
                <Qty
                  value={month.yoy == null ? "No prior year" : formatSignedPercent(month.yoy)}
                  tone={month.yoy != null && month.yoy < 0 ? "negative" : "plain"}
                />
                <Qty value={month.avgOrderValueExGst == null ? "n/a" : formatMoney(month.avgOrderValueExGst)} />
                <Qty value={month.freightShare == null ? "n/a" : formatShare(month.freightShare)} />
                <Qty value={month.fullUnitCoverage ? "Full" : (month.coverageLabel ?? "n/a")} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Seasonality({ view }: { view: HistoryView }) {
  const max = Math.max(...view.seasonality.map((bar) => bar.average ?? 0), 1);
  const factor = view.seasonalityFactor;
  return (
    <section
      id="seasonality"
      className="rounded-2xl border border-neutral-200 bg-white px-4 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:px-5"
    >
      <h2 className="text-[15px] font-semibold text-neutral-900">Seasonality</h2>
      <p className="mt-2 text-[13px] leading-relaxed text-neutral-600">
        Average sales ex GST for each month of the year. Partial months are left out of the average.
      </p>
      <div className="mt-4 flex h-36 items-end gap-1">
        {view.seasonality.map((bar) => (
          <div key={bar.month} className="flex h-full min-w-0 flex-1 flex-col justify-end">
            <div
              className={`w-full rounded-t ${bar.average == null ? "bg-neutral-200" : "bg-neutral-800"}`}
              style={{
                height: bar.average == null ? "2px" : `${Math.max(4, (bar.average / max) * 100)}%`,
              }}
            />
            <p className="mt-1 text-center text-[10px] text-neutral-500">{bar.label.slice(0, 3)}</p>
          </div>
        ))}
      </div>
      <ul className="mt-3 grid gap-1 sm:grid-cols-2">
        {view.seasonality.map((bar) => (
          <li key={bar.month} className="text-[12.5px] text-neutral-600">
            {bar.label}:{" "}
            {bar.average == null
              ? "partial only"
              : `${formatMoney(bar.average)} across ${formatNumber(bar.years)} full ${bar.years === 1 ? "year" : "years"}`}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[13px] leading-relaxed text-neutral-600">
        {factor
          ? `${factor.lastYearLabel} was ${formatSignedPercent(factor.factor - 1)} compared with the average of the ${formatNumber(factor.fullMonths)} full months before it (${formatMoney(factor.trailingAverage)}).`
          : "There is not yet a full same month last year, with at least 6 full months before it, to estimate a seasonal adjustment."}
      </p>
    </section>
  );
}

function Customers({
  label,
  rows,
  window,
  onWindow,
}: {
  label: string;
  rows: NonNullable<HistoryView["customers"]>["rows"];
  window: CustomerWindow;
  onWindow: (window: CustomerWindow) => void;
}) {
  return (
    <section
      id="top-customers"
      className="rounded-2xl border border-neutral-200 bg-white px-4 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:px-5"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-[15px] font-semibold text-neutral-900">Top customers</h2>
        <div className="flex flex-wrap gap-2">
          {CUSTOMER_WINDOWS.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={window === value}
              onClick={() => onWindow(value)}
              className={
                window === value
                  ? "rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white"
                  : "rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
              }
            >
              {value} months
            </button>
          ))}
        </div>
      </div>
      <p className="mt-2 text-[13px] text-neutral-600">{label}</p>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-neutral-500">No customer sales in this window.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[28rem] border-separate border-spacing-0">
            <caption className="sr-only">Top customers</caption>
            <thead>
              <tr>
                {["Customer", "Invoices", "Credit notes", "Sales ex GST"].map((column, index) => (
                  <th
                    key={column}
                    scope="col"
                    className={`pb-1 text-[11px] font-medium text-neutral-500 ${index === 0 ? "pr-3 text-left" : "text-right"}`}
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.customer}>
                  <th scope="row" className="py-1.5 pr-3 text-left text-[13px] font-medium text-neutral-800">
                    {row.customer}
                  </th>
                  <Qty value={formatNumber(row.invoices)} />
                  <Qty value={formatNumber(row.creditNotes)} />
                  <Qty value={formatMoney(row.salesExGst)} strong />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Units({ view }: { view: HistoryView }) {
  const months = view.unitMonths;
  const [picked, setPicked] = useState<string | null>(null);
  const selected = months.find((month) => month.month === picked) ?? months[months.length - 1] ?? null;
  return (
    <section
      id="item-details"
      className="rounded-2xl border border-neutral-200 bg-white px-4 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:px-5"
    >
      <h2 className="text-[15px] font-semibold text-neutral-900">Bins and lids by size</h2>
      <p className="mt-2 text-[13px] font-medium leading-relaxed text-neutral-800">{view.coverageText}</p>
      {view.descriptionAmountNote ? (
        <p className="mt-1 text-[13px] leading-relaxed text-neutral-600">{view.descriptionAmountNote}</p>
      ) : null}
      <p className="mt-1 text-[13px] leading-relaxed text-neutral-600">
        A month is marked incomplete unless its item coverage is full. Quantities in those months
        are greyed, because they are only the invoices that have item details.
      </p>
      {selected == null ? (
        <p className="mt-3 text-sm text-neutral-500">No item rows in this file yet.</p>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap gap-2">
            {months.map((month) => (
              <button
                key={month.month}
                type="button"
                aria-pressed={month.month === selected.month}
                onClick={() => setPicked(month.month)}
                className={chipClass(month, month.month === selected.month)}
              >
                {month.label}
                {month.full ? "" : ` · ${month.coverageLabel}`}
              </button>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {selected.partial ? <Badge>Partial</Badge> : null}
            {selected.provisional ? <Badge>Provisional</Badge> : null}
            {selected.full ? <Badge>Full item coverage</Badge> : null}
          </div>
          {!selected.full ? (
            <p className="mt-2 text-[13px] font-medium text-neutral-500">
              {selected.coverageLabel}. These quantities are not the full month.
            </p>
          ) : null}
          <div className={`mt-4 flex flex-col gap-4 ${selected.full ? "" : "opacity-60"}`}>
            {selected.groups.map((group) => (
              <UnitTable key={group.title} group={group} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function Forecast({
  view,
  assumptions,
  seasonal,
  onSeasonal,
  onLeadWeeks,
  onCoverWeeks,
  onCapacity,
}: {
  view: HistoryView;
  assumptions: OrderAssumptions;
  seasonal: boolean;
  onSeasonal: () => void;
  onLeadWeeks: (value: number) => void;
  onCoverWeeks: (value: number) => void;
  onCapacity: (raw: string) => void;
}) {
  const forecast = view.unitForecast;
  const money = view.moneyForecast;
  if (!forecast) return null;
  return (
    <>
      <section
        id="expected-sales"
        className="rounded-2xl border border-neutral-200 bg-white px-4 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:px-5"
      >
        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
          <h2 className="text-[15px] font-semibold text-neutral-900">Expected sales next month</h2>
          <p className="text-[12.5px] text-neutral-500">{forecast.monthLabel}</p>
        </div>
        <p className="mt-2 text-sm font-medium text-neutral-800">{forecast.basisLabel}</p>
        <p className="mt-2 text-[13px] leading-relaxed text-neutral-600">
          That span is {formatNumber(forecast.tradingDays)} trading{" "}
          {forecast.tradingDays === 1 ? "day" : "days"}. Item rates use only those days, and only
          months with full item coverage. The window is at most the last 6 months. Weekends are not
          trading days, and a weekday with no row counts as zero.
        </p>
        <p className="mt-2 text-[13px] leading-relaxed text-neutral-600">{forecast.mixLabel}</p>
        {forecast.lowConfidence ? (
          <p className="mt-2 rounded-lg bg-[#fff7ed] px-3 py-2 text-[13px] leading-relaxed text-[#9a3412]">
            Low confidence. This item history is under 3 months, so treat the forecast as a rough guide.
          </p>
        ) : null}
        {forecast.provisionalLabel ? (
          <p className="mt-2 text-[13px] leading-relaxed text-neutral-600">
            {forecast.provisionalLabel} is marked provisional, so that day can still change. It still
            counts as one trading day.
          </p>
        ) : null}
        <SeasonToggle view={view} seasonal={seasonal} onSeasonal={onSeasonal} />
        {money ? (
          <p className="mt-3 text-[13px] leading-relaxed text-neutral-700">
            Expected sales ex GST in {money.monthLabel}: {formatMoney(money.expectedExGst)}.{" "}
            {money.basisLabel}
          </p>
        ) : null}
        {forecast.hasOtherProducts ? (
          <p className="mt-2 text-[13px] leading-relaxed text-neutral-600">
            Products that are not wheelie bins, wheelie lids, or parts are listed here and are not
            added to the container list.
          </p>
        ) : null}
        <div className="mt-4 flex flex-col gap-4">
          {forecast.groups.map((group) => (
            <RateTable key={group.title} group={group} weekdays={forecast.weekdays} monthLabel={forecast.monthLabel} />
          ))}
        </div>
      </section>
      <Container
        container={forecast.container}
        assumptions={assumptions}
        onLeadWeeks={onLeadWeeks}
        onCoverWeeks={onCoverWeeks}
        onCapacity={onCapacity}
      />
    </>
  );
}

function MoneyOnly({
  view,
  seasonal,
  onSeasonal,
}: {
  view: HistoryView;
  seasonal: boolean;
  onSeasonal: () => void;
}) {
  const money = view.moneyForecast;
  if (!money) return null;
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white px-4 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:px-5">
      <h2 className="text-[15px] font-semibold text-neutral-900">Expected sales next month</h2>
      <p className="mt-2 text-[13px] leading-relaxed text-neutral-700">
        Expected sales ex GST in {money.monthLabel}: {formatMoney(money.expectedExGst)}. {money.basisLabel}
      </p>
      <p className="mt-2 text-[13px] leading-relaxed text-neutral-600">
        Item coverage is not full for long enough to forecast bins and lids from this file, and no
        daily sales file is loaded for the container list.
      </p>
      <SeasonToggle view={view} seasonal={seasonal} onSeasonal={onSeasonal} />
    </section>
  );
}

function SeasonToggle({
  view,
  seasonal,
  onSeasonal,
}: {
  view: HistoryView;
  seasonal: boolean;
  onSeasonal: () => void;
}) {
  const factor = view.seasonalityFactor;
  return (
    <div className="mt-3">
      <button
        type="button"
        aria-pressed={seasonal && factor != null}
        disabled={factor == null}
        onClick={onSeasonal}
        className={
          seasonal && factor != null
            ? "rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white"
            : "rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 disabled:text-neutral-400"
        }
      >
        {seasonal && factor != null ? "Seasonal adjustment on" : "Seasonal adjustment off"}
      </button>
      {view.seasonalApplied ? (
        <p className="mt-2 text-[13px] leading-relaxed text-neutral-600">
          The daily rate and the container quantities are scaled by that ratio. Sold quantities stay
          as recorded.
        </p>
      ) : null}
    </div>
  );
}

function Container({
  container,
  assumptions,
  onLeadWeeks,
  onCoverWeeks,
  onCapacity,
}: {
  container: NonNullable<HistoryView["unitForecast"]>["container"];
  assumptions: OrderAssumptions;
  onLeadWeeks: (value: number) => void;
  onCoverWeeks: (value: number) => void;
  onCapacity: (raw: string) => void;
}) {
  return (
    <section
      id="next-container"
      className="rounded-2xl border border-neutral-200 bg-white px-4 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:px-5"
    >
      <h2 className="text-[15px] font-semibold text-neutral-900">Next container suggestion</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <NumberField id="lead-weeks" label="Lead time (weeks)" value={assumptions.leadWeeks} onChange={onLeadWeeks} />
        <NumberField
          id="cover-weeks"
          label="Cover after arrival (weeks)"
          value={assumptions.coverWeeks}
          onChange={onCoverWeeks}
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
            onChange={(event) => onCapacity(event.target.value)}
            className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm font-normal text-neutral-900"
          />
        </label>
      </div>
      <div className="mt-3 space-y-2 text-[13px] leading-relaxed text-neutral-600">
        <p>
          Cover is {formatNumber(container.totalWeeks)} weeks: {formatNumber(container.leadWeeks)} weeks
          lead time plus {formatNumber(container.coverWeeks)} weeks after arrival. That is{" "}
          {formatNumber(container.coverTradingDays)} trading days, at 5 trading days a week. Suggested
          quantity is demand over that cover, minus stock on hand. A backorder adds to the amount. The
          result is never below 0, and it is rounded up to a whole unit.
        </p>
        <p>
          {container.capacity == null ? (
            "Container capacity is not set, so this list is not capped."
          ) : (
            <>
              Container capacity is {formatNumber(container.capacity)} units.
              {container.limited
                ? ` ${formatNumber(container.ordered.all)} units fit. The largest gaps are kept first, and parts come after bins and lids.`
                : " The suggested units fit in that capacity."}
            </>
          )}
        </p>
        <p>
          80L and 120L lids are one shared lid, shown as 80/120L. Colour matching ignores capitals and
          extra spaces. Parts are listed by name and are not matched to stock, so stock is not
          subtracted. A bin or lid that is not in the stock file counts as 0 on hand. Backorders with
          no sales in this window are still listed.
        </p>
        <p className="font-medium text-neutral-800">
          Suggested total: {formatNumber(container.suggested.all)} units (
          {formatNumber(container.suggested.bins)} bins, {formatNumber(container.suggested.lids)} lids,{" "}
          {formatNumber(container.suggested.parts)} parts).
          {container.capacity != null
            ? ` In this container: ${formatNumber(container.ordered.all)} units.`
            : ""}
        </p>
      </div>
      {container.groups.length === 0 ? (
        <p className="mt-3 text-sm text-neutral-500">Nothing to suggest from the current file.</p>
      ) : (
        <div className="mt-4 flex flex-col gap-4">
          {container.groups.map((group) => (
            <SuggestionTable key={group.kind} group={group} showOrder={container.capacity != null} />
          ))}
        </div>
      )}
    </section>
  );
}

function chipClass(month: UnitMonthView, selected: boolean): string {
  if (selected) return "rounded-lg bg-neutral-900 px-3 py-1.5 text-left text-sm font-medium text-white";
  if (!month.full) {
    return "rounded-lg border border-dashed border-neutral-300 bg-neutral-50 px-3 py-1.5 text-left text-sm font-medium text-neutral-400";
  }
  return "rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-left text-sm font-medium text-neutral-700 hover:bg-neutral-50";
}

function UnitTable({ group }: { group: UnitGroup }) {
  return (
    <LineTable title={group.title} columns={group.named ? ["Name", "Qty"] : ["Size", "Colour", "Qty"]}>
      {group.lines.map((row) => (
        <tr key={row.id}>
          {group.named ? (
            <td className="py-1.5 pr-3 text-[13px] text-neutral-800">{row.size}</td>
          ) : (
            <>
              <td className="py-1.5 pr-3 text-[13px] font-medium whitespace-nowrap text-neutral-800">{row.size}</td>
              <td className="py-1.5 pr-3">
                {row.colour ? <ColourName color={row.colour} /> : <span className="text-[13px] text-neutral-400">None</span>}
              </td>
            </>
          )}
          <Qty value={formatQty(row.qty)} />
        </tr>
      ))}
    </LineTable>
  );
}

function RateTable({
  group,
  weekdays,
  monthLabel,
}: {
  group: RateGroup;
  weekdays: number;
  monthLabel: string;
}) {
  const columns = group.named
    ? ["Name", "Sold", "Per trading day", monthLabel]
    : ["Size", "Colour", "Sold", "Per trading day", monthLabel];
  return (
    <LineTable title={group.title} columns={columns}>
      {group.lines.map((row) => (
        <tr key={row.id}>
          {group.named ? (
            <td className="py-1.5 pr-3 text-[13px] text-neutral-800">{row.size}</td>
          ) : (
            <>
              <td className="py-1.5 pr-3 text-[13px] font-medium whitespace-nowrap text-neutral-800">{row.size}</td>
              <td className="py-1.5 pr-3">
                {row.colour ? <ColourName color={row.colour} /> : <span className="text-[13px] text-neutral-400">None</span>}
              </td>
            </>
          )}
          <Qty value={formatQty(row.sold)} />
          <Qty value={formatQty(row.perDay)} />
          <Qty value={formatQty(row.perDay * weekdays)} strong />
        </tr>
      ))}
    </LineTable>
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
              <td className="py-1.5 pr-3 text-[13px] font-medium whitespace-nowrap text-neutral-800">{row.size}</td>
              <td className="py-1.5 pr-3">
                {row.colour ? <ColourName color={row.colour} /> : <span className="text-[13px] text-neutral-400">None</span>}
              </td>
            </>
          )}
          <Qty value={formatQty(row.sold)} />
          <td
            className={`py-1.5 text-right text-[13px] tabular-nums ${row.onHand != null && row.onHand < 0 ? "font-semibold text-[#6e1d24]" : "text-neutral-700"}`}
          >
            {row.onHand == null ? "Not matched" : row.matched ? formatNumber(row.onHand) : "Not in file"}
          </td>
          <Qty value={formatQty(row.coverDemand)} />
          <Qty value={formatNumber(row.suggested)} strong />
          {showOrder ? <Qty value={formatNumber(row.orderQty)} strong /> : null}
        </tr>
      ))}
    </LineTable>
  );
}

function LineTable({ title, columns, children }: { title: string; columns: string[]; children: ReactNode }) {
  const labels = columns[0] === "Name" || columns[0] === "Month" || columns[0] === "Customer" ? 1 : 2;
  return (
    <div className="overflow-x-auto">
      <h3 className="text-[12px] font-semibold tracking-wide text-neutral-400 uppercase">{title}</h3>
      <table className="mt-1 w-full min-w-[28rem] border-separate border-spacing-0">
        <caption className="sr-only">{title}</caption>
        <thead>
          <tr>
            {columns.map((column, index) => (
              <th
                key={column}
                scope="col"
                className={`pb-1 text-[11px] font-medium text-neutral-500 ${index < labels ? "pr-3 text-left" : "text-right"}`}
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
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

function Badge({ children }: { children: string }) {
  return (
    <span className="rounded-md bg-neutral-100 px-1.5 py-0.5 text-[11px] font-medium text-neutral-600">
      {children}
    </span>
  );
}

function Qty({
  value,
  strong,
  tone = "plain",
}: {
  value: string;
  strong?: boolean;
  tone?: "plain" | "negative";
}) {
  return (
    <td
      className={`py-1.5 text-right text-[13px] tabular-nums ${tone === "negative" ? "font-semibold text-[#6e1d24]" : strong ? "font-semibold text-neutral-900" : "text-neutral-700"}`}
    >
      {value}
    </td>
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
