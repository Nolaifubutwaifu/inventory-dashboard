import { canonicalColour, compareColour } from "./colours";
import type { InventoryItem } from "./inventory";

export const SALES_BLOB_PATH = "sales.json";
export const FORECAST_HISTORY_MONTHS = 6;
export const LOW_CONFIDENCE_BELOW_TRADING_DAYS = 65;
export const TRADING_DAYS_PER_WEEK = 5;
export const ORDER_ASSUMPTIONS_STORAGE_KEY = "brisbins-order-assumptions";

export const DEFAULT_ORDER_ASSUMPTIONS: OrderAssumptions = {
  leadWeeks: 8,
  coverWeeks: 8,
  capacity: null,
};

const MAX_ROWS = 50_000;
const MAX_TEXT = 200;
const MAX_NOTE = 2_000;
const MAX_QTY = 1_000_000;
const MAX_MONEY = 1_000_000_000;
const MAX_WEEKS = 104;
const MAX_CAPACITY = 100_000;

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

const moneyFormat = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const qtyFormat = new Intl.NumberFormat("en-AU", {
  maximumFractionDigits: 1,
});

const monthFormat = new Intl.DateTimeFormat("en-AU", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export type SalesItem = {
  date: string;
  type: string;
  size: string;
  colour: string;
  qty: number;
  invoices: string;
};

export type SalesTotal = {
  date: string;
  invoices: number;
  bins: number;
  lids: number;
  parts: number;
  sales_ex_gst: number;
  sales_incl_gst: number;
  freight_ex_gst: number;
  notes: string;
};

export type Sales = {
  updated_at: string;
  source: string;
  items: SalesItem[];
  totals: SalesTotal[];
};

export type SalesParseResult =
  | { ok: true; value: Sales }
  | { ok: false; error: string };

export type SalesLoadDetail =
  | "unconfigured"
  | "empty"
  | "invalid"
  | "error"
  | "preview"
  | null;

export type OrderAssumptions = {
  leadWeeks: number;
  coverWeeks: number;
  capacity: number | null;
};

export type LineKind = "bin" | "lid" | "part" | "other";

export type PartialDay = {
  date: string;
  label: string;
  notes: string;
};

export type ItemLine = {
  id: string;
  kind: LineKind;
  size: string;
  colour: string;
  qty: number;
};

export type ForecastLine = {
  id: string;
  kind: LineKind;
  size: string;
  colour: string;
  sold: number;
  perDay: number;
  expected: number;
};

export type SuggestionLine = {
  id: string;
  kind: LineKind;
  size: string;
  colour: string;
  sold: number;
  onHand: number | null;
  matched: boolean;
  coverDemand: number;
  suggested: number;
  orderQty: number;
  fromBackorder: boolean;
};

export type LineGroup<T> = {
  kind: LineKind;
  title: string;
  lines: T[];
};

export type SalesView = {
  month: {
    label: string;
    rangeLabel: string | null;
    tradingDays: number;
    partial: PartialDay | null;
    invoices: number;
    bins: number;
    lids: number;
    parts: number;
    salesExGst: number;
    salesInclGst: number;
    freightExGst: number;
    groups: LineGroup<ItemLine>[];
    hasRows: boolean;
  };
  forecast: {
    monthLabel: string;
    weekdays: number;
    tradingDays: number;
    rangeLabel: string | null;
    basisLabel: string | null;
    lowConfidence: boolean;
    partial: PartialDay | null;
    groups: LineGroup<ForecastLine>[];
    hasHistory: boolean;
  };
  container: {
    leadWeeks: number;
    coverWeeks: number;
    totalWeeks: number;
    coverTradingDays: number;
    capacity: number | null;
    groups: LineGroup<SuggestionLine>[];
    suggested: UnitTotals;
    ordered: UnitTotals;
    limited: boolean;
  };
};

export type UnitTotals = {
  bins: number;
  lids: number;
  parts: number;
  all: number;
};

type Norm = {
  kind: LineKind;
  sizeKey: string;
  sizeLabel: string;
  colourKey: string;
  colourLabel: string;
};

type Agg = {
  kind: LineKind;
  size: string;
  colour: string;
  sold: number;
};

type StockEntry = {
  onHand: number;
  kind: LineKind;
  size: string;
  colour: string;
};

export function formatMoney(value: number): string {
  return moneyFormat.format(value);
}

export function formatQty(value: number): string {
  return qtyFormat.format(value);
}

export function brisbaneToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Brisbane",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function formatIsoDate(iso: string, withYear = true): string {
  const { year, month, day } = splitIso(iso);
  const name = MONTHS[month - 1] ?? "";
  return withYear ? `${day} ${name} ${year}` : `${day} ${name}`;
}

