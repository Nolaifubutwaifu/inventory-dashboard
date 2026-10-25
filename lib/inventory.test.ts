import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { bearerAuthorised } from "./auth";
import { blobAccess, blobConfigured } from "./blob-config";
import {
  categorySummaries,
  filterItems,
  formatCountedAt,
  formatUpdatedAt,
  lowStockCount,
  onHandTotal,
  parseInventory,
  sortItems,
  stockLevel,
  totalCount,
} from "./inventory";

const seed = JSON.parse(
  readFileSync(new URL("../data/inventory.json", import.meta.url), "utf8"),
);

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

describe("seed inventory", () => {
  it("parses the shipped stocktake", () => {
    const parsed = parseInventory(seed);
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.value.items.length, 109);
    assert.equal(totalCount(parsed.value.items), 4981);
    assert.equal(parsed.value.meta.grand_total, 4983);
    assert.equal(lowStockCount(parsed.value.items), 10);
    const totals = categorySummaries(parsed.value.items);
    assert.deepEqual(
      totals.map((row) => row.category),
      ["Bin", "Lid", "Pedal Bin", "Vermin Lid", "Spare Parts"],
    );
    assert.equal(
      totals.reduce((sum, row) => sum + row.total, 0),
      4981,
    );
  });
});

describe("parseInventory", () => {
  it("rejects a payload without items", () => {
    const parsed = parseInventory({ updated_at: "2026-10-23T14:21:56" });
    assert.equal(parsed.ok, false);
  });

  it("coerces numeric strings and keeps an empty colour", () => {
    const parsed = parseInventory({
      updated_at: "2026-10-23T14:21:56",
      source: "test",
      items: [
        {
          category: "Spare Parts",
          item: "Dome bins",
          sku: "DOME-BINS",
          total_count: "18",
        },
      ],
    });
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.value.items[0]?.total_count, 18);
    assert.equal(parsed.value.items[0]?.color, "");
    assert.equal(parsed.value.items[0]?.locations, "");
  });

  it("accepts a negative backorder and a negative sheet total", () => {
    const parsed = parseInventory({
      updated_at: "2026-10-23T14:21:56",
      meta: { grand_total: "-60" },
      items: [
        {
          category: "Bin",
          item: "660L Bin Royal Blue",
          sku: "660L-BIN-ROYAL-BLUE",
          color: "Royal Blue",
          size: "660L",
          total_count: -60,
        },
      ],
    });
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.value.items[0]?.total_count, -60);
    assert.equal(parsed.value.meta.grand_total, -60);
    assert.equal(onHandTotal(parsed.value), -60);
    assert.equal(totalCount(parsed.value.items), -60);
  });

  it("rounds a negative decimal and keeps the inclusive bounds", () => {
    const parsed = parseInventory({
      updated_at: "2026-10-23T14:21:56",
      meta: { grand_total: -1_000_000 },
      items: [
        {
          category: "Bin",
          item: "Edge",
          sku: "EDGE",
          total_count: "-1.2",
        },
        {
          category: "Bin",
          item: "Top",
          sku: "TOP",
          total_count: 1_000_000,
        },
      ],
    });
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.value.items[0]?.total_count, -1);
    assert.equal(parsed.value.items[1]?.total_count, 1_000_000);
    assert.equal(parsed.value.meta.grand_total, -1_000_000);
  });

  it("rejects counts outside -1000000 to 1000000", () => {
    const below = parseInventory({
      updated_at: "2026-10-23T14:21:56",
      items: [
        {
          category: "Bin",
          item: "Bad",
          sku: "BAD",
          total_count: -1_000_001,
        },
      ],
    });
    assert.equal(below.ok, false);
    if (!below.ok) assert.match(below.error, /total_count/);

    const above = parseInventory({
      updated_at: "2026-10-23T14:21:56",
      meta: { grand_total: 1_000_000.1 },
      items: [
        {
          category: "Bin",
          item: "Bad",
          sku: "BAD",
          total_count: 1,
        },
      ],
    });
    assert.equal(above.ok, false);
    if (!above.ok) assert.match(above.error, /grand_total/);
  });

  it("still rejects a count that is not a number", () => {
    const parsed = parseInventory({
      updated_at: "2026-10-23T14:21:56",
      items: [
        {
          category: "Bin",
          item: "Bad",
          sku: "BAD",
          total_count: "minus sixty",
        },
      ],
    });
    assert.equal(parsed.ok, false);
  });
});

