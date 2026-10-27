import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  buildHistoryView,
  coverageSentence,
  daySpan,
  FULL_UNIT_COVERAGE,
  parseHistory,
  presentHistory,
  seasonalityFor,
  yoyChange,
  type History,
} from "./history";
import { parseInventory, type InventoryItem } from "./inventory";
import { DEFAULT_ORDER_ASSUMPTIONS, shiftMonths, tradingDaysInRange } from "./sales";

const raw = JSON.parse(
  readFileSync(new URL("../data/history.sample.json", import.meta.url), "utf8"),
) as Record<string, unknown>;
const seed = JSON.parse(
  readFileSync(new URL("../data/inventory.json", import.meta.url), "utf8"),
);

function history(value: unknown = raw): History {
  const parsed = parseHistory(value);
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.value;
}

function stock(): InventoryItem[] {
  const parsed = parseInventory(seed);
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.value.items;
}

function viewOf(value: History, seasonal = false) {
  return buildHistoryView(value, stock(), "2026-10-27", DEFAULT_ORDER_ASSUMPTIONS, {
    customerWindow: 12,
    seasonal,
  });
}

describe("history sample", () => {
  const parsed = history();
  const view = viewOf(parsed);

  it("accepts schema_version 1 and rejects anything else", () => {
    assert.equal(parsed.schemaVersion, 1);
    assert.equal(parsed.months.length, (raw.monthly as unknown[]).length);
    const bumped = parseHistory({ ...raw, schema_version: 2 });
    assert.equal(bumped.ok, false);
    const missing = parseHistory({ ...raw, schema_version: "1" });
    assert.equal(missing.ok, false);
  });

  it("reads daily rows by column name", () => {
    const daily = raw.daily as { columns: string[]; rows: unknown[][] };
    const reversed = {
      ...raw,
      daily: {
        columns: [...daily.columns].toReversed(),
        rows: daily.rows.map((row) => [...row].toReversed()),
      },
    };
    const flipped = history(reversed);
    assert.equal(flipped.days.length, parsed.days.length);
    assert.equal(flipped.days[0]?.date, parsed.days[0]?.date);
    assert.equal(flipped.days[0]?.salesExGst, parsed.days[0]?.salesExGst);
    assert.equal(flipped.days.at(-1)?.provisional, parsed.days.at(-1)?.provisional);
  });

  it("builds the coverage line from the file fields", () => {
    const sentence = coverageSentence(parsed);
    const units = parsed.coverage.units;
    assert.equal(
      sentence.startsWith(
        `Item details for ${units.invoicesWithUnits?.toLocaleString("en-AU")} of ${units.invoicesTotal?.toLocaleString("en-AU")} invoices`,
      ),
      true,
    );
    assert.match(sentence, /566/);
    assert.match(sentence, /1,758/);
    assert.match(sentence, /in progress from 25 Aug 2026/);
    assert.match(sentence, /584 of 1,787 descriptions/);
    assert.equal(sentence.includes("complete from"), false);
    assert.equal(units.final, false);
    assert.equal(parsed.manifest?.final, false);
    assert.equal(parsed.manifest?.descriptionsDone, 584);
    assert.equal(parsed.manifest?.invoiceCount, 1796);
    assert.deepEqual(units.descriptionAmountsIncGst, ["00007432"]);
    assert.equal(
      parsed.units.some(
        (unit) => unit.colour.toLowerCase() === "green" || unit.colour.toLowerCase() === "grass green",
      ),
      false,
    );
  });

  it("starts the unit window at complete_from_date and keeps low coverage months out", () => {
    const forecast = view.unitForecast;
    assert.ok(forecast);
    assert.equal(forecast.rangeLabel.includes("25 Aug"), true);
    assert.equal(forecast.rangeLabel.includes("27 Oct 2026"), true);
    const start = parsed.coverage.units.completeFromDate;
    assert.ok(start);
    const trading = tradingDaysInRange(start, parsed.period.end);
    assert.equal(forecast.tradingDays, trading);
    assert.equal(forecast.weeks, Math.max(1, Math.round(daySpan(start, parsed.period.end) / 7)));
    assert.equal(forecast.basisLabel, `Based on ${forecast.weeks} weeks, ${forecast.rangeLabel}.`);
    assert.equal(forecast.lowConfidence, trading < 65);
    assert.equal(forecast.lowConfidence, true);
    for (const month of parsed.months) {
      const mentioned = forecast.mixLabel.includes(monthLabel(month.month));
      if (month.unitCoverage != null && month.unitCoverage >= FULL_UNIT_COVERAGE) {
        assert.equal(mentioned, true, month.month);
      }
      if (month.unitCoverage != null && month.unitCoverage < FULL_UNIT_COVERAGE) {
        assert.equal(mentioned, false, month.month);
      }
    }
  });

  it("computes year on year from the same month a year earlier", () => {
    const current = parsed.months.find((month) => {
      const key = shiftMonth(month.month, -12);
      return month.partial && parsed.months.some((row) => row.month === key);
    });
    const prior = parsed.months.find(
      (month) => current != null && month.month === shiftMonth(current.month, -12),
    );
    assert.ok(current && prior);
    const expected = (current.salesExGst - prior.salesExGst) / Math.abs(prior.salesExGst);
    const shown = view.months.find((month) => month.month === current.month);
    assert.equal(shown?.yoy, expected);
    assert.equal(yoyChange(10, 0), null);
    assert.equal(yoyChange(10, null), null);
  });

  it("estimates seasonality from last year against the trailing full months", () => {
    const factor = seasonalityFor(parsed.months, "2026-11");
    assert.ok(factor);
    const lastYear = parsed.months.find((month) => month.month === factor.lastYearMonth);
    assert.ok(lastYear);
    const start = shiftMonth(factor.lastYearMonth, -12);
    const trailing = parsed.months.filter(
      (month) => month.month >= start && month.month < factor.lastYearMonth && !month.partial,
    );
    const average = trailing.reduce((sum, month) => sum + month.salesExGst, 0) / trailing.length;
    assert.equal(factor.factor, lastYear.salesExGst / average);
    assert.equal(factor.fullMonths >= 6, true);
    const adjusted = viewOf(parsed, true);
    assert.equal(adjusted.seasonalApplied, true);
    assert.ok(view.unitForecast && adjusted.unitForecast);
    const plain = view.unitForecast.groups.flatMap((group) => group.lines)[0];
    const scaled = adjusted.unitForecast.groups.flatMap((group) => group.lines)[0];
    assert.ok(plain && scaled);
    assert.equal(scaled.sold, plain.sold);
    assert.ok(Math.abs(scaled.perDay - plain.perDay * factor.factor) < 1e-9);
  });

  it("switches the coverage line when descriptions are final", () => {
    const coverage = raw.coverage as { units: Record<string, unknown> };
    const finished = history({
      ...raw,
      coverage: { ...coverage, units: { ...coverage.units, final: true } },
    });
    const sentence = coverageSentence(finished);
    assert.match(sentence, /complete from 25 Aug 2026/);
    assert.equal(sentence.includes("in progress"), false);
  });

  it("hides customer rows unless they are allowed through", () => {
    assert.equal(presentHistory(parsed, false).customers, null);
    assert.ok((presentHistory(parsed, true).customers?.length ?? 0) > 0);
    const redacted = presentHistory({ ...parsed, customersRedacted: true }, true);
    assert.equal(redacted.customers, null);
    const hidden = viewOf(presentHistory(parsed, false));
    assert.equal(hidden.customers, null);
    const shown = viewOf(presentHistory(parsed, true));
    assert.ok(shown.customers);
    assert.equal(shown.customers.rows.length > 0, true);
    assert.equal(shown.customers.rows.length <= 12, true);
  });
});

