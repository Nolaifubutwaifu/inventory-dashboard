import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { canonicalColour } from "./colours";
import { parseInventory, type InventoryItem } from "./inventory";
import {
  buildSalesView,
  DEFAULT_ORDER_ASSUMPTIONS,
  formatMoney,
  parseSales,
  readOrderAssumptions,
  tradingDaysInRange,
  weekdaysInMonth,
  type OrderAssumptions,
  type Sales,
} from "./sales";

const sample = JSON.parse(
  readFileSync(new URL("../data/sales.sample.json", import.meta.url), "utf8"),
);
const seed = JSON.parse(
  readFileSync(new URL("../data/inventory.json", import.meta.url), "utf8"),
);

const defaults = DEFAULT_ORDER_ASSUMPTIONS;

function sales(value: unknown): Sales {
  const parsed = parseSales(value);
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.value;
}

function stock(value: unknown): InventoryItem[] {
  const parsed = parseInventory(value);
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.value.items;
}

function line<T extends { size: string; colour: string }>(
  groups: { kind: string; lines: T[] }[],
  kind: string,
  size: string,
  colour = "",
): T {
  const found = groups
    .find((group) => group.kind === kind)
    ?.lines.find((row) => row.size === size && row.colour === colour);
  assert.ok(found, `${kind} ${size} ${colour}`);
  return found!;
}

describe("sales fixture", () => {
  const parsed = sales(sample);
  const inventory = stock(seed);
  const view = buildSalesView(parsed, inventory, "2026-10-27", defaults);

  it("parses the office file without rewriting the rows", () => {
    assert.equal(parsed.items.length, 47);
    assert.equal(parsed.totals.length, 6);
    assert.equal(parsed.source, "Brisbins_Daily_Sales_History.xlsx");
    assert.equal(parsed.items[0]?.invoices, "00008102");
    assert.equal(
      parsed.items.some((item) => item.size === "80L/120L" && item.colour === "Black"),
      true,
    );
    assert.equal(parsed.items.find((item) => item.type === "Part")?.colour, "");
  });

  it("totals October from the daily rows and separates bins, lids, and parts", () => {
    assert.equal(view.month.label, "October 2026");
    assert.equal(view.month.rangeLabel, "20-27 Oct 2026");
    assert.equal(view.month.tradingDays, 6);
    assert.equal(view.month.invoices, 14);
    assert.equal(view.month.bins, 45);
    assert.equal(view.month.lids, 45);
    assert.equal(view.month.parts, 41);
    assert.equal(view.month.salesExGst, 12856.34);
    assert.equal(view.month.salesInclGst, 14141.98);
    assert.equal(view.month.freightExGst, 767.88);
    assert.equal(view.month.partial?.label, "27 Oct");
    assert.equal(line(view.month.groups, "bin", "80L", "Lime Green").qty, 5);
    assert.equal(line(view.month.groups, "bin", "120L", "Lime Green").qty, 1);
    assert.equal(line(view.month.groups, "lid", "80/120L", "Yellow").qty, 6);
    assert.equal(line(view.month.groups, "lid", "80/120L", "Black").qty, 4);
    assert.equal(line(view.month.groups, "part", "Rotator plate supply and install").qty, 12);
    assert.deepEqual(
      view.month.groups.map((group) => group.kind),
      ["bin", "lid", "part"],
    );
  });

  it("forecasts November from the 6 calendar trading days, without padding earlier history", () => {
    assert.equal(tradingDaysInRange("2026-10-20", "2026-10-27"), 6);
    assert.equal(weekdaysInMonth(2026, 11), 21);
    assert.equal(view.forecast.tradingDays, 6);
    assert.equal(view.forecast.weekdays, 21);
    assert.equal(view.forecast.monthLabel, "November 2026");
    assert.equal(view.forecast.basisLabel, "Based on 6 trading days, 20-27 Oct 2026.");
    assert.equal(view.forecast.lowConfidence, true);
    assert.equal(view.forecast.partial?.date, "2026-10-27");

    const bin = line(view.forecast.groups, "bin", "660L", "Dark Grey");
    assert.equal(bin.sold, 7);
    assert.ok(Math.abs(bin.perDay - 7 / 6) < 1e-9);
    assert.ok(Math.abs(bin.expected - (7 / 6) * 21) < 1e-9);

    const lid = line(view.forecast.groups, "lid", "80/120L", "Yellow");
    assert.equal(lid.sold, 6);
    assert.equal(lid.expected, 21);
  });

  it("suggests a container from cover demand minus stock, including backorders and shared lids", () => {
    assert.equal(view.container.leadWeeks, 8);
    assert.equal(view.container.coverWeeks, 8);
    assert.equal(view.container.coverTradingDays, 80);
    assert.equal(view.container.capacity, null);

    const bin = line(view.container.groups, "bin", "660L", "Dark Grey");
    assert.equal(bin.matched, true);
    assert.equal(bin.onHand, 2);
    assert.equal(bin.suggested, 92);
    assert.equal(bin.orderQty, 92);

    const yellowLid = line(view.container.groups, "lid", "80/120L", "Yellow");
    assert.equal(yellowLid.onHand, 40);
    assert.equal(yellowLid.suggested, 40);

    const blackLid = line(view.container.groups, "lid", "80/120L", "Black");
    assert.equal(blackLid.onHand, 132);
    assert.equal(blackLid.suggested, 0);

    const part = line(view.container.groups, "part", "Rotator plate supply and install");
    assert.equal(part.matched, false);
    assert.equal(part.onHand, null);
    assert.equal(part.suggested, 160);

    const missingLid = line(view.container.groups, "lid", "500L", "Dark Grey");
    assert.equal(missingLid.matched, false);
    assert.equal(missingLid.suggested, 14);

    assert.equal(view.container.suggested.bins > 0, true);
    assert.equal(view.container.ordered.all, view.container.suggested.all);
    assert.equal(view.container.limited, false);
  });
});

