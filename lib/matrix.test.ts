import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { parseInventory, type InventoryItem } from "./inventory";
import { buildStockView, inventoryToCsv } from "./matrix";

const seed = JSON.parse(
  readFileSync(new URL("../data/inventory.json", import.meta.url), "utf8"),
);

function item(partial: Partial<InventoryItem> & Pick<InventoryItem, "sku" | "total_count">): InventoryItem {
  return {
    category: partial.category ?? "Bin",
    item: partial.item ?? partial.sku,
    sku: partial.sku,
    color: partial.color ?? "",
    size: partial.size ?? "",
    total_count: partial.total_count,
    locations: partial.locations ?? "",
  };
}

function parsedItems(value: unknown): InventoryItem[] {
  const parsed = parseInventory(value);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return [];
  return parsed.value.items;
}

describe("seed stock matrix", () => {
  const parsed = parseInventory(seed);
  if (!parsed.ok) throw new Error(parsed.error);
  const view = buildStockView(parsed.value.items);

  it("lays wheelie bodies and pooled lids out in catalogue order", () => {
    assert.deepEqual(
      view.wheelie.bodyColumns.map((column) => column.label),
      ["80L", "100L", "120L", "160L", "240L", "360L", "500L", "660L", "1100L"],
    );
    assert.deepEqual(
      view.wheelie.lidColumns.map((column) => column.label),
      ["80/120L", "240L", "360L", "660L", "1100L"],
    );
    assert.deepEqual(
      view.wheelie.rows.map((row) => row.color),
      [
        "Black",
        "Dark Grey",
        "White",
        "Light Blue",
        "Royal Blue",
        "Purple",
        "Red",
        "Orange",
        "Yellow",
        "Lime Green",
        "Shadow Green",
        "Dark Green",
      ],
    );
    assert.equal(view.wheelie.bodyTotal, 1862);
    assert.equal(view.wheelie.lidTotal, 2656);
    assert.equal(view.wheelie.lines, 90);
  });

  it("reads known cells and leaves unsold sizes blank", () => {
    const black = view.wheelie.rows.find((row) => row.color === "Black");
    assert.ok(black);
    assert.equal(black.bodies[0]?.count, 68);
    assert.equal(black.bodies[0]?.level, "in");
    assert.equal(black.bodies[1]?.count, 13);
    assert.equal(black.bodies[1]?.level, "low");
    assert.equal(black.bodies[3], null);
    assert.equal(black.lids[0]?.count, 132);
    assert.equal(black.bodyTotal, 205);
    assert.equal(black.lidTotal, 343);

    const royal = view.wheelie.rows.find((row) => row.color === "Royal Blue");
    assert.equal(royal?.bodies[7], null);
    assert.equal(royal?.bodyTotal, 261);
    assert.equal(royal?.lidTotal, 274);
  });

  it("splits pedal bins from vermin lids and parts", () => {
    assert.deepEqual(
      view.pedal.columns.map((column) => column.label),
      ["80L", "120L", "240L"],
    );
    assert.equal(view.pedal.total, 266);
    assert.equal(
      view.pedal.rows.find((row) => row.color === "Lime Green")?.cells[1]?.count,
      3,
    );
    assert.deepEqual(
      view.vermin.columns.map((column) => column.label),
      ["80/120L", "240L"],
    );
    assert.deepEqual(
      view.vermin.parts.map((part) => part.item.sku),
      ["FLIP-TOPS", "DOME-BINS"],
    );
    assert.equal(view.vermin.total, 197);
    assert.equal(view.other.length, 0);
  });

  it("orders out-or-reorder lines, then running low", () => {
    assert.deepEqual(
      view.attention.urgent.map((line) => `${line.count} ${line.label}`),
      [
        "1 160L bin - Dark Grey",
        "2 500L bin - Dark Grey",
        "2 660L bin - Dark Grey",
        "3 80L bin - Orange",
        "3 660L bin - Orange",
        "3 120L pedal - Lime Green",
        "4 1100L bin - Yellow",
        "5 360L lid - Red",
        "5 1100L lid - Red",
        "5 1100L lid - Lime Green",
      ],
    );
    assert.equal(view.attention.low.length, 17);
    assert.ok(view.attention.low.some((line) => line.label === "100L bin - Black"));
  });
});