export function formatIsoRange(start: string, end: string): string {
  if (start === end) return formatIsoDate(start);
  const left = splitIso(start);
  const right = splitIso(end);
  if (left.year === right.year && left.month === right.month) {
    return `${left.day}-${formatIsoDate(end)}`;
  }
  if (left.year === right.year) {
    return `${formatIsoDate(start, false)} to ${formatIsoDate(end)}`;
  }
  return `${formatIsoDate(start)} to ${formatIsoDate(end)}`;
}

export function formatMonth(year: number, month: number): string {
  return monthFormat.format(new Date(Date.UTC(year, month - 1, 1)));
}

export function tradingDaysInRange(start: string, end: string): number {
  if (!isRealDate(start) || !isRealDate(end) || end < start) return 0;
  let count = 0;
  let cursor = start;
  for (let guard = 0; guard < 400 && cursor <= end; guard += 1) {
    const day = utcDay(cursor);
    if (day !== 0 && day !== 6) count += 1;
    cursor = addDays(cursor, 1);
  }
  return count;
}

export function weekdaysInMonth(year: number, month: number): number {
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  let count = 0;
  for (let day = 1; day <= days; day += 1) {
    const dow = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    if (dow !== 0 && dow !== 6) count += 1;
  }
  return count;
}

export function coverTradingDays(assumptions: OrderAssumptions): number {
  const weeks = assumptions.leadWeeks + assumptions.coverWeeks;
  return weeks * TRADING_DAYS_PER_WEEK;
}

export function suggestedQty(demand: number, onHand: number): number {
  const raw = demand - onHand;
  if (raw <= 1e-9) return 0;
  return Math.ceil(raw - 1e-9);
}

export function readOrderAssumptions(raw: string | null): OrderAssumptions {
  if (!raw) return DEFAULT_ORDER_ASSUMPTIONS;
  try {
    return sanitiseAssumptions(JSON.parse(raw));
  } catch {
    return DEFAULT_ORDER_ASSUMPTIONS;
  }
}

export function sanitiseAssumptions(input: unknown): OrderAssumptions {
  if (!isPlainObject(input)) return { ...DEFAULT_ORDER_ASSUMPTIONS };
  return {
    leadWeeks: clampWeeks(input.leadWeeks, DEFAULT_ORDER_ASSUMPTIONS.leadWeeks),
    coverWeeks: clampWeeks(input.coverWeeks, DEFAULT_ORDER_ASSUMPTIONS.coverWeeks),
    capacity: parseCapacity(input.capacity),
  };
}

export function parseSales(input: unknown): SalesParseResult {
  if (!isPlainObject(input)) {
    return { ok: false, error: "Body must be a JSON object." };
  }
  if (!Array.isArray(input.items)) {
    return { ok: false, error: "items must be an array." };
  }
  if (!Array.isArray(input.totals)) {
    return { ok: false, error: "totals must be an array." };
  }
  if (input.items.length > MAX_ROWS || input.totals.length > MAX_ROWS) {
    return { ok: false, error: `items and totals cannot exceed ${MAX_ROWS} rows.` };
  }

  const updatedAt = requiredText(input.updated_at, "updated_at");
  if (typeof updatedAt !== "string") return updatedAt;
  const source =
    typeof input.source === "string" && input.source.trim()
      ? clip(input.source, MAX_TEXT)
      : "upload";

  const items: SalesItem[] = [];
  for (let index = 0; index < input.items.length; index += 1) {
    const parsed = parseItem(input.items[index], index);
    if ("error" in parsed) return parsed;
    items.push(parsed.item);
  }

  const totals: SalesTotal[] = [];
  for (let index = 0; index < input.totals.length; index += 1) {
    const parsed = parseTotal(input.totals[index], index);
    if ("error" in parsed) return parsed;
    totals.push(parsed.total);
  }

  return { ok: true, value: { updated_at: updatedAt, source, items, totals } };
}

