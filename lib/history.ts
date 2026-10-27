import { formatNumber } from "./inventory";
import type { InventoryItem } from "./inventory";
import {
  containerFromRates,
  FORECAST_HISTORY_MONTHS,
  formatIsoDate,
  formatIsoRange,
  formatMonth,
  LOW_CONFIDENCE_BELOW_TRADING_DAYS,
  rateLineFromParts,
  shiftMonths,
  tradingDaysInRange,
  weekdaysInMonth,
  type LineKind,
  type OrderAssumptions,
  type RatedLine,
  type SalesView,
} from "./sales";

export const HISTORY_BLOB_PATH = "history.json";
export const SCHEMA_VERSION = 1;
export const FULL_UNIT_COVERAGE = 0.995;
export const SEASONALITY_MIN_MONTHS = 6;
export const TOP_CUSTOMERS = 12;
export const CUSTOMER_WINDOWS = [3, 6, 12, 24] as const;

const MAX_MONTHS = 120;
const MAX_DAILY = 5_000;
const MAX_CUSTOMERS = 50_000;
const MAX_UNITS = 50_000;
const MAX_TEXT = 200;
const MAX_QTY = 10_000_000;
const MAX_MONEY = 1_000_000_000_000;
const MAX_WARNINGS = 20;

const DAILY_COLUMNS = [
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
  "provisional",
] as const;

const CUSTOMER_COLUMNS = ["month", "customer", "invoices", "credit_notes", "sales_ex_gst"] as const;
const UNIT_COLUMNS = ["month", "type", "size", "colour", "kind", "qty"] as const;

export type CustomerWindow = (typeof CUSTOMER_WINDOWS)[number];

export type HistoryLoadDetail =
  | "unconfigured"
  | "empty"
  | "invalid"
  | "error"
  | "preview"
  | null;

export type HistoryParseResult =
  | { ok: true; value: History }
  | { ok: false; error: string };

export type HistoryTotals = {
  invoices: number;
  creditNotes: number;
  salesExGst: number;
  salesInclGst: number;
  freightExGst: number;
  creditNotesExGst: number;
  bins: number;
  lids: number;
  parts: number;
};

export type HistoryMonth = {
  month: string;
  partial: boolean;
  provisional: boolean;
  daysInPeriod: number;
  invoices: number;
  creditNotes: number;
  creditNotesExGst: number;
  salesExGst: number;
  salesInclGst: number;
  freightExGst: number;
  avgOrderValueExGst: number | null;
  freightShare: number | null;
  bins: number;
  lids: number;
  parts: number;
  invoicesWithUnits: number;
  unitCoverage: number | null;
};

export type HistoryDay = {
  date: string;
  invoices: number;
  creditNotes: number;
  salesExGst: number;
  salesInclGst: number;
  freightExGst: number;
  creditNotesExGst: number;
  bins: number;
  lids: number;
  parts: number;
  invoicesWithUnits: number;
  provisional: boolean;
};

export type HistoryCustomer = {
  month: string;
  customer: string;
  invoices: number;
  creditNotes: number;
  salesExGst: number;
};

export type HistoryUnit = {
  month: string;
  type: string;
  size: string;
  colour: string;
  kind: string;
  qty: number;
};

export type UnitCoverage = {
  invoicesWithUnits: number | null;
  invoicesTotal: number | null;
  ratio: number | null;
  isComplete: boolean | null;
  completeFromDate: string | null;
  invoicesStillToRead: number | null;
  final: boolean | null;
  descriptionsDone: number | null;
  descriptionsTotal: number | null;
  descriptionAmountsIncGst: string[];
};

export type HistoryManifest = {
  periodStart: string | null;
  periodEnd: string | null;
  generatedAt: string | null;
  invoiceCount: number | null;
  descriptionsDone: number | null;
  descriptionsTotal: number | null;
  final: boolean | null;
};

export type History = {
  schemaVersion: number;
  generatedAt: string;
  timezone: string;
  currency: string;
  period: { start: string; end: string; myobEnd: string | null };
  customersRedacted: boolean;
  totals: HistoryTotals;
  months: HistoryMonth[];
  days: HistoryDay[];
  customers: HistoryCustomer[] | null;
  units: HistoryUnit[];
  coverage: { units: UnitCoverage };
  manifest: HistoryManifest | null;
  warnings: string[];
};

export type MonthInsight = HistoryMonth & {
  label: string;
  yoy: number | null;
  priorLabel: string | null;
  fullUnitCoverage: boolean;
  coverageLabel: string | null;
};

export type UnitLine = {
  id: string;
  size: string;
  colour: string;
  qty: number;
};

export type UnitGroup = {
  title: string;
  named: boolean;
  lines: UnitLine[];
};

export type UnitMonthView = {
  month: string;
  label: string;
  partial: boolean;
  provisional: boolean;
  full: boolean;
  coverageLabel: string | null;
  groups: UnitGroup[];
};

export type CustomerRow = {
  customer: string;
  invoices: number;
  creditNotes: number;
  salesExGst: number;
};

export type SeasonBar = {
  month: number;
  label: string;
  average: number | null;
  years: number;
  partialOnly: boolean;
};

export type SeasonalityFactor = {
  factor: number;
  lastYearMonth: string;
  lastYearLabel: string;
  fullMonths: number;
  lastYearSales: number;
  trailingAverage: number;
};

export type ForecastRate = RatedLine & {
  joinsStock: boolean;
  groupTitle: string;
};

export type RateGroup = {
  title: string;
  named: boolean;
  lines: ForecastRate[];
};

export type HistoryView = {
  generatedAt: string;
  timezone: string;
  periodLabel: string;
  totals: HistoryTotals;
  averageOrderValue: number | null;
  freightShare: number | null;
  coverageText: string;
  descriptionAmountNote: string | null;
  warnings: string[];
  months: MonthInsight[];
  seasonality: SeasonBar[];
  seasonalityFactor: SeasonalityFactor | null;
  seasonalApplied: boolean;
  customers: { label: string; rows: CustomerRow[] } | null;
  unitMonths: UnitMonthView[];
  currentMonth: (MonthInsight & { groups: UnitGroup[] }) | null;
  moneyForecast: {
    monthLabel: string;
    weekdays: number;
    tradingDays: number;
    rangeLabel: string;
    basisLabel: string;
    expectedExGst: number;
    provisionalLabel: string | null;
  } | null;
  unitForecast: {
    monthLabel: string;
    weekdays: number;
    tradingDays: number;
    weeks: number;
    rangeLabel: string;
    basisLabel: string;
    lowConfidence: boolean;
    provisionalLabel: string | null;
    mixLabel: string;
    groups: RateGroup[];
    hasOtherProducts: boolean;
    container: SalesView["container"];
  } | null;
};

