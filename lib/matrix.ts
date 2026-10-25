import { compareColour, colourLabel } from "./colours";
import {
  formatNumber,
  stockLevel,
  type InventoryItem,
  type StockLevel,
} from "./inventory";

export type ProductKind = "body" | "lid" | "pedal" | "vermin" | "part" | "other";

export type SizeColumn = {
  key: string;
  label: string;
  litres: number;
};

export type MatrixCell = {
  count: number;
  level: StockLevel;
  items: InventoryItem[];
};

export type WheelieRow = {
  color: string;
  bodies: (MatrixCell | null)[];
  lids: (MatrixCell | null)[];
  bodyTotal: number;
  lidTotal: number;
};

export type SimpleRow = {
  color: string;
  cells: (MatrixCell | null)[];
  total: number;
};

export type PartLine = {
  item: InventoryItem;
  level: StockLevel;
};

export type AttentionLine = {
  id: string;
  label: string;
  detail: string;
  color: string;
  count: number;
  level: StockLevel;
  kind: ProductKind;
  litres: number;
};

export type StockView = {
  wheelie: {
    bodyColumns: SizeColumn[];
    lidColumns: SizeColumn[];
    rows: WheelieRow[];
    bodyColumnTotals: number[];
    lidColumnTotals: number[];
    bodyTotal: number;
    lidTotal: number;
    lines: number;
  };
  pedal: {
    columns: SizeColumn[];
    rows: SimpleRow[];
    columnTotals: number[];
    total: number;
  };
  vermin: {
    columns: SizeColumn[];
    rows: SimpleRow[];
    columnTotals: number[];
    parts: PartLine[];
    total: number;
  };
  other: InventoryItem[];
  attention: {
    urgent: AttentionLine[];
    low: AttentionLine[];
  };
};

const KIND_RANK: Record<ProductKind, number> = {
  body: 0,
  lid: 1,
  pedal: 2,
  vermin: 3,
  part: 4,
  other: 5,
};

const LITRES = /(\d+(?:\.\d+)?)\s*L\b/i;

export function buildStockView(items: readonly InventoryItem[]): StockView {
  const bodies: Placed[] = [];
  const lids: Placed[] = [];
  const pedals: Placed[] = [];
  const vermin: Placed[] = [];
  const parts: InventoryItem[] = [];
  const other: InventoryItem[] = [];

  for (const item of items) {
    const kind = productKind(item);
    if (kind === "part") {
      parts.push(item);
      continue;
    }
    if (kind === "other") {
      other.push(item);
      continue;
    }
    const litres = litresOf(item);
    if (litres == null) {
      other.push(item);
      continue;
    }
    const placed: Placed = {
      item,
      kind,
      color: item.color.trim(),
      column: columnFor(kind, litres),
    };
    if (kind === "body") bodies.push(placed);
    else if (kind === "lid") lids.push(placed);
    else if (kind === "pedal") pedals.push(placed);
    else vermin.push(placed);
  }

  const bodyColumns = columnsOf(bodies);
  const lidColumns = columnsOf(lids);
  const bodyMap = cellMap(bodies);
  const lidMap = cellMap(lids);
  const wheelieColours = [
    ...new Set([...bodies, ...lids].map((row) => row.color)),
  ].toSorted(compareColour);
  const wheelieRows: WheelieRow[] = wheelieColours.map((color) => {
    const bodyCells = columnsToCells(bodyMap, bodyColumns, color);
    const lidCells = columnsToCells(lidMap, lidColumns, color);
    return {
      color,
      bodies: bodyCells,
      lids: lidCells,
      bodyTotal: sumCells(bodyCells),
      lidTotal: sumCells(lidCells),
    };
  });
  const bodyColumnTotals = columnTotals(wheelieRows.map((row) => row.bodies));
  const lidColumnTotals = columnTotals(wheelieRows.map((row) => row.lids));

  const pedalMatrix = simpleMatrix(pedals);
  const verminMatrix = simpleMatrix(vermin);
  const partLines = parts.toSorted(compareParts).map((item) => ({
    item,
    level: stockLevel(item.total_count),
  }));

  const attention = collectAttention(
    [
      { kind: "body", columns: bodyColumns, rows: wheelieRows.map((row) => ({ color: row.color, cells: row.bodies })) },
      { kind: "lid", columns: lidColumns, rows: wheelieRows.map((row) => ({ color: row.color, cells: row.lids })) },
      { kind: "pedal", columns: pedalMatrix.columns, rows: pedalMatrix.rows },
      { kind: "vermin", columns: verminMatrix.columns, rows: verminMatrix.rows },
    ],
    partLines,
    other,
  );

  return {
    wheelie: {
      bodyColumns,
      lidColumns,
      rows: wheelieRows,
      bodyColumnTotals,
      lidColumnTotals,
      bodyTotal: sumNumbers(bodyColumnTotals),
      lidTotal: sumNumbers(lidColumnTotals),
      lines: bodies.length + lids.length,
    },
    pedal: pedalMatrix,
    vermin: {
      columns: verminMatrix.columns,
      rows: verminMatrix.rows,
      columnTotals: verminMatrix.columnTotals,
      parts: partLines,
      total: verminMatrix.total + partLines.reduce((sum, part) => sum + part.item.total_count, 0),
    },
    other: other.toSorted(
      (a, b) => a.total_count - b.total_count || a.item.localeCompare(b.item, "en-AU"),
    ),
    attention,
  };
}