export function buildSalesView(
  sales: Sales,
  stock: readonly InventoryItem[],
  todayIso: string,
  assumptions: OrderAssumptions,
): SalesView {
  const today = isRealDate(todayIso) ? splitIso(todayIso) : splitIso(brisbaneToday());
  const monthPrefix = `${today.year}-${String(today.month).padStart(2, "0")}`;
  const monthTotals = sales.totals.filter((row) => row.date.startsWith(monthPrefix));
  const monthItems = sales.items.filter((row) => row.date.startsWith(monthPrefix));
  const monthDates = [...monthTotals, ...monthItems].map((row) => row.date).toSorted();
  const monthStart = monthDates[0] ?? null;
  const monthEnd = monthDates[monthDates.length - 1] ?? null;
  const monthRange =
    monthStart && monthEnd ? { start: monthStart, end: monthEnd } : null;

  const history = historyWindow(sales);
  const tradingDays = history ? tradingDaysInRange(history.start, history.end) : 0;
  const next = nextMonth(today.year, today.month);
  const weekdays = weekdaysInMonth(next.year, next.month);
  const rateDivisor = tradingDays > 0 ? tradingDays : 0;
  const aggregated = history ? aggregateItems(sales.items, history.start, history.end) : new Map();
  const stockIndex = indexStock(stock);
  const partial = history ? partialDay(sales, history.end) : null;

  const forecastLines: ForecastLine[] = [...aggregated.entries()].map(([id, row]) => {
    const perDay = rateDivisor > 0 ? row.sold / rateDivisor : 0;
    return {
      id,
      kind: row.kind,
      size: row.size,
      colour: row.colour,
      sold: row.sold,
      perDay,
      expected: perDay * weekdays,
    };
  });

  const coverDays = coverTradingDays(assumptions);
  const suggestionSeed: Omit<SuggestionLine, "orderQty">[] = forecastLines.map((line) => {
    const entry = line.kind === "bin" || line.kind === "lid" ? stockIndex.get(line.id) : undefined;
    const matched = entry != null;
    const onHand = line.kind === "part" || line.kind === "other" ? null : (entry?.onHand ?? 0);
    const coverDemand = rateDivisor > 0 ? (line.sold / rateDivisor) * coverDays : 0;
    return {
      id: line.id,
      kind: line.kind,
      size: line.size,
      colour: line.colour,
      sold: line.sold,
      onHand,
      matched,
      coverDemand,
      suggested:
        onHand == null ? suggestedQty(coverDemand, 0) : suggestedQty(coverDemand, onHand),
      fromBackorder: false,
    };
  });

  for (const [id, entry] of stockIndex) {
    if (entry.onHand >= 0 || aggregated.has(id)) continue;
    suggestionSeed.push({
      id,
      kind: entry.kind,
      size: entry.size,
      colour: entry.colour,
      sold: 0,
      onHand: entry.onHand,
      matched: true,
      coverDemand: 0,
      suggested: suggestedQty(0, entry.onHand),
      fromBackorder: true,
    });
  }

  const ordered = applyCapacity(suggestionSeed, assumptions.capacity);
  const basis =
    history && tradingDays > 0
      ? `Based on ${tradingDays} trading ${tradingDays === 1 ? "day" : "days"}, ${formatIsoRange(history.start, history.end)}.`
      : null;

  return {
    month: {
      label: formatMonth(today.year, today.month),
      rangeLabel: monthRange ? formatIsoRange(monthRange.start, monthRange.end) : null,
      tradingDays: monthRange ? tradingDaysInRange(monthRange.start, monthRange.end) : 0,
      partial:
        monthRange && partial && partial.date >= monthRange.start && partial.date <= monthRange.end
          ? partial
          : null,
      invoices: sumNumbers(monthTotals.map((row) => row.invoices)),
      bins: sumNumbers(monthTotals.map((row) => row.bins)),
      lids: sumNumbers(monthTotals.map((row) => row.lids)),
      parts: sumNumbers(monthTotals.map((row) => row.parts)),
      salesExGst: sumMoney(monthTotals.map((row) => row.sales_ex_gst)),
      salesInclGst: sumMoney(monthTotals.map((row) => row.sales_incl_gst)),
      freightExGst: sumMoney(monthTotals.map((row) => row.freight_ex_gst)),
      groups: groupLines(
        [...aggregateItems(monthItems, "0000-01-01", "9999-12-31").entries()].map(
          ([id, row]) => ({
            id,
            kind: row.kind,
            size: row.size,
            colour: row.colour,
            qty: row.sold,
          }),
        ),
      ),
      hasRows: monthDates.length > 0,
    },
    forecast: {
      monthLabel: formatMonth(next.year, next.month),
      weekdays,
      tradingDays,
      rangeLabel: history ? formatIsoRange(history.start, history.end) : null,
      basisLabel: basis,
      lowConfidence: tradingDays > 0 && tradingDays < LOW_CONFIDENCE_BELOW_TRADING_DAYS,
      partial,
      groups: groupLines(forecastLines),
      hasHistory: history != null && tradingDays > 0,
    },
    container: {
      leadWeeks: assumptions.leadWeeks,
      coverWeeks: assumptions.coverWeeks,
      totalWeeks: assumptions.leadWeeks + assumptions.coverWeeks,
      coverTradingDays: coverDays,
      capacity: assumptions.capacity,
      groups: groupLines(ordered),
      suggested: unitTotals(ordered, "suggested"),
      ordered: unitTotals(ordered, "orderQty"),
      limited: assumptions.capacity != null && unitTotals(ordered, "orderQty").all < unitTotals(ordered, "suggested").all,
    },
  };
}