describe("sales maths", () => {
  it("counts trading days from the calendar and keeps a partial day as one day", () => {
    assert.equal(tradingDaysInRange("2026-10-24", "2026-10-25"), 0);
    assert.equal(weekdaysInMonth(2026, 12), 23);
  });

  it("drops history older than 6 months and does not fill the gap", () => {
    const parsed = sales({
      updated_at: "2026-10-27T12:00:00",
      source: "test",
      items: [
        item("2026-01-15", "Bin", "240L", "Red", 50),
        item("2026-04-26", "Bin", "240L", "Red", 9),
        item("2026-10-27", "Bin", "240L", "Red", 2),
      ],
      totals: [
        total("2026-01-15"),
        total("2026-04-26"),
        total("2026-10-27", "Running total for the morning"),
      ],
    });
    const view = buildSalesView(parsed, [], "2026-10-27", defaults);
    assert.equal(view.forecast.tradingDays, 1);
    assert.equal(view.forecast.rangeLabel, "27 Oct 2026");
    assert.equal(line(view.forecast.groups, "bin", "240L", "Red").sold, 2);
    assert.equal(view.forecast.lowConfidence, true);
    assert.match(view.forecast.partial?.notes ?? "", /Running total/);
  });

  it("uses a long window when the file actually covers it", () => {
    const parsed = sales({
      updated_at: "2026-10-27T12:00:00",
      source: "test",
      items: [
        item("2026-04-27", "Bin", "240L", "Red", 3),
        item("2026-10-27", "Bin", "240L", "Red", 1),
      ],
      totals: [total("2026-04-27"), total("2026-10-27")],
    });
    const view = buildSalesView(parsed, [], "2026-10-27", defaults);
    assert.equal(view.forecast.tradingDays, tradingDaysInRange("2026-04-27", "2026-10-27"));
    assert.equal(view.forecast.lowConfidence, false);
    assert.equal(line(view.forecast.groups, "bin", "240L", "Red").sold, 4);
    assert.equal(view.forecast.partial, null);
  });

  it("joins shared lids and colour spellings, and leaves parts unmatched", () => {
    const parsed = sales({
      updated_at: "2026-10-21T10:00:00",
      source: "test",
      items: [
        item("2026-10-21", "Bin", "240L", "Red", 2),
        item("2026-10-21", "Bin", "1100L", "Black", 1),
        item("2026-10-21", "Lid", "80L", "Black", 1),
        item("2026-10-21", "Lid", "120L", "black", 1),
        item("2026-10-21", "Lid", "80L / 120L", "Dark gray", 1),
        item("2026-10-21", "Part", "Axle", "", 4),
      ],
      totals: [total("2026-10-21")],
    });
    const inventory = stock({
      updated_at: "2026-10-21T10:00:00",
      items: [
        sku("Bin", "240L Bin Red", "240L-BIN-RED", "Red", "240L", -3),
        sku("Bin", "1100L Bin Black", "1100L-BIN-BLACK", "Black", "1100L", 100),
        sku("Bin", "360L Bin Orange", "360L-BIN-ORANGE", "Orange", "360L", -4),
        sku("Pedal Bin", "240L Pedal Bin Red", "240L-PEDAL-BIN-RED", "Red", "240L", 50),
        sku("Lid", "80L Lid Black", "80L-LID-BLACK", "Black", "80L", 4),
        sku("Lid", "120L Lid Black", "120L-LID-BLACK", "Black", "120L", 6),
        sku("Lid", "120L Lid Dark Grey", "120L-LID-DARK-GREY", "Dark Grey", "120L", 1),
        sku("Vermin Lid", "120L Vermin Lid Black", "120L-VERMIN-LID-BLACK", "Black", "120L", 9),
        sku("Spare Parts", "Axle", "AXLE", "", "", 30),
      ],
    });
    const assumptions: OrderAssumptions = { leadWeeks: 1, coverWeeks: 1, capacity: 25 };
    const view = buildSalesView(parsed, inventory, "2026-10-21", assumptions);

    assert.equal(view.month.bins, 1);
    assert.equal(line(view.month.groups, "bin", "240L", "Red").qty, 2);

    const red = line(view.container.groups, "bin", "240L", "Red");
    assert.equal(red.onHand, -3);
    assert.equal(red.suggested, 23);
    assert.equal(red.orderQty, 23);

    const covered = line(view.container.groups, "bin", "1100L", "Black");
    assert.equal(covered.suggested, 0);
    assert.equal(covered.orderQty, 0);

    const backorder = line(view.container.groups, "bin", "360L", "Orange");
    assert.equal(backorder.sold, 0);
    assert.equal(backorder.fromBackorder, true);
    assert.equal(backorder.suggested, 4);
    assert.equal(backorder.orderQty, 0);

    const blackLid = line(view.container.groups, "lid", "80/120L", "Black");
    assert.equal(blackLid.sold, 2);
    assert.equal(blackLid.onHand, 10);
    assert.equal(blackLid.suggested, 10);
    assert.equal(blackLid.orderQty, 2);

    const greyLid = line(view.container.groups, "lid", "80/120L", "Dark Grey");
    assert.equal(greyLid.sold, 1);
    assert.equal(greyLid.onHand, 1);
    assert.equal(greyLid.suggested, 9);
    assert.equal(greyLid.orderQty, 0);

    const part = line(view.container.groups, "part", "Axle");
    assert.equal(part.onHand, null);
    assert.equal(part.suggested, 40);
    assert.equal(part.orderQty, 0);

    assert.equal(view.container.ordered.all, 25);
    assert.equal(view.container.limited, true);
    assert.equal(view.container.suggested.all, 23 + 10 + 9 + 4 + 40);
  });

  it("shows an empty month without dropping older history", () => {
    const parsed = sales(sample);
    const view = buildSalesView(parsed, [], "2026-11-02", defaults);
    assert.equal(view.month.hasRows, false);
    assert.equal(view.month.label, "November 2026");
    assert.equal(view.forecast.monthLabel, "December 2026");
    assert.equal(view.forecast.weekdays, 23);
    assert.equal(view.forecast.hasHistory, true);
    assert.equal(view.forecast.tradingDays, 6);
  });

  it("accepts an empty file and rejects a bad row", () => {
    const empty = buildSalesView(
      sales({ updated_at: "2026-10-27T00:00:00", items: [], totals: [] }),
      [],
      "2026-10-27",
      defaults,
    );
    assert.equal(empty.month.hasRows, false);
    assert.equal(empty.forecast.hasHistory, false);
    assert.equal(empty.container.groups.length, 0);

    const badDate = parseSales({
      updated_at: "2026-10-27T00:00:00",
      items: [item("2026-02-31", "Bin", "240L", "Red", 1)],
      totals: [],
    });
    assert.equal(badDate.ok, false);

    const missing = parseSales({ updated_at: "2026-10-27T00:00:00", items: [] });
    assert.equal(missing.ok, false);

    const coerced = sales({
      updated_at: "2026-10-27T00:00:00",
      items: [{ ...item("2026-10-27", "Bin", "240L", "Red", 1), qty: "3" }],
      totals: [{ ...total("2026-10-27"), bins: "2" }],
    });
    assert.equal(coerced.items[0]?.qty, 3);
    assert.equal(coerced.totals[0]?.bins, 2);
  });
});