export function cellDetail(cell: MatrixCell): string {
  return itemDetail(cell.items);
}

export function inventoryToCsv(items: readonly InventoryItem[]): string {
  const header = ["category", "item", "sku", "color", "size", "total_count"];
  const rows = items.map((item) =>
    [
      item.category,
      item.item,
      item.sku,
      item.color,
      item.size,
      String(item.total_count),
    ]
      .map(csvField)
      .join(","),
  );
  return [header.join(","), ...rows].join("\n");
}

export function colourName(color: string): string {
  return colourLabel(color);
}

type Placed = {
  item: InventoryItem;
  kind: ProductKind;
  color: string;
  column: SizeColumn;
};

function productKind(item: InventoryItem): ProductKind {
  const sku = item.sku.toUpperCase();
  const text = `${item.category} ${item.item}`.toLowerCase();

  if (sku.includes("PEDAL") || text.includes("pedal")) return "pedal";
  if (sku.includes("VERMIN") || text.includes("vermin")) return "vermin";
  if (
    sku.includes("FLIP-TOP") ||
    sku.includes("FLIP_TOP") ||
    sku.includes("DOME-BIN") ||
    sku.includes("DOME_BIN") ||
    text.includes("flip top") ||
    text.includes("dome bin")
  ) {
    return "part";
  }

  switch (item.category) {
    case "Bin":
      return "body";
    case "Lid":
      return "lid";
    case "Pedal Bin":
      return "pedal";
    case "Vermin Lid":
      return "vermin";
    case "Spare Parts":
      return "part";
    default:
      break;
  }

  if (/(^|[^A-Z])LID([^A-Z]|$)/.test(sku) || text.includes(" lid")) return "lid";
  if (/(^|[^A-Z])BIN([^A-Z]|$)/.test(sku) || text.includes(" bin")) return "body";
  return "other";
}

function litresOf(item: InventoryItem): number | null {
  for (const source of [item.size, item.sku, item.item]) {
    const match = source.match(LITRES);
    if (match?.[1]) return Number(match[1]);
  }
  return null;
}

function columnFor(kind: ProductKind, litres: number): SizeColumn {
  if ((kind === "lid" || kind === "vermin") && (litres === 80 || litres === 120)) {
    return { key: "80/120L", label: "80/120L", litres: 80 };
  }
  const label = `${litres}L`;
  return { key: label, label, litres };
}

function columnsOf(items: readonly Placed[]): SizeColumn[] {
  const map = new Map<string, SizeColumn>();
  for (const row of items) map.set(row.column.key, row.column);
  return [...map.values()].toSorted(
    (a, b) => a.litres - b.litres || a.label.localeCompare(b.label, "en"),
  );
}

function cellMap(items: readonly Placed[]): Map<string, MatrixCell> {
  const grouped = new Map<string, { count: number; items: InventoryItem[] }>();
  for (const row of items) {
    const key = cellKey(row.color, row.column.key);
    const current = grouped.get(key) ?? { count: 0, items: [] };
    current.count += row.item.total_count;
    current.items.push(row.item);
    grouped.set(key, current);
  }
  const cells = new Map<string, MatrixCell>();
  for (const [key, value] of grouped) {
    cells.set(key, {
      count: value.count,
      level: stockLevel(value.count),
      items: value.items,
    });
  }
  return cells;
}

function columnsToCells(
  cells: Map<string, MatrixCell>,
  columns: readonly SizeColumn[],
  color: string,
): (MatrixCell | null)[] {
  return columns.map((column) => cells.get(cellKey(color, column.key)) ?? null);
}

function cellKey(color: string, column: string): string {
  return `${color}\0${column}`;
}