function historyWindow(sales: Sales): { start: string; end: string } | null {
  const dates = [...sales.items, ...sales.totals]
    .map((row) => row.date)
    .filter(isRealDate)
    .toSorted();
  if (dates.length === 0) return null;
  const end = dates[dates.length - 1] ?? "";
  const cutoff = shiftMonths(end, -FORECAST_HISTORY_MONTHS);
  const included = dates.filter((date) => date >= cutoff);
  const start = included[0];
  if (!start) return null;
  return { start, end };
}

function partialDay(sales: Sales, end: string): PartialDay | null {
  const row = sales.totals.find((total) => total.date === end);
  if (!row || !/running total/i.test(row.notes)) return null;
  return { date: end, label: formatIsoDate(end, false), notes: row.notes };
}

function aggregateItems(
  items: readonly SalesItem[],
  start: string,
  end: string,
): Map<string, Agg> {
  const map = new Map<string, Agg>();
  for (const item of items) {
    if (item.date < start || item.date > end) continue;
    const norm = normaliseSale(item);
    const id = lineId(norm);
    const current = map.get(id) ?? {
      kind: norm.kind,
      size: norm.sizeLabel,
      colour: norm.colourLabel,
      sold: 0,
    };
    current.sold += item.qty;
    map.set(id, current);
  }
  return map;
}

function indexStock(items: readonly InventoryItem[]): Map<string, StockEntry> {
  const map = new Map<string, StockEntry>();
  for (const item of items) {
    const norm = normaliseStock(item);
    if (!norm) continue;
    const id = lineId(norm);
    const current = map.get(id);
    if (current) {
      current.onHand += item.total_count;
      continue;
    }
    map.set(id, {
      onHand: item.total_count,
      kind: norm.kind,
      size: norm.sizeLabel,
      colour: norm.colourLabel,
    });
  }
  return map;
}

function applyCapacity(
  lines: Omit<SuggestionLine, "orderQty">[],
  capacity: number | null,
): SuggestionLine[] {
  if (capacity == null) {
    return lines.map((line) => ({ ...line, orderQty: line.suggested }));
  }
  let remaining = Math.max(0, Math.round(capacity));
  const ranked = lines.toSorted((a, b) => {
    const aSecondary = a.kind === "part" || a.kind === "other" ? 1 : 0;
    const bSecondary = b.kind === "part" || b.kind === "other" ? 1 : 0;
    return (
      aSecondary - bSecondary ||
      b.suggested - a.suggested ||
      (a.onHand ?? 0) - (b.onHand ?? 0) ||
      a.id.localeCompare(b.id)
    );
  });
  const order = new Map<string, number>();
  for (const line of ranked) {
    const take = Math.min(line.suggested, remaining);
    order.set(line.id, take);
    remaining -= take;
  }
  return lines.map((line) => ({ ...line, orderQty: order.get(line.id) ?? 0 }));
}

function unitTotals(
  lines: readonly SuggestionLine[],
  field: "suggested" | "orderQty",
): UnitTotals {
  const totals: UnitTotals = { bins: 0, lids: 0, parts: 0, all: 0 };
  for (const line of lines) {
    const qty = line[field];
    totals.all += qty;
    if (line.kind === "bin") totals.bins += qty;
    else if (line.kind === "lid") totals.lids += qty;
    else totals.parts += qty;
  }
  return totals;
}