describe("derived stock matrix", () => {
  it("pools shared lids, keeps a real zero, and files unknown lines", () => {
    const items = parsedItems({
      updated_at: "2026-10-23T18:03:00",
      meta: { grand_total: 4983 },
      items: [
        item({
          sku: "660L-BIN-ROYAL-BLUE",
          item: "660L Bin Royal Blue",
          color: "Royal Blue",
          size: "660L",
          total_count: -60,
        }),
        item({
          sku: "360L-BIN-RED",
          item: "360L Bin Red",
          color: "Red",
          size: "360L",
          total_count: 0,
        }),
        item({
          category: "Lid",
          sku: "80L-LID-BLACK",
          item: "80L Lid Black",
          color: "Black",
          size: "80L",
          total_count: 4,
        }),
        item({
          category: "Lid",
          sku: "120L-LID-BLACK",
          item: "120L Lid Black",
          color: "Black",
          size: "120L",
          total_count: 6,
        }),
        item({
          category: "Lid",
          sku: "100L-LID-RED",
          item: "100L Lid Red",
          color: "Red",
          size: "100L",
          total_count: 2,
        }),
        item({
          category: "Misc",
          sku: "240L-PEDAL-BIN-RED",
          item: "240L Pedal Bin Red",
          color: "Red",
          size: "240L",
          total_count: 8,
        }),
        item({
          category: "Spare Parts",
          sku: "FLIP-TOPS",
          item: "Flip tops",
          total_count: -2,
        }),
        item({
          category: "Wheels",
          sku: "AXLE-KIT",
          item: "Axle kit",
          total_count: 9,
        }),
        item({
          category: "Bin",
          sku: "BIN-NO-SIZE",
          item: "Bin without a size",
          color: "Black",
          total_count: 4,
        }),
      ],
    });

    const view = buildStockView(items);
    const royal = view.wheelie.rows.find((row) => row.color === "Royal Blue");
    const black = view.wheelie.rows.find((row) => row.color === "Black");
    const red = view.wheelie.rows.find((row) => row.color === "Red");
    assert.equal(royal?.bodies.find((cell) => cell?.count === -60)?.level, "backorder");
    assert.equal(red?.bodies.find((cell) => cell?.items[0]?.sku === "360L-BIN-RED")?.level, "out");
    assert.equal(black?.lids[0]?.count, 10);
    assert.equal(black?.lids[0]?.level, "low");
    assert.equal(black?.lids[0]?.items.length, 2);
    assert.deepEqual(
      view.wheelie.lidColumns.map((column) => column.label),
      ["80/120L", "100L"],
    );
    assert.equal(view.pedal.rows[0]?.cells[0]?.count, 8);
    assert.equal(view.vermin.parts[0]?.item.total_count, -2);
    assert.deepEqual(
      view.other.map((row) => row.sku),
      ["BIN-NO-SIZE", "AXLE-KIT"],
    );
    assert.deepEqual(
      view.attention.urgent.map((line) => line.label),
      [
        "660L bin - Royal Blue",
        "Flip tops",
        "360L bin - Red",
        "100L lid - Red",
        "Bin without a size",
      ],
    );
    assert.deepEqual(
      view.attention.low.map((line) => line.label),
      ["240L pedal - Red", "Axle kit", "80/120L lid - Black"],
    );
  });

  it("quotes csv fields", () => {
    const csv = inventoryToCsv([
      item({
        category: "Bin, large",
        sku: '80L-"BIN"',
        item: "80L Bin",
        color: "Red",
        size: "80L",
        total_count: -60,
      }),
    ]);
    assert.equal(
      csv,
      'category,item,sku,color,size,total_count\n"Bin, large",80L Bin,"80L-""BIN""",Red,80L,-60',
    );
  });
});