function simpleMatrix(items: readonly Placed[]): {
  columns: SizeColumn[];
  rows: SimpleRow[];
  columnTotals: number[];
  total: number;
} {
  const columns = columnsOf(items);
  const cells = cellMap(items);
  const colours = [...new Set(items.map((row) => row.color))].toSorted(compareColour);
  const rows = colours.map((color) => {
    const rowCells = columnsToCells(cells, columns, color);
    return { color, cells: rowCells, total: sumCells(rowCells) };
  });
  const totals = columnTotals(rows.map((row) => row.cells));
  return { columns, rows, columnTotals: totals, total: sumNumbers(totals) };
}

function columnTotals(rows: readonly (readonly (MatrixCell | null)[])[]): number[] {
  const width = rows[0]?.length ?? 0;
  const totals = Array.from({ length: width }, () => 0);
  for (const row of rows) {
    row.forEach((cell, index) => {
      if (!cell) return;
      totals[index] = (totals[index] ?? 0) + cell.count;
    });
  }
  return totals;
}

function sumCells(cells: readonly (MatrixCell | null)[]): number {
  let total = 0;
  for (const cell of cells) if (cell) total += cell.count;
  return total;
}

function sumNumbers(values: readonly number[]): number {
  let total = 0;
  for (const value of values) total += value;
  return total;
}

function collectAttention(
  groups: {
    kind: ProductKind;
    columns: SizeColumn[];
    rows: { color: string; cells: (MatrixCell | null)[] }[];
  }[],
  parts: readonly PartLine[],
  other: readonly InventoryItem[],
): StockView["attention"] {
  const lines: AttentionLine[] = [];
  for (const group of groups) {
    for (const row of group.rows) {
      row.cells.forEach((cell, index) => {
        if (!cell || cell.level === "in") return;
        const column = group.columns[index];
        if (!column) return;
        lines.push({
          id: `${group.kind}:${column.key}:${row.color}`,
          label: productLabel(group.kind, column.label, row.color, cell.items),
          detail: itemDetail(cell.items),
          color: row.color,
          count: cell.count,
          level: cell.level,
          kind: group.kind,
          litres: column.litres,
        });
      });
    }
  }

  parts.forEach((part, index) => {
    if (part.level === "in") return;
    lines.push({
      id: `part:${part.item.sku}:${index}`,
      label: part.item.item,
      detail: `${part.item.sku} ${formatNumber(part.item.total_count)}`,
      color: part.item.color.trim(),
      count: part.item.total_count,
      level: part.level,
      kind: "part",
      litres: litresOf(part.item) ?? 0,
    });
  });

  other.forEach((item, index) => {
    const level = stockLevel(item.total_count);
    if (level === "in") return;
    lines.push({
      id: `other:${item.sku}:${index}`,
      label: item.item,
      detail: `${item.sku} ${formatNumber(item.total_count)}`,
      color: item.color.trim(),
      count: item.total_count,
      level,
      kind: "other",
      litres: litresOf(item) ?? 0,
    });
  });

  return {
    urgent: lines.filter((line) => line.level !== "low").toSorted(compareAttention),
    low: lines.filter((line) => line.level === "low").toSorted(compareAttention),
  };
}

function productLabel(
  kind: ProductKind,
  size: string,
  color: string,
  items: readonly InventoryItem[],
): string {
  if (kind === "part" || kind === "other") return items[0]?.item || size;
  const noun =
    kind === "body"
      ? "bin"
      : kind === "lid"
        ? "lid"
        : kind === "pedal"
          ? "pedal"
          : "vermin lid";
  const name = `${size} ${noun}`;
  return color ? `${name} - ${color}` : name;
}

function itemDetail(items: readonly InventoryItem[]): string {
  return items
    .map((item) => `${item.item} (${item.sku}): ${formatNumber(item.total_count)}`)
    .join(", ");
}

function compareAttention(a: AttentionLine, b: AttentionLine): number {
  return (
    a.count - b.count ||
    KIND_RANK[a.kind] - KIND_RANK[b.kind] ||
    a.litres - b.litres ||
    compareColour(a.color, b.color) ||
    a.label.localeCompare(b.label, "en-AU")
  );
}

function compareParts(a: InventoryItem, b: InventoryItem): number {
  return partRank(a) - partRank(b) || a.item.localeCompare(b.item, "en-AU");
}

function partRank(item: InventoryItem): number {
  const name = item.item.toLowerCase();
  if (name.includes("flip top")) return 0;
  if (name.includes("dome bin")) return 1;
  return 2;
}

function csvField(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replaceAll('"', '""')}"`;
  return value;
}