export function parseHistory(input: unknown): HistoryParseResult {
  if (!isPlainObject(input)) return fail("Body must be a JSON object.");
  if (input.schema_version !== SCHEMA_VERSION) {
    return fail(`schema_version must be ${SCHEMA_VERSION}.`);
  }

  const generatedAt = requiredText(input.generated_at, "generated_at");
  if (typeof generatedAt !== "string") return generatedAt;
  const period = parsePeriod(input.period);
  if ("error" in period) return period;
  if (typeof input.customers_redacted !== "boolean") {
    return fail("customers_redacted must be true or false.");
  }
  const totals = parseTotals(input.totals);
  if ("error" in totals) return totals;
  const months = parseMonths(input.monthly);
  if ("error" in months) return months;
  const days = parseDaily(input.daily);
  if ("error" in days) return days;
  const customers = parseCustomers(input.customers_monthly);
  if ("error" in customers) return customers;
  const units = parseUnits(input.units_monthly);
  if ("error" in units) return units;
  const coverage = parseCoverage(input.coverage);
  if ("error" in coverage) return coverage;
  const manifest = parseManifest(input.sources);
  if ("error" in manifest) return manifest;

  return {
    ok: true,
    value: {
      schemaVersion: SCHEMA_VERSION,
      generatedAt,
      timezone: optionalText(input.timezone),
      currency: optionalText(input.currency),
      period: period.value,
      customersRedacted: input.customers_redacted,
      totals: totals.value,
      months: months.value,
      days: days.value,
      customers: customers.value,
      units: units.value,
      coverage: coverage.value,
      manifest: manifest.value,
      warnings: parseWarnings(input.checks),
    },
  };
}

export function presentHistory(history: History, includeCustomers: boolean): History {
  if (includeCustomers && !history.customersRedacted) return history;
  return { ...history, customers: null };
}

export function coverageSentence(history: History): string {
  const units = history.coverage.units;
  const withUnits = units.invoicesWithUnits;
  const total = units.invoicesTotal;
  if (withUnits == null || total == null) return "Item coverage is not in this file.";
  const status = units.final == null ? "" : units.final ? "complete" : "in progress";
  let sentence = `Item details for ${formatNumber(withUnits)} of ${formatNumber(total)} invoices`;
  if (units.completeFromDate && status) {
    sentence += `, ${status} from ${formatIsoDate(units.completeFromDate)}`;
  } else if (units.completeFromDate) {
    sentence += `, from ${formatIsoDate(units.completeFromDate)}`;
  } else if (status) {
    sentence += `, ${status}`;
  }
  if (units.descriptionsDone != null && units.descriptionsTotal != null) {
    sentence += ` (${formatNumber(units.descriptionsDone)} of ${formatNumber(units.descriptionsTotal)} descriptions)`;
  }
  sentence += ".";
  if (units.invoicesStillToRead != null && units.invoicesStillToRead > 0) {
    sentence += ` ${formatNumber(units.invoicesStillToRead)} invoices are still to be read.`;
  }
  return sentence;
}

export function descriptionAmountNote(ids: readonly string[]): string | null {
  if (ids.length === 0) return null;
  const shown = ids.slice(0, 5).join(", ");
  const extra = ids.length > 5 ? `, and ${formatNumber(ids.length - 5)} more` : "";
  const noun = ids.length === 1 ? "invoice lists" : "invoices list";
  return `${formatNumber(ids.length)} ${noun} description amounts including GST (${shown}${extra}). Sales totals still use MYOB, ex GST.`;
}

export function yoyChange(current: number, prior: number | null): number | null {
  if (prior == null || prior === 0 || !Number.isFinite(prior) || !Number.isFinite(current)) {
    return null;
  }
  return (current - prior) / Math.abs(prior);
}

export function seasonalityFor(
  months: readonly HistoryMonth[],
  targetMonth: string,
): SeasonalityFactor | null {
  if (!isMonthKey(targetMonth)) return null;
  const lastYearMonth = addMonthsKey(targetMonth, -12);
  const lastYear = months.find((month) => month.month === lastYearMonth);
  if (!lastYear || lastYear.partial) return null;
  const windowStart = addMonthsKey(lastYearMonth, -12);
  const trailing = months.filter(
    (month) => month.month >= windowStart && month.month < lastYearMonth && !month.partial,
  );
  if (trailing.length < SEASONALITY_MIN_MONTHS) return null;
  const trailingAverage =
    trailing.reduce((sum, month) => sum + month.salesExGst, 0) / trailing.length;
  if (trailingAverage === 0) return null;
  return {
    factor: lastYear.salesExGst / trailingAverage,
    lastYearMonth,
    lastYearLabel: monthLabel(lastYearMonth),
    fullMonths: trailing.length,
    lastYearSales: lastYear.salesExGst,
    trailingAverage,
  };
}

export function daySpan(start: string, end: string): number {
  const left = Date.parse(`${start}T00:00:00Z`);
  const right = Date.parse(`${end}T00:00:00Z`);
  if (!Number.isFinite(left) || !Number.isFinite(right)) return 0;
  return Math.round((right - left) / 86_400_000);
}