describe("history forecast rules", () => {
  it("drops the low confidence note once covered trading days reach three months", () => {
    const parsed = history(synthetic({ completeFrom: "2024-01-02", end: "2026-10-27" }));
    const forecast = viewOf(parsed).unitForecast;
    assert.ok(forecast);
    assert.equal(forecast.rangeLabel.startsWith("27 Apr"), true);
    const start = shiftMonths("2026-10-27", -6);
    assert.equal(tradingDaysInRange(start, "2026-10-27") >= 65, true);
    assert.equal(forecast.lowConfidence, false);
    assert.equal(forecast.tradingDays, tradingDaysInRange(start, "2026-10-27"));
  });

  it("does not treat a low coverage month as part of the unit mix", () => {
    const parsed = history(
      synthetic({
        completeFrom: "2026-09-01",
        end: "2026-09-30",
        extraUnits: [["2026-08", "Bin", "140L", "Red", "wheelie", 1000]],
        months: [month("2026-08", 0.5), month("2026-09", 1)],
        days: [["2026-09-01", 1, 0, 100, 110, 0, 0, 20, 0, 0, 1, "ian", false]],
      }),
    );
    const forecast = viewOf(parsed).unitForecast;
    assert.ok(forecast);
    const lines = forecast.groups.flatMap((group) => group.lines);
    assert.equal(lines.some((line) => line.size === "140L"), false);
    const black = lines.find((line) => line.size === "240L" && line.colour === "Black");
    assert.ok(black);
    assert.equal(black.sold, 20);
  });

  it("keeps non wheelie products out of the container and still orders backorders", () => {
    const parsed = history(
      synthetic({
        completeFrom: "2026-09-01",
        end: "2026-09-30",
        extraUnits: [["2026-09", "Bin", "240L", "Red", "pedal", 4]],
        days: [["2026-09-01", 1, 0, 100, 110, 0, 0, 14, 0, 0, 1, "ian", false]],
      }),
    );
    const items: InventoryItem[] = [
      {
        category: "Bin",
        item: "660L Bin Dark Grey",
        sku: "660L-BIN-DARK-GREY",
        color: "Dark Grey",
        size: "660L",
        total_count: -4,
        locations: "",
      },
    ];
    const forecast = buildHistoryView(parsed, items, "2026-09-15", DEFAULT_ORDER_ASSUMPTIONS, {
      customerWindow: 3,
      seasonal: false,
    }).unitForecast;
    assert.ok(forecast);
    assert.equal(forecast.hasOtherProducts, true);
    const containerSizes = forecast.container.groups.flatMap((group) =>
      group.lines.map((line) => `${line.kind}:${line.size}`),
    );
    assert.equal(containerSizes.some((size) => size.includes("pedal")), false);
    const backorder = forecast.container.groups
      .flatMap((group) => group.lines)
      .find((line) => line.size === "660L");
    assert.ok(backorder);
    assert.equal(backorder.onHand, -4);
    assert.equal(backorder.suggested, 4);
  });
});