describe("order assumptions", () => {
  it("defaults to 8 weeks lead, 8 weeks cover, and no capacity", () => {
    assert.deepEqual(readOrderAssumptions(null), {
      leadWeeks: 8,
      coverWeeks: 8,
      capacity: null,
    });
    assert.deepEqual(readOrderAssumptions("{"), defaults);
    assert.deepEqual(readOrderAssumptions(JSON.stringify({ leadWeeks: 6, coverWeeks: 4, capacity: 120 })), {
      leadWeeks: 6,
      coverWeeks: 4,
      capacity: 120,
    });
    assert.equal(formatMoney(12856.34), "$12,856.34");
    assert.equal(canonicalColour("Dark gray"), "Dark Grey");
    assert.equal(canonicalColour("Lime  green"), "Lime Green");
  });
});

function item(date: string, type: string, size: string, colour: string, qty: number) {
  return { date, type, size, colour, qty, invoices: "" };
}

function total(date: string, notes = "") {
  return {
    date,
    invoices: 1,
    bins: 1,
    lids: 0,
    parts: 0,
    sales_ex_gst: 10,
    sales_incl_gst: 11,
    freight_ex_gst: 1,
    notes,
  };
}

function sku(
  category: string,
  itemName: string,
  code: string,
  color: string,
  size: string,
  totalCount: number,
) {
  return {
    category,
    item: itemName,
    sku: code,
    color,
    size,
    total_count: totalCount,
  };
}