export function buildHistoryView(
  history: History,
  stock: readonly InventoryItem[],
  todayIso: string,
  assumptions: OrderAssumptions,
  options: { customerWindow: CustomerWindow; seasonal: boolean },
): HistoryView {
  const today = isDate(todayIso) ? todayIso : history.period.end;
  const todayMonth = today.slice(0, 7);
  const next = nextMonthKey(todayMonth);
  const monthIndex = new Map(history.months.map((month) => [month.month, month]));
  const months = history.months.map((month) => toMonthInsight(month, monthIndex));
  const currentBase = months.find((month) => month.month === todayMonth) ?? null;
  const unitMonths = buildUnitMonths(history);
  const currentGroups =
    currentBase == null
      ? []
      : (unitMonths.find((month) => month.month === currentBase.month)?.groups ?? []);
  const factor = seasonalityFor(history.months, next);
  const applySeason = options.seasonal && factor != null;
  const scale = applySeason && factor ? factor.factor : 1;
  const money = moneyForecast(history, next, scale);
  const units = unitForecast(history, stock, assumptions, next, scale);

  return {
    generatedAt: history.generatedAt,
    timezone: history.timezone,
    periodLabel: formatIsoRange(history.period.start, history.period.end),
    totals: history.totals,
    averageOrderValue:
      history.totals.invoices > 0 ? history.totals.salesExGst / history.totals.invoices : null,
    freightShare:
      history.totals.salesExGst !== 0
        ? history.totals.freightExGst / history.totals.salesExGst
        : null,
    coverageText: coverageSentence(history),
    descriptionAmountNote: descriptionAmountNote(history.coverage.units.descriptionAmountsIncGst),
    warnings: history.warnings,
    months,
    seasonality: seasonalityProfile(history.months),
    seasonalityFactor: factor,
    seasonalApplied: applySeason,
    customers:
      history.customers == null
        ? null
        : {
            label: customerWindowLabel(history.period.end, options.customerWindow),
            rows: topCustomers(history.customers, history.period.end, options.customerWindow),
          },
    unitMonths,
    currentMonth: currentBase ? { ...currentBase, groups: currentGroups } : null,
    moneyForecast: money,
    unitForecast: units,
  };
}

export function customerWindowLabel(endIso: string, window: CustomerWindow): string {
  const endMonth = isDate(endIso) ? endIso.slice(0, 7) : endIso.slice(0, 7);
  return `Last ${window} months through ${monthLabel(endMonth)}`;
}

function toMonthInsight(month: HistoryMonth, index: Map<string, HistoryMonth>): MonthInsight {
  const prior = index.get(addMonthsKey(month.month, -12)) ?? null;
  const full = isFullCoverage(month.unitCoverage);
  return {
    ...month,
    label: monthLabel(month.month),
    yoy: yoyChange(month.salesExGst, prior ? prior.salesExGst : null),
    priorLabel: prior ? monthLabel(prior.month) : null,
    fullUnitCoverage: full,
    coverageLabel: full ? null : coverageLabel(month.unitCoverage),
  };
}

function moneyForecast(
  history: History,
  nextMonth: string,
  scale: number,
): HistoryView["moneyForecast"] {
  const end = history.period.end;
  if (!isDate(end) || history.days.length === 0) return null;
  let start = shiftMonths(end, -FORECAST_HISTORY_MONTHS);
  if (history.period.start > start) start = history.period.start;
  if (start > end) return null;
  const tradingDays = tradingDaysInRange(start, end);
  if (tradingDays <= 0) return null;
  let sales = 0;
  let provisional: string | null = null;
  for (const day of history.days) {
    if (day.date < start || day.date > end) continue;
    sales += day.salesExGst;
    if (day.provisional && (provisional == null || day.date > provisional)) provisional = day.date;
  }
  const [year, month] = nextMonth.split("-").map(Number);
  const weekdays = weekdaysInMonth(year ?? 0, month ?? 1);
  const perDay = sales / tradingDays;
  return {
    monthLabel: monthLabel(nextMonth),
    weekdays,
    tradingDays,
    rangeLabel: formatIsoRange(start, end),
    basisLabel: `Money is based on ${tradingDays} trading ${tradingDays === 1 ? "day" : "days"}, ${formatIsoRange(start, end)}. Days with no row count as zero. This uses the full money history in that window, not only days with item details.`,
    expectedExGst: perDay * weekdays * scale,
    provisionalLabel: provisional ? formatIsoDate(provisional) : null,
  };
}

function unitForecast(
  history: History,
  stock: readonly InventoryItem[],
  assumptions: OrderAssumptions,
  nextMonth: string,
  scale: number,
): HistoryView["unitForecast"] {
  const window = unitWindow(history);
  if (!window) return null;
  const fullMonths = history.months
    .filter((month) => isFullCoverage(month.unitCoverage))
    .map((month) => month.month)
    .toSorted();
  if (fullMonths.length === 0) return null;
  const fullSet = new Set(fullMonths);
  const mix = new Map<string, Mix>();
  const typeTotals = new Map<string, number>();
  for (const unit of history.units) {
    if (!fullSet.has(unit.month)) continue;
    const typeKey = unit.type.trim().toLowerCase();
    typeTotals.set(typeKey, (typeTotals.get(typeKey) ?? 0) + unit.qty);
    const key = mixKey(unit);
    const current = mix.get(key) ?? {
      type: unit.type,
      size: unit.size,
      colour: unit.colour,
      kind: unit.kind,
      qty: 0,
    };
    current.qty += unit.qty;
    mix.set(key, current);
  }
  if (mix.size === 0) return null;

  const tradingDays = tradingDaysInRange(window.start, window.end);
  if (tradingDays <= 0) return null;
  const dailyTotals = { bin: 0, lid: 0, part: 0 };
  let provisional: string | null = null;
  for (const day of history.days) {
    if (day.date < window.start || day.date > window.end) continue;
    dailyTotals.bin += day.bins;
    dailyTotals.lid += day.lids;
    dailyTotals.part += day.parts;
    if (day.provisional && (provisional == null || day.date > provisional)) provisional = day.date;
  }

  const [year, month] = nextMonth.split("-").map(Number);
  const weekdays = weekdaysInMonth(year ?? 0, month ?? 1);
  const rates: ForecastRate[] = [];
  for (const row of mix.values()) {
    const typeKey = row.type.trim().toLowerCase();
    const typeQty = typeTotals.get(typeKey) ?? 0;
    if (typeQty === 0) continue;
    const daily = dailyTotals[typeBucket(typeKey)];
    const attributed = (row.qty / typeQty) * daily;
    const perDay = (attributed / tradingDays) * scale;
    const stockKind = stockKindFor(row.type, row.kind);
    const joinsStock = stockKind === "bin" || stockKind === "lid";
    const sized = rateLineFromParts(
      joinsStock ? stockKind : stockKind === "part" ? "part" : "other",
      joinsStock || stockKind === "part" ? row.size : otherSize(row.size, row.kind),
      row.colour,
      attributed,
      perDay,
    );
    rates.push({
      ...sized,
      joinsStock,
      groupTitle: groupTitle(row.type, row.kind, joinsStock),
    });
  }
  if (rates.length === 0) return null;

  const merged = mergeRates(rates);
  const containerRates = merged.filter((line) => line.joinsStock || line.kind === "part");
  const weeks = Math.max(1, Math.round(daySpan(window.start, window.end) / 7));
  const mixNames = fullMonths.map((key) => {
    const row = history.months.find((month) => month.month === key);
    const flags = [row?.partial ? "partial" : "", row?.provisional ? "provisional" : ""]
      .filter(Boolean)
      .join(", ");
    return flags ? `${monthLabel(key)} (${flags})` : monthLabel(key);
  });

  return {
    monthLabel: monthLabel(nextMonth),
    weekdays,
    tradingDays,
    weeks,
    rangeLabel: formatIsoRange(window.start, window.end),
    basisLabel: `Based on ${weeks} ${weeks === 1 ? "week" : "weeks"}, ${formatIsoRange(window.start, window.end)}.`,
    lowConfidence: tradingDays < LOW_CONFIDENCE_BELOW_TRADING_DAYS,
    provisionalLabel: provisional ? formatIsoDate(provisional) : null,
    mixLabel: `Size and colour shares use months with full item coverage: ${mixNames.join(", ")}.`,
    groups: groupRates(merged),
    hasOtherProducts: merged.some((line) => !line.joinsStock && line.kind !== "part"),
    container: containerFromRates(containerRates, stock, assumptions),
  };
}