function monthLabel(month: string): string {
  return new Intl.DateTimeFormat("en-AU", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1)));
}

function shiftMonth(month: string, delta: number): string {
  const date = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function month(key: string, coverage: number) {
  return {
    month: key,
    partial: false,
    provisional: false,
    days_in_period: 30,
    invoices: 10,
    credit_notes: 1,
    credit_notes_ex_gst: -10,
    sales_ex_gst: 1000,
    sales_incl_gst: 1100,
    freight_ex_gst: 50,
    gross_sales_ex_gst: 1010,
    avg_order_value_ex_gst: 100,
    freight_share: 0.05,
    bins: 10,
    lids: 0,
    parts: 0,
    invoices_with_units: 10,
    unit_coverage: coverage,
    sources: ["myob"],
  };
}

function synthetic(options: {
  completeFrom: string;
  end: string;
  extraUnits?: unknown[][];
  months?: unknown[];
  days?: unknown[][];
}) {
  const columns = [
    "date",
    "invoices",
    "credit_notes",
    "sales_ex_gst",
    "sales_incl_gst",
    "freight_ex_gst",
    "credit_notes_ex_gst",
    "bins",
    "lids",
    "parts",
    "invoices_with_units",
    "source",
    "provisional",
  ];
  return {
    schema_version: 1,
    generated_at: "2026-10-27T00:00:00",
    timezone: "Australia/Brisbane",
    currency: "AUD",
    period: { start: "2024-01-01", end: options.end, myob_end: options.end },
    customers_redacted: false,
    totals: {
      invoices: 10,
      credit_notes: 1,
      sales_ex_gst: 1000,
      sales_incl_gst: 1100,
      freight_ex_gst: 40,
      credit_notes_ex_gst: -10,
      bins: 10,
      lids: 0,
      parts: 0,
    },
    monthly: options.months ?? [month("2026-09", 1)],
    daily: {
      columns,
      rows: options.days ?? [
        ["2026-09-01", 1, 0, 100, 110, 0, 0, 2, 0, 0, 1, "ian", false],
      ],
    },
    customers_monthly: {
      columns: ["month", "customer", "invoices", "credit_notes", "sales_ex_gst"],
      rows: [
        ["2026-09", "North yard", 2, 0, 500],
        ["2026-08", "South yard", 1, 0, 100],
      ],
    },
    units_monthly: {
      columns: ["month", "type", "size", "colour", "kind", "qty"],
      rows: [
        ["2026-09", "Bin", "240L", "Black", "wheelie", 10],
        ...(options.extraUnits ?? []),
      ],
    },
    coverage: {
      units: {
        invoices_with_units: 8,
        invoices_total: 10,
        ratio: 0.8,
        is_complete: false,
        complete_from_date: options.completeFrom,
        invoices_still_to_read: 2,
      },
    },
    checks: { warnings: ["One invoice needs a look."] },
  };
}
