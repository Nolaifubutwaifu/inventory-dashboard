export const LOW_STOCK_MAX = 5;
export const INVENTORY_BLOB_PATH = "inventory.json";

const CATEGORY_ORDER = ["Bin", "Lid", "Pedal Bin", "Vermin Lid", "Spare Parts"];
const MAX_ITEMS = 5000;
const MAX_TEXT = 200;

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const numberFormat = new Intl.NumberFormat("en-AU");

export type LocationValue = string | number;

export type InventoryItem = {
  category: string;
  item: string;
  sku: string;
  color: string;
  size: string;
  total_count: number;
  locations: string | Record<string, LocationValue>;
};

export type InventoryMeta = {
  title: string;
  date: string;
  counted_by: string;
  generated: string;
  grand_total: number | null;
};

export type Inventory = {
  updated_at: string;
  source: string;
  meta: InventoryMeta;
  items: InventoryItem[];
};

export type ParseResult =
  | { ok: true; value: Inventory }
  | { ok: false; error: string };

export type LoadOrigin = "blob" | "seed";
export type LoadDetail = "unconfigured" | "empty" | "invalid" | "error" | null;

export type SortKey = "category" | "item" | "sku" | "color" | "size" | "count";
export type SortDirection = "asc" | "desc";

export type CategorySummary = {
  category: string;
  total: number;
  skus: number;
};

export function formatNumber(value: number): string {
  return numberFormat.format(value);
}

export function formatUpdatedAt(value: string): string {
  const naive = value.match(
    /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::\d{2})?$/,
  );
  if (naive) {
    return formatWallClock(naive);
  }

  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(value)) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return new Intl.DateTimeFormat("en-AU", {
        timeZone: "Australia/Brisbane",
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }).format(date);
    }
  }

  return value;
}

export function sourceLabel(origin: LoadOrigin, detail: LoadDetail): string {
  if (origin === "blob") return "Live";
  switch (detail) {
    case "empty":
      return "Seeded file — nothing in Blob yet";
    case "invalid":
      return "Seeded file — Blob file was not valid";
    case "error":
      return "Seeded file — Blob could not be read";
    default:
      return "Seeded file";
  }
}

export function totalCount(items: readonly InventoryItem[]): number {
  let sum = 0;
  for (const item of items) sum += item.total_count;
  return sum;
}

export function lowStockCount(items: readonly InventoryItem[]): number {
  let count = 0;
  for (const item of items) {
    if (item.total_count <= LOW_STOCK_MAX) count += 1;
  }
  return count;
}

export function categoryRank(category: string): number {
  const index = CATEGORY_ORDER.indexOf(category);
  return index === -1 ? CATEGORY_ORDER.length : index;
}

export function categorySummaries(
  items: readonly InventoryItem[],
): CategorySummary[] {
  const map = new Map<string, CategorySummary>();
  for (const item of items) {
    const current = map.get(item.category) ?? {
      category: item.category,
      total: 0,
      skus: 0,
    };
    current.total += item.total_count;
    current.skus += 1;
    map.set(item.category, current);
  }

  return [...map.values()].toSorted(
    (a, b) =>
      categoryRank(a.category) - categoryRank(b.category) ||
      a.category.localeCompare(b.category, "en-AU"),
  );
}

export function filterItems(
  items: readonly InventoryItem[],
  query: string,
  category: string,
  lowOnly: boolean,
): InventoryItem[] {
  const needle = query.trim().toLowerCase();
  return items.filter((item) => {
    if (category !== "all" && item.category !== category) return false;
    if (lowOnly && item.total_count > LOW_STOCK_MAX) return false;
    if (!needle) return true;
    return `${item.category} ${item.item} ${item.sku} ${item.color} ${item.size}`
      .toLowerCase()
      .includes(needle);
  });
}

export function sortItems(
  items: readonly InventoryItem[],
  key: SortKey,
  direction: SortDirection,
): InventoryItem[] {
  const factor = direction === "asc" ? 1 : -1;
  return items.toSorted((a, b) => {
    const compared = compareItems(a, b, key);
    if (compared !== 0) return compared * factor;
    return (
      a.item.localeCompare(b.item, "en-AU") ||
      a.sku.localeCompare(b.sku, "en")
    );
  });
}

export function displayText(value: string): string {
  const trimmed = value.trim();
  return trimmed === "" ? "—" : trimmed;
}

export function displayLocations(
  locations: InventoryItem["locations"],
): string {
  if (typeof locations === "string") return locations.trim();
  return Object.entries(locations)
    .map(([place, count]) => `${place}: ${count}`)
    .join(", ");
}