type Mix = { type: string; size: string; colour: string; kind: string; qty: number };

function unitWindow(history: History): { start: string; end: string } | null {
  const end = history.period.end;
  if (!isDate(end)) return null;
  let start = history.coverage.units.completeFromDate;
  if (!start) {
    const earliest = history.months
      .filter((month) => isFullCoverage(month.unitCoverage))
      .map((month) => month.month)
      .toSorted()[0];
    start = earliest ? `${earliest}-01` : null;
  }
  if (!start || !isDate(start)) return null;
  const capped = shiftMonths(end, -FORECAST_HISTORY_MONTHS);
  if (start < capped) start = capped;
  if (start < history.period.start) start = history.period.start;
  if (start > end) return null;
  return { start, end };
}

function buildUnitMonths(history: History): UnitMonthView[] {
  const byMonth = new Map<string, HistoryUnit[]>();
  for (const unit of history.units) {
    const list = byMonth.get(unit.month) ?? [];
    list.push(unit);
    byMonth.set(unit.month, list);
  }
  return [...byMonth.keys()].toSorted().map((key) => {
    const meta = history.months.find((month) => month.month === key) ?? null;
    const full = isFullCoverage(meta?.unitCoverage ?? null);
    return {
      month: key,
      label: monthLabel(key),
      partial: meta?.partial ?? false,
      provisional: meta?.provisional ?? false,
      full,
      coverageLabel: full ? null : coverageLabel(meta?.unitCoverage ?? null),
      groups: groupUnits(byMonth.get(key) ?? []),
    };
  });
}

function groupUnits(units: readonly HistoryUnit[]): UnitGroup[] {
  const groups = new Map<string, UnitGroup>();
  for (const unit of units) {
    const joins = stockKindFor(unit.type, unit.kind);
    const title = groupTitle(unit.type, unit.kind, joins === "bin" || joins === "lid");
    const named = joins === "part" || joins === "other";
    const sized = rateLineFromParts(
      joins === "bin" || joins === "lid" || joins === "part" ? joins : "other",
      joins === "other" ? otherSize(unit.size, unit.kind) : unit.size,
      unit.colour,
      unit.qty,
      0,
    );
    const group = groups.get(title) ?? { title, named, lines: [] };
    const id = `${sized.id}\0${unit.kind}`;
    const existing = group.lines.find((line) => line.id === id);
    if (existing) existing.qty += unit.qty;
    else group.lines.push({ id, size: sized.size, colour: sized.colour, qty: unit.qty });
    groups.set(title, group);
  }
  for (const group of groups.values()) {
    group.lines = group.lines
      .filter((line) => line.qty !== 0)
      .toSorted((a, b) => a.size.localeCompare(b.size, "en-AU") || a.colour.localeCompare(b.colour, "en-AU"));
  }
  return [...groups.values()].filter((group) => group.lines.length > 0);
}

function groupRates(lines: readonly ForecastRate[]): RateGroup[] {
  const titles: string[] = [];
  const groups = new Map<string, { title: string; named: boolean; lines: ForecastRate[] }>();
  for (const line of lines) {
    const group = groups.get(line.groupTitle) ?? {
      title: line.groupTitle,
      named: line.kind === "part" || line.kind === "other",
      lines: [],
    };
    if (!groups.has(line.groupTitle)) titles.push(line.groupTitle);
    group.lines.push(line);
    groups.set(line.groupTitle, group);
  }
  return titles.map((title) => {
    const group = groups.get(title)!;
    group.lines = group.lines.toSorted(
      (a, b) => a.size.localeCompare(b.size, "en-AU") || a.colour.localeCompare(b.colour, "en-AU"),
    );
    return group;
  });
}

function mergeRates(lines: readonly ForecastRate[]): ForecastRate[] {
  const map = new Map<string, ForecastRate>();
  for (const line of lines) {
    const key = `${line.groupTitle}\0${line.id}`;
    const current = map.get(key);
    if (!current) {
      map.set(key, { ...line });
      continue;
    }
    current.sold += line.sold;
    current.perDay += line.perDay;
  }
  return [...map.values()].filter((line) => line.sold !== 0 || line.perDay !== 0);
}