function groupLines<T extends { kind: LineKind; size: string; colour: string }>(
  lines: readonly T[],
): LineGroup<T>[] {
  const titles: Record<LineKind, string> = {
    bin: "Bins",
    lid: "Lids",
    part: "Parts",
    other: "Other",
  };
  const order: LineKind[] = ["bin", "lid", "part", "other"];
  return order
    .map((kind) => ({
      kind,
      title: titles[kind],
      lines: lines
        .filter((line) => line.kind === kind)
        .toSorted((a, b) => compareLine(a, b)),
    }))
    .filter((group) => group.lines.length > 0);
}

function compareLine(
  a: { kind: LineKind; size: string; colour: string },
  b: { kind: LineKind; size: string; colour: string },
): number {
  if (a.kind === "part" || a.kind === "other") {
    return a.size.localeCompare(b.size, "en-AU") || compareColour(a.colour, b.colour);
  }
  return sizeRank(a.size) - sizeRank(b.size) || compareColour(a.colour, b.colour);
}

function normaliseSale(item: SalesItem): Norm {
  const kind = kindFromType(item.type);
  return normaliseParts(kind, item.size, item.colour);
}

function normaliseStock(item: InventoryItem): Norm | null {
  const category = item.category.trim().toLowerCase();
  if (category !== "bin" && category !== "lid") return null;
  return normaliseParts(category, item.size, item.color);
}

function normaliseParts(kind: LineKind, size: string, colour: string): Norm {
  const colourLabel = canonicalColour(colour);
  if (kind === "part" || kind === "other") {
    const sizeLabel = size.trim().replace(/\s+/g, " ");
    return {
      kind,
      sizeKey: sizeLabel.toLowerCase(),
      sizeLabel,
      colourKey: colourLabel.toLowerCase(),
      colourLabel,
    };
  }
  const shared = kind === "lid" && isSharedLidSize(size);
  const sizeLabel = shared ? "80/120L" : litreLabel(size);
  return {
    kind,
    sizeKey: sizeLabel.toLowerCase(),
    sizeLabel,
    colourKey: colourLabel.toLowerCase(),
    colourLabel,
  };
}

function kindFromType(type: string): LineKind {
  switch (type.trim().toLowerCase()) {
    case "bin":
      return "bin";
    case "lid":
      return "lid";
    case "part":
    case "parts":
      return "part";
    default:
      return "other";
  }
}

function isSharedLidSize(size: string): boolean {
  const compact = size.trim().replace(/\s+/g, "").toLowerCase();
  return (
    compact === "80l/120l" ||
    compact === "80/120l" ||
    compact === "80/120" ||
    compact === "80l" ||
    compact === "120l"
  );
}

function litreLabel(size: string): string {
  const compact = size.trim().replace(/\s+/g, "");
  const match = compact.match(/^(\d+(?:\.\d+)?)l$/i);
  if (!match?.[1]) return size.trim().replace(/\s+/g, " ");
  return `${match[1]}L`;
}

function lineId(norm: Pick<Norm, "kind" | "sizeKey" | "colourKey">): string {
  return `${norm.kind}\0${norm.sizeKey}\0${norm.colourKey}`;
}