export function parseInventory(input: unknown): ParseResult {
  if (!isPlainObject(input)) {
    return { ok: false, error: "Body must be a JSON object." };
  }

  if (!Array.isArray(input.items)) {
    return { ok: false, error: "items must be an array." };
  }

  if (input.items.length === 0) {
    return { ok: false, error: "items must contain at least one SKU." };
  }

  if (input.items.length > MAX_ITEMS) {
    return { ok: false, error: `items cannot exceed ${MAX_ITEMS}.` };
  }

  const updatedAt = requiredText(input.updated_at, "updated_at");
  if (typeof updatedAt !== "string") return updatedAt;

  const source =
    typeof input.source === "string" && input.source.trim()
      ? clip(input.source)
      : "upload";

  const meta = parseMeta(input.meta);
  if ("error" in meta) return meta;

  const items: InventoryItem[] = [];
  for (let index = 0; index < input.items.length; index += 1) {
    const parsed = parseItem(input.items[index], index);
    if ("error" in parsed) return parsed;
    items.push(parsed.item);
  }

  return {
    ok: true,
    value: {
      updated_at: updatedAt,
      source,
      meta: meta.meta,
      items,
    },
  };
}

function formatWallClock(match: RegExpMatchArray): string {
  const year = match[1] ?? "";
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = match[5] ?? "00";
  const month = MONTHS[monthIndex] ?? match[2];
  const hour12 = hour % 12 || 12;
  const suffix = hour < 12 ? "am" : "pm";
  return `${day} ${month} ${year}, ${hour12}:${minute} ${suffix}`;
}

function compareItems(a: InventoryItem, b: InventoryItem, key: SortKey): number {
  switch (key) {
    case "count":
      return a.total_count - b.total_count;
    case "category":
      return (
        categoryRank(a.category) - categoryRank(b.category) ||
        a.category.localeCompare(b.category, "en-AU")
      );
    case "item":
      return a.item.localeCompare(b.item, "en-AU");
    case "sku":
      return a.sku.localeCompare(b.sku, "en");
    case "color":
      return a.color.localeCompare(b.color, "en-AU");
    case "size":
      return a.size.localeCompare(b.size, "en-AU", { numeric: true });
  }
}

function parseMeta(
  input: unknown,
): { meta: InventoryMeta } | { ok: false; error: string } {
  if (input == null) {
    return {
      meta: {
        title: "",
        date: "",
        counted_by: "",
        generated: "",
        grand_total: null,
      },
    };
  }

  if (!isPlainObject(input)) {
    return { ok: false, error: "meta must be an object." };
  }

  let grandTotal: number | null = null;
  if (input.grand_total != null && input.grand_total !== "") {
    const count = normaliseCount(input.grand_total);
    if (count == null) {
      return { ok: false, error: "meta.grand_total must be a non-negative number." };
    }
    grandTotal = count;
  }

  return {
    meta: {
      title: optionalText(input.title),
      date: optionalText(input.date),
      counted_by: optionalText(input.counted_by),
      generated: optionalText(input.generated),
      grand_total: grandTotal,
    },
  };
}

function parseItem(
  input: unknown,
  index: number,
): { item: InventoryItem } | { ok: false; error: string } {
  if (!isPlainObject(input)) {
    return { ok: false, error: `items[${index}] must be an object.` };
  }

  const category = requiredText(input.category, `items[${index}].category`);
  if (typeof category !== "string") return category;
  const item = requiredText(input.item, `items[${index}].item`);
  if (typeof item !== "string") return item;
  const sku = requiredText(input.sku, `items[${index}].sku`);
  if (typeof sku !== "string") return sku;

  const total = normaliseCount(input.total_count);
  if (total == null) {
    return {
      ok: false,
      error: `items[${index}].total_count must be a non-negative number.`,
    };
  }

  return {
    item: {
      category,
      item,
      sku,
      color: optionalText(input.color),
      size: optionalText(input.size),
      total_count: total,
      locations: normaliseLocations(input.locations),
    },
  };
}

function normaliseCount(value: unknown): number | null {
  let numeric = value;
  if (typeof numeric === "string" && /^-?\d+(\.\d+)?$/.test(numeric.trim())) {
    numeric = Number(numeric.trim());
  }
  if (typeof numeric !== "number" || !Number.isFinite(numeric)) return null;
  if (numeric < 0 || numeric > 1_000_000) return null;
  return Math.round(numeric);
}

function normaliseLocations(
  value: unknown,
): string | Record<string, LocationValue> {
  if (typeof value === "string") return value.slice(0, 2000);
  if (!isPlainObject(value)) return "";

  const locations: Record<string, LocationValue> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (!isSafeKey(key)) continue;
    if (typeof entry === "string") locations[key.slice(0, MAX_TEXT)] = entry.slice(0, MAX_TEXT);
    if (typeof entry === "number" && Number.isFinite(entry)) locations[key.slice(0, MAX_TEXT)] = entry;
  }
  return locations;
}

function requiredText(
  value: unknown,
  label: string,
): string | { ok: false; error: string } {
  if (typeof value !== "string" || value.trim() === "") {
    return { ok: false, error: `${label} is required.` };
  }
  return clip(value);
}

function optionalText(value: unknown): string {
  return typeof value === "string" ? clip(value) : "";
}

function clip(value: string): string {
  return value.trim().slice(0, MAX_TEXT);
}

function isSafeKey(key: string): boolean {
  return key !== "__proto__" && key !== "prototype" && key !== "constructor";
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}