function seasonalityProfile(months: readonly HistoryMonth[]): SeasonBar[] {
  const seen = new Set<number>();
  for (const month of months) {
    const number = Number(month.month.slice(5, 7));
    if (number >= 1 && number <= 12) seen.add(number);
  }
  return [...seen].toSorted((a, b) => a - b).map((number) => {
    const matching = months.filter((month) => Number(month.month.slice(5, 7)) === number);
    const full = matching.filter((month) => !month.partial);
    const average =
      full.length > 0 ? full.reduce((sum, month) => sum + month.salesExGst, 0) / full.length : null;
    return {
      month: number,
      label: monthLabel(`2000-${String(number).padStart(2, "0")}`).replace(" 2000", ""),
      average,
      years: full.length,
      partialOnly: full.length === 0 && matching.length > 0,
    };
  });
}

function topCustomers(
  customers: readonly HistoryCustomer[],
  endIso: string,
  window: CustomerWindow,
): CustomerRow[] {
  const endMonth = endIso.slice(0, 7);
  const startMonth = addMonthsKey(endMonth, -(window - 1));
  const totals = new Map<string, CustomerRow>();
  for (const row of customers) {
    if (row.month < startMonth || row.month > endMonth || !row.customer) continue;
    const current = totals.get(row.customer) ?? {
      customer: row.customer,
      invoices: 0,
      creditNotes: 0,
      salesExGst: 0,
    };
    current.invoices += row.invoices;
    current.creditNotes += row.creditNotes;
    current.salesExGst += row.salesExGst;
    totals.set(row.customer, current);
  }
  return [...totals.values()]
    .toSorted(
      (a, b) => b.salesExGst - a.salesExGst || a.customer.localeCompare(b.customer, "en-AU"),
    )
    .slice(0, TOP_CUSTOMERS);
}

function stockKindFor(type: string, kind: string): LineKind {
  const normalisedType = type.trim().toLowerCase();
  const normalisedKind = kind.trim().toLowerCase();
  if (normalisedType === "part" || normalisedKind === "part") return "part";
  if ((normalisedType === "bin" || normalisedType === "lid") && normalisedKind === "wheelie") {
    return normalisedType;
  }
  if (normalisedType === "bin" || normalisedType === "lid" || normalisedType === "part") {
    return "other";
  }
  return "other";
}

function otherSize(size: string, kind: string): string {
  const base = rateLineFromParts("bin", size, "", 0, 0).size;
  const label = kind.trim();
  return label ? `${base} ${label}` : base;
}

function groupTitle(type: string, kind: string, wheelie: boolean): string {
  const normalised = type.trim().toLowerCase();
  if (normalised === "part" || kind.trim().toLowerCase() === "part") return "Parts";
  const noun = normalised === "lid" ? "lids" : normalised === "bin" ? "bins" : "items";
  if (wheelie) return noun === "lids" ? "Lids" : "Bins";
  const name = kind.trim();
  const titled = name ? name.charAt(0).toUpperCase() + name.slice(1) : "Other";
  return `${titled} ${noun}`;
}

function typeBucket(typeKey: string): "bin" | "lid" | "part" {
  if (typeKey === "lid") return "lid";
  if (typeKey === "part" || typeKey === "parts") return "part";
  return "bin";
}

function mixKey(unit: HistoryUnit): string {
  return [unit.type, unit.size, unit.colour, unit.kind].join("\0");
}

function isFullCoverage(value: number | null): boolean {
  return value != null && value >= FULL_UNIT_COVERAGE;
}

function coverageLabel(value: number | null): string {
  if (value == null) return "Coverage not stated";
  return `From ${formatShare(value)} of invoices`;
}