function sizeRank(size: string): number {
  if (size === "80/120L") return 80;
  const match = size.match(/^(\d+(?:\.\d+)?)L$/);
  return match?.[1] ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

function parseItem(
  input: unknown,
  index: number,
): { item: SalesItem } | { ok: false; error: string } {
  if (!isPlainObject(input)) {
    return { ok: false, error: `items[${index}] must be an object.` };
  }
  const date = parseDate(input.date, `items[${index}].date`);
  if (typeof date !== "string") return date;
  const type = requiredText(input.type, `items[${index}].type`);
  if (typeof type !== "string") return type;
  const size = optionalText(input.size, MAX_TEXT);
  const colour = optionalText(input.colour ?? input.color, MAX_TEXT);
  const qty = parseNumber(input.qty, `items[${index}].qty`, MAX_QTY);
  if (typeof qty !== "number") return qty;
  return {
    item: {
      date,
      type,
      size,
      colour,
      qty,
      invoices: optionalText(input.invoices, MAX_NOTE),
    },
  };
}

function parseTotal(
  input: unknown,
  index: number,
): { total: SalesTotal } | { ok: false; error: string } {
  if (!isPlainObject(input)) {
    return { ok: false, error: `totals[${index}] must be an object.` };
  }
  const date = parseDate(input.date, `totals[${index}].date`);
  if (typeof date !== "string") return date;
  const invoices = parseNumber(input.invoices, `totals[${index}].invoices`, MAX_QTY);
  if (typeof invoices !== "number") return invoices;
  const bins = parseNumber(input.bins, `totals[${index}].bins`, MAX_QTY);
  if (typeof bins !== "number") return bins;
  const lids = parseNumber(input.lids, `totals[${index}].lids`, MAX_QTY);
  if (typeof lids !== "number") return lids;
  const parts = parseNumber(input.parts, `totals[${index}].parts`, MAX_QTY);
  if (typeof parts !== "number") return parts;
  const salesEx = parseNumber(input.sales_ex_gst, `totals[${index}].sales_ex_gst`, MAX_MONEY);
  if (typeof salesEx !== "number") return salesEx;
  const salesIncl = parseNumber(
    input.sales_incl_gst,
    `totals[${index}].sales_incl_gst`,
    MAX_MONEY,
  );
  if (typeof salesIncl !== "number") return salesIncl;
  const freight = parseNumber(input.freight_ex_gst, `totals[${index}].freight_ex_gst`, MAX_MONEY);
  if (typeof freight !== "number") return freight;
  return {
    total: {
      date,
      invoices,
      bins,
      lids,
      parts,
      sales_ex_gst: salesEx,
      sales_incl_gst: salesIncl,
      freight_ex_gst: freight,
      notes: optionalText(input.notes, MAX_NOTE),
    },
  };
}

function parseDate(
  value: unknown,
  label: string,
): string | { ok: false; error: string } {
  if (typeof value !== "string" || !isRealDate(value)) {
    return { ok: false, error: `${label} must be a YYYY-MM-DD date.` };
  }
  return value;
}

function parseNumber(
  value: unknown,
  label: string,
  limit: number,
): number | { ok: false; error: string } {
  let numeric = value;
  if (typeof numeric === "string" && /^-?\d+(\.\d+)?$/.test(numeric.trim())) {
    numeric = Number(numeric.trim());
  }
  if (typeof numeric !== "number" || !Number.isFinite(numeric) || Math.abs(numeric) > limit) {
    return { ok: false, error: `${label} must be a number from -${limit} to ${limit}.` };
  }
  return numeric;
}

function isRealDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function splitIso(iso: string): { year: number; month: number; day: number } {
  const [year, month, day] = iso.split("-").map(Number);
  return { year: year ?? 0, month: month ?? 1, day: day ?? 1 };
}

function nextMonth(year: number, month: number): { year: number; month: number } {
  if (month === 12) return { year: year + 1, month: 1 };
  return { year, month: month + 1 };
}

function shiftMonths(iso: string, months: number): string {
  const { year, month, day } = splitIso(iso);
  const anchor = new Date(Date.UTC(year, month - 1 + months, 1));
  const dim = new Date(
    Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 0),
  ).getUTCDate();
  return isoFromUtc(
    new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), Math.min(day, dim))),
  );
}

function addDays(iso: string, days: number): string {
  const { year, month, day } = splitIso(iso);
  return isoFromUtc(new Date(Date.UTC(year, month - 1, day + days)));
}

function isoFromUtc(date: Date): string {
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${date.getUTCFullYear()}-${month}-${day}`;
}

function utcDay(iso: string): number {
  const { year, month, day } = splitIso(iso);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function sumNumbers(values: readonly number[]): number {
  let total = 0;
  for (const value of values) total += value;
  return total;
}

function sumMoney(values: readonly number[]): number {
  let cents = 0;
  for (const value of values) cents += Math.round(value * 100);
  return cents / 100;
}

function clampWeeks(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(MAX_WEEKS, Math.max(0, Math.round(value)));
}

function parseCapacity(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  return Math.min(MAX_CAPACITY, Math.round(value));
}

function requiredText(
  value: unknown,
  label: string,
): string | { ok: false; error: string } {
  if (typeof value !== "string" || value.trim() === "") {
    return { ok: false, error: `${label} is required.` };
  }
  return clip(value, MAX_TEXT);
}

function optionalText(value: unknown, limit: number): string {
  return typeof value === "string" ? clip(value, limit) : "";
}

function clip(value: string, limit: number): string {
  return value.trim().slice(0, limit);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}