describe("on hand total", () => {
  it("prefers the sheet grand total, including zero", () => {
    const parsed = parseInventory(seed);
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(onHandTotal(parsed.value), 4983);
    parsed.value.meta.grand_total = 0;
    assert.equal(onHandTotal(parsed.value), 0);
    parsed.value.meta.grand_total = null;
    assert.equal(onHandTotal(parsed.value), 4981);
  });
});

describe("stock level", () => {
  it("separates backorder, out of stock, reorder, and low", () => {
    assert.equal(stockLevel(-60), "backorder");
    assert.equal(stockLevel(0), "out");
    assert.equal(stockLevel(1), "reorder");
    assert.equal(stockLevel(5), "reorder");
    assert.equal(stockLevel(6), "low");
    assert.equal(stockLevel(15), "low");
    assert.equal(stockLevel(16), "in");
  });
});

describe("formatUpdatedAt", () => {
  it("formats a naive timestamp without shifting it", () => {
    assert.equal(formatUpdatedAt("2026-10-23T14:21:56"), "23 Oct 2026, 2:21 pm");
    assert.equal(formatCountedAt("2026-10-23T14:21:56"), "23 Oct, 2:21 pm");
  });

  it("formats a zoned timestamp in Brisbane", () => {
    const formatted = formatUpdatedAt("2026-10-23T04:21:56Z");
    assert.match(formatted, /23 Oct 2026/);
    assert.match(formatted, /2:21/);
    assert.match(formatted, /pm/i);
  });
});

describe("filters", () => {
  it("matches colour and low stock together", () => {
    const parsed = parseInventory(seed);
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    const rows = filterItems(parsed.value.items, "yellow", "Bin", true);
    assert.ok(rows.every((row) => row.category === "Bin"));
    assert.ok(rows.every((row) => row.total_count <= 5));
    assert.ok(rows.some((row) => row.sku === "1100L-BIN-YELLOW"));
    const sorted = sortItems(rows, "count", "asc");
    assert.equal(sorted[0]?.sku, "1100L-BIN-YELLOW");
  });
});

describe("update auth", () => {
  it("accepts only the exact bearer secret", () => {
    assert.equal(bearerAuthorised("Bearer warehouse-secret", "warehouse-secret"), true);
    assert.equal(bearerAuthorised("Bearer warehouse-secret", "other"), false);
    assert.equal(bearerAuthorised("bearer warehouse-secret", "warehouse-secret"), false);
    assert.equal(bearerAuthorised(null, "warehouse-secret"), false);
    assert.equal(bearerAuthorised("Bearer warehouse-secret", undefined), false);
  });
});

describe("blob config", () => {
  it("defaults to a private store and notices a token", () => {
    const previousAccess = process.env.BLOB_ACCESS;
    const previousToken = process.env.BLOB_READ_WRITE_TOKEN;
    const previousStore = process.env.BLOB_STORE_ID;
    delete process.env.BLOB_ACCESS;
    delete process.env.BLOB_READ_WRITE_TOKEN;
    delete process.env.BLOB_STORE_ID;
    try {
      assert.equal(blobAccess(), "private");
      assert.equal(blobConfigured(), false);
      process.env.BLOB_ACCESS = "public";
      process.env.BLOB_READ_WRITE_TOKEN = "token";
      assert.equal(blobAccess(), "public");
      assert.equal(blobConfigured(), true);
      process.env.BLOB_ACCESS = "nope";
      assert.throws(() => blobAccess(), /BLOB_ACCESS/);
    } finally {
      restoreEnv("BLOB_ACCESS", previousAccess);
      restoreEnv("BLOB_READ_WRITE_TOKEN", previousToken);
      restoreEnv("BLOB_STORE_ID", previousStore);
    }
  });
});