export function formatShare(ratio: number): string {
  const percent = ratio * 100;
  const rounded = Math.round(percent * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${text}%`;
}

export function formatSignedPercent(ratio: number): string {
  const percent = ratio * 100;
  const rounded = Math.round(percent * 10) / 10;
  const text = Number.isInteger(rounded) ? String(Math.abs(rounded)) : Math.abs(rounded).toFixed(1);
  if (rounded > 0) return `+${text}%`;
  if (rounded < 0) return `-${text}%`;
  return "0%";
}

function monthLabel(month: string): string {
  const [year, value] = month.split("-").map(Number);
  if (!year || !value) return month;
  return formatMonth(year, value);
}

function nextMonthKey(month: string): string {
  return addMonthsKey(month, 1);
}

function addMonthsKey(month: string, delta: number): string {
  const [year, value] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year ?? 2000, (value ?? 1) - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function parsePeriod(
  input: unknown,
): { value: History["period"] } | { ok: false; error: string } {
  if (!isPlainObject(input)) return fail("period must be an object.");
  const start = parseDate(input.start, "period.start");
  if (typeof start !== "string") return start;
  const end = parseDate(input.end, "period.end");
  if (typeof end !== "string") return end;
  const myobEnd =
    input.myob_end == null || input.myob_end === ""
      ? null
      : parseDate(input.myob_end, "period.myob_end");
  if (myobEnd && typeof myobEnd !== "string") return myobEnd;
  return { value: { start, end, myobEnd } };
}

function parseTotals(
  input: unknown,
): { value: HistoryTotals } | { ok: false; error: string } {
  if (!isPlainObject(input)) return fail("totals must be an object.");
  const invoices = parseNumber(input.invoices, "totals.invoices", MAX_QTY);
  if (typeof invoices !== "number") return invoices;
  const creditNotes = parseNumber(input.credit_notes, "totals.credit_notes", MAX_QTY);
  if (typeof creditNotes !== "number") return creditNotes;
  const salesExGst = parseNumber(input.sales_ex_gst, "totals.sales_ex_gst", MAX_MONEY);
  if (typeof salesExGst !== "number") return salesExGst;
  const salesInclGst = parseNumber(input.sales_incl_gst, "totals.sales_incl_gst", MAX_MONEY);
  if (typeof salesInclGst !== "number") return salesInclGst;
  const freightExGst = parseNumber(input.freight_ex_gst, "totals.freight_ex_gst", MAX_MONEY);
  if (typeof freightExGst !== "number") return freightExGst;
  const creditNotesExGst = parseNumber(
    input.credit_notes_ex_gst,
    "totals.credit_notes_ex_gst",
    MAX_MONEY,
  );
  if (typeof creditNotesExGst !== "number") return creditNotesExGst;
  const bins = parseNumber(input.bins, "totals.bins", MAX_QTY);
  if (typeof bins !== "number") return bins;
  const lids = parseNumber(input.lids, "totals.lids", MAX_QTY);
  if (typeof lids !== "number") return lids;
  const parts = parseNumber(input.parts, "totals.parts", MAX_QTY);
  if (typeof parts !== "number") return parts;
  return {
    value: {
      invoices,
      creditNotes,
      salesExGst,
      salesInclGst,
      freightExGst,
      creditNotesExGst,
      bins,
      lids,
      parts,
    },
  };
}

function parseMonths(
  input: unknown,
): { value: HistoryMonth[] } | { ok: false; error: string } {
  if (!Array.isArray(input)) return fail("monthly must be an array.");
  if (input.length > MAX_MONTHS) return fail(`monthly cannot exceed ${MAX_MONTHS} rows.`);
  const months: HistoryMonth[] = [];
  for (let index = 0; index < input.length; index += 1) {
    const parsed = parseMonth(input[index], index);
    if ("error" in parsed) return parsed;
    months.push(parsed.value);
  }
  return { value: months };
}

function parseMonth(
  input: unknown,
  index: number,
): { value: HistoryMonth } | { ok: false; error: string } {
  if (!isPlainObject(input)) return fail(`monthly[${index}] must be an object.`);
  const month = parseMonthKey(input.month, `monthly[${index}].month`);
  if (typeof month !== "string") return month;
  const partial = parseBool(input.partial, `monthly[${index}].partial`);
  if (typeof partial !== "boolean") return partial;
  const provisional = parseBool(input.provisional, `monthly[${index}].provisional`);
  if (typeof provisional !== "boolean") return provisional;
  const daysInPeriod = parseNumber(input.days_in_period, `monthly[${index}].days_in_period`, 31);
  if (typeof daysInPeriod !== "number") return daysInPeriod;
  const invoices = parseNumber(input.invoices, `monthly[${index}].invoices`, MAX_QTY);
  if (typeof invoices !== "number") return invoices;
  const creditNotes = parseNumber(input.credit_notes, `monthly[${index}].credit_notes`, MAX_QTY);
  if (typeof creditNotes !== "number") return creditNotes;
  const creditNotesExGst = parseNumber(
    input.credit_notes_ex_gst,
    `monthly[${index}].credit_notes_ex_gst`,
    MAX_MONEY,
  );
  if (typeof creditNotesExGst !== "number") return creditNotesExGst;
  const salesExGst = parseNumber(input.sales_ex_gst, `monthly[${index}].sales_ex_gst`, MAX_MONEY);
  if (typeof salesExGst !== "number") return salesExGst;
  const salesInclGst = parseNumber(
    input.sales_incl_gst,
    `monthly[${index}].sales_incl_gst`,
    MAX_MONEY,
  );
  if (typeof salesInclGst !== "number") return salesInclGst;
  const freightExGst = parseNumber(
    input.freight_ex_gst,
    `monthly[${index}].freight_ex_gst`,
    MAX_MONEY,
  );
  if (typeof freightExGst !== "number") return freightExGst;
  const avgOrderValueExGst = optionalNumber(
    input.avg_order_value_ex_gst,
    `monthly[${index}].avg_order_value_ex_gst`,
  );
  if (isFail(avgOrderValueExGst)) return avgOrderValueExGst;
  const freightShare = optionalNumber(input.freight_share, `monthly[${index}].freight_share`);
  if (isFail(freightShare)) return freightShare;
  const bins = parseNumber(input.bins, `monthly[${index}].bins`, MAX_QTY);
  if (typeof bins !== "number") return bins;
  const lids = parseNumber(input.lids, `monthly[${index}].lids`, MAX_QTY);
  if (typeof lids !== "number") return lids;
  const parts = parseNumber(input.parts, `monthly[${index}].parts`, MAX_QTY);
  if (typeof parts !== "number") return parts;
  const invoicesWithUnits = parseNumber(
    input.invoices_with_units,
    `monthly[${index}].invoices_with_units`,
    MAX_QTY,
  );
  if (typeof invoicesWithUnits !== "number") return invoicesWithUnits;
  const unitCoverage = optionalNumber(input.unit_coverage, `monthly[${index}].unit_coverage`);
  if (isFail(unitCoverage)) return unitCoverage;
  return {
    value: {
      month,
      partial,
      provisional,
      daysInPeriod,
      invoices,
      creditNotes,
      creditNotesExGst,
      salesExGst,
      salesInclGst,
      freightExGst,
      avgOrderValueExGst,
      freightShare,
      bins,
      lids,
      parts,
      invoicesWithUnits,
      unitCoverage,
    },
  };
}

function parseDaily(input: unknown): { value: HistoryDay[] } | { ok: false; error: string } {
  if (!isPlainObject(input)) return fail("daily must be an object.");
  const columns = columnIndex(input.columns, DAILY_COLUMNS, "daily.columns");
  if ("error" in columns) return columns;
  if (!Array.isArray(input.rows)) return fail("daily.rows must be an array.");
  if (input.rows.length > MAX_DAILY) return fail(`daily.rows cannot exceed ${MAX_DAILY} rows.`);
  const days: HistoryDay[] = [];
  for (let index = 0; index < input.rows.length; index += 1) {
    const row = input.rows[index];
    if (!Array.isArray(row)) return fail(`daily.rows[${index}] must be an array.`);
    const date = parseDate(row[columns.date], `daily.rows[${index}].date`);
    if (typeof date !== "string") return date;
    const invoices = parseNumber(row[columns.invoices], `daily.rows[${index}].invoices`, MAX_QTY);
    if (typeof invoices !== "number") return invoices;
    const creditNotes = parseNumber(
      row[columns.credit_notes],
      `daily.rows[${index}].credit_notes`,
      MAX_QTY,
    );
    if (typeof creditNotes !== "number") return creditNotes;
    const salesExGst = parseNumber(
      row[columns.sales_ex_gst],
      `daily.rows[${index}].sales_ex_gst`,
      MAX_MONEY,
    );
    if (typeof salesExGst !== "number") return salesExGst;
    const salesInclGst = parseNumber(
      row[columns.sales_incl_gst],
      `daily.rows[${index}].sales_incl_gst`,
      MAX_MONEY,
    );
    if (typeof salesInclGst !== "number") return salesInclGst;
    const freightExGst = parseNumber(
      row[columns.freight_ex_gst],
      `daily.rows[${index}].freight_ex_gst`,
      MAX_MONEY,
    );
    if (typeof freightExGst !== "number") return freightExGst;
    const creditNotesExGst = parseNumber(
      row[columns.credit_notes_ex_gst],
      `daily.rows[${index}].credit_notes_ex_gst`,
      MAX_MONEY,
    );
    if (typeof creditNotesExGst !== "number") return creditNotesExGst;
    const bins = parseNumber(row[columns.bins], `daily.rows[${index}].bins`, MAX_QTY);
    if (typeof bins !== "number") return bins;
    const lids = parseNumber(row[columns.lids], `daily.rows[${index}].lids`, MAX_QTY);
    if (typeof lids !== "number") return lids;
    const parts = parseNumber(row[columns.parts], `daily.rows[${index}].parts`, MAX_QTY);
    if (typeof parts !== "number") return parts;
    const invoicesWithUnits = parseNumber(
      row[columns.invoices_with_units],
      `daily.rows[${index}].invoices_with_units`,
      MAX_QTY,
    );
    if (typeof invoicesWithUnits !== "number") return invoicesWithUnits;
    const provisional = parseBool(row[columns.provisional], `daily.rows[${index}].provisional`);
    if (typeof provisional !== "boolean") return provisional;
    days.push({
      date,
      invoices,
      creditNotes,
      salesExGst,
      salesInclGst,
      freightExGst,
      creditNotesExGst,
      bins,
      lids,
      parts,
      invoicesWithUnits,
      provisional,
    });
  }
  return { value: days };
}

function parseCustomers(
  input: unknown,
): { value: HistoryCustomer[] } | { ok: false; error: string } {
  if (!isPlainObject(input)) return fail("customers_monthly must be an object.");
  const columns = columnIndex(input.columns, CUSTOMER_COLUMNS, "customers_monthly.columns");
  if ("error" in columns) return columns;
  if (!Array.isArray(input.rows)) return fail("customers_monthly.rows must be an array.");
  if (input.rows.length > MAX_CUSTOMERS) {
    return fail(`customers_monthly.rows cannot exceed ${MAX_CUSTOMERS} rows.`);
  }
  const customers: HistoryCustomer[] = [];
  for (let index = 0; index < input.rows.length; index += 1) {
    const row = input.rows[index];
    if (!Array.isArray(row)) return fail(`customers_monthly.rows[${index}] must be an array.`);
    const month = parseMonthKey(row[columns.month], `customers_monthly.rows[${index}].month`);
    if (typeof month !== "string") return month;
    const customer = optionalText(row[columns.customer]);
    const invoices = parseNumber(
      row[columns.invoices],
      `customers_monthly.rows[${index}].invoices`,
      MAX_QTY,
    );
    if (typeof invoices !== "number") return invoices;
    const creditNotes = parseNumber(
      row[columns.credit_notes],
      `customers_monthly.rows[${index}].credit_notes`,
      MAX_QTY,
    );
    if (typeof creditNotes !== "number") return creditNotes;
    const salesExGst = parseNumber(
      row[columns.sales_ex_gst],
      `customers_monthly.rows[${index}].sales_ex_gst`,
      MAX_MONEY,
    );
    if (typeof salesExGst !== "number") return salesExGst;
    customers.push({ month, customer, invoices, creditNotes, salesExGst });
  }
  return { value: customers };
}

function parseUnits(input: unknown): { value: HistoryUnit[] } | { ok: false; error: string } {
  if (!isPlainObject(input)) return fail("units_monthly must be an object.");
  const columns = columnIndex(input.columns, UNIT_COLUMNS, "units_monthly.columns");
  if ("error" in columns) return columns;
  if (!Array.isArray(input.rows)) return fail("units_monthly.rows must be an array.");
  if (input.rows.length > MAX_UNITS) return fail(`units_monthly.rows cannot exceed ${MAX_UNITS} rows.`);
  const units: HistoryUnit[] = [];
  for (let index = 0; index < input.rows.length; index += 1) {
    const row = input.rows[index];
    if (!Array.isArray(row)) return fail(`units_monthly.rows[${index}] must be an array.`);
    const month = parseMonthKey(row[columns.month], `units_monthly.rows[${index}].month`);
    if (typeof month !== "string") return month;
    const qty = parseNumber(row[columns.qty], `units_monthly.rows[${index}].qty`, MAX_QTY);
    if (typeof qty !== "number") return qty;
    units.push({
      month,
      type: optionalText(row[columns.type]),
      size: optionalText(row[columns.size]),
      colour: optionalText(row[columns.colour]),
      kind: optionalText(row[columns.kind]),
      qty,
    });
  }
  return { value: units };
}

function parseCoverage(
  input: unknown,
): { value: History["coverage"] } | { ok: false; error: string } {
  const units = isPlainObject(input) && isPlainObject(input.units) ? input.units : {};
  const invoicesWithUnits = optionalNumber(units.invoices_with_units, "coverage.units.invoices_with_units");
  if (isFail(invoicesWithUnits)) return invoicesWithUnits;
  const invoicesTotal = optionalNumber(units.invoices_total, "coverage.units.invoices_total");
  if (isFail(invoicesTotal)) return invoicesTotal;
  const ratio = optionalNumber(units.ratio, "coverage.units.ratio");
  if (isFail(ratio)) return ratio;
  const still = optionalNumber(units.invoices_still_to_read, "coverage.units.invoices_still_to_read");
  if (isFail(still)) return still;
  let isComplete: boolean | null = null;
  if (units.is_complete != null) {
    const parsed = parseBool(units.is_complete, "coverage.units.is_complete");
    if (typeof parsed !== "boolean") return parsed;
    isComplete = parsed;
  }
  let completeFromDate: string | null = null;
  if (typeof units.complete_from_date === "string" && units.complete_from_date) {
    const parsed = parseDate(units.complete_from_date, "coverage.units.complete_from_date");
    if (typeof parsed !== "string") return parsed;
    completeFromDate = parsed;
  }
  const final = optionalBool(units.final, "coverage.units.final");
  if (isFail(final)) return final;
  const descriptionsDone = optionalNumber(units.descriptions_done, "coverage.units.descriptions_done");
  if (isFail(descriptionsDone)) return descriptionsDone;
  const descriptionsTotal = optionalNumber(
    units.descriptions_total,
    "coverage.units.descriptions_total",
  );
  if (isFail(descriptionsTotal)) return descriptionsTotal;
  const descriptionAmounts = parseStringList(
    units.description_amounts_inc_gst,
    "coverage.units.description_amounts_inc_gst",
  );
  if ("error" in descriptionAmounts) return descriptionAmounts;
  return {
    value: {
      units: {
        invoicesWithUnits,
        invoicesTotal,
        ratio,
        isComplete,
        completeFromDate,
        invoicesStillToRead: still,
        final,
        descriptionsDone,
        descriptionsTotal,
        descriptionAmountsIncGst: descriptionAmounts.value,
      },
    },
  };
}

function parseManifest(
  input: unknown,
): { value: HistoryManifest | null } | { ok: false; error: string } {
  if (!isPlainObject(input) || input.manifest == null) return { value: null };
  const manifest = input.manifest;
  if (!isPlainObject(manifest)) return fail("sources.manifest must be an object or null.");
  const periodStart = optionalDate(manifest.period_start, "sources.manifest.period_start");
  if (isFail(periodStart)) return periodStart;
  const periodEnd = optionalDate(manifest.period_end, "sources.manifest.period_end");
  if (isFail(periodEnd)) return periodEnd;
  const invoiceCount = optionalNumber(manifest.invoice_count, "sources.manifest.invoice_count");
  if (isFail(invoiceCount)) return invoiceCount;
  const descriptionsDone = optionalNumber(
    manifest.descriptions_done,
    "sources.manifest.descriptions_done",
  );
  if (isFail(descriptionsDone)) return descriptionsDone;
  const descriptionsTotal = optionalNumber(
    manifest.descriptions_total,
    "sources.manifest.descriptions_total",
  );
  if (isFail(descriptionsTotal)) return descriptionsTotal;
  const final = optionalBool(manifest.final, "sources.manifest.final");
  if (isFail(final)) return final;
  return {
    value: {
      periodStart,
      periodEnd,
      generatedAt: optionalText(manifest.generated_at) || null,
      invoiceCount,
      descriptionsDone,
      descriptionsTotal,
      final,
    },
  };
}

function parseWarnings(input: unknown): string[] {
  if (!isPlainObject(input) || !Array.isArray(input.warnings)) return [];
  return input.warnings
    .filter((warning): warning is string => typeof warning === "string" && warning.trim() !== "")
    .slice(0, MAX_WARNINGS)
    .map((warning) => warning.trim().slice(0, 500));
}

function columnIndex<T extends readonly string[]>(
  columns: unknown,
  required: T,
  label: string,
): Record<T[number], number> | { ok: false; error: string } {
  if (!Array.isArray(columns) || columns.some((column) => typeof column !== "string")) {
    return fail(`${label} must be an array of column names.`);
  }
  const index = {} as Record<T[number], number>;
  columns.forEach((name, position) => {
    index[name as T[number]] = position;
  });
  for (const name of required) {
    if (index[name as T[number]] == null) return fail(`${label} is missing ${name}.`);
  }
  return index;
}

function fail(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

function isFail(value: unknown): value is { ok: false; error: string } {
  return value != null && typeof value === "object" && "error" in value;
}

function parseDate(value: unknown, label: string): string | { ok: false; error: string } {
  if (typeof value !== "string" || !isDate(value)) {
    return fail(`${label} must be a YYYY-MM-DD date.`);
  }
  return value;
}

function parseMonthKey(value: unknown, label: string): string | { ok: false; error: string } {
  if (typeof value !== "string" || !isMonthKey(value)) {
    return fail(`${label} must be a YYYY-MM month.`);
  }
  return value;
}

function parseBool(value: unknown, label: string): boolean | { ok: false; error: string } {
  if (typeof value !== "boolean") return fail(`${label} must be true or false.`);
  return value;
}

function optionalBool(
  value: unknown,
  label: string,
): boolean | null | { ok: false; error: string } {
  if (value == null || value === "") return null;
  return parseBool(value, label);
}

function optionalDate(
  value: unknown,
  label: string,
): string | null | { ok: false; error: string } {
  if (value == null || value === "") return null;
  return parseDate(value, label);
}

function parseStringList(
  value: unknown,
  label: string,
): { value: string[] } | { ok: false; error: string } {
  if (value == null) return { value: [] };
  if (!Array.isArray(value)) return fail(`${label} must be an array.`);
  if (value.length > 500) return fail(`${label} cannot exceed 500 entries.`);
  const items: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") return fail(`${label} must contain text.`);
    items.push(item.trim().slice(0, 40));
  }
  return { value: items };
}

function parseNumber(
  value: unknown,
  label: string,
  limit: number,
): number | { ok: false; error: string } {
  const numeric = coerceNumber(value);
  if (numeric == null || Math.abs(numeric) > limit) {
    return fail(`${label} must be a number from -${limit} to ${limit}.`);
  }
  return numeric;
}

function optionalNumber(
  value: unknown,
  label: string,
): number | null | { ok: false; error: string } {
  if (value == null || value === "") return null;
  return parseNumber(value, label, MAX_MONEY);
}

function coerceNumber(value: unknown): number | null {
  let numeric = value;
  if (typeof numeric === "string" && /^-?\d+(\.\d+)?$/.test(numeric.trim())) {
    numeric = Number(numeric.trim());
  }
  if (typeof numeric !== "number" || !Number.isFinite(numeric)) return null;
  return numeric;
}

function isDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

function isMonthKey(value: string): boolean {
  return isDate(`${value}-01`);
}

function optionalText(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, MAX_TEXT) : "";
}

function requiredText(value: unknown, label: string): string | { ok: false; error: string } {
  if (typeof value !== "string" || value.trim() === "") return fail(`${label} is required.`);
  return value.trim().slice(0, MAX_TEXT);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}
