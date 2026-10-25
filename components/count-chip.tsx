import { cellBackground, colourLabel, swatchColour, swatchNeedsBorder } from "@/lib/colours";
import { formatNumber, stockLevel, type StockLevel } from "@/lib/inventory";

const LEVEL_LABEL: Record<StockLevel, string> = {
  backorder: "Backorder",
  out: "Out of stock",
  reorder: "Reorder",
  low: "Low",
  in: "In stock",
};

export function Swatch({ color }: { color: string }) {
  const border = swatchNeedsBorder(color);
  return (
    <span
      aria-hidden="true"
      className={`inline-block h-3.5 w-3.5 shrink-0 rounded-[4px] ${border ? "ring-1 ring-neutral-300" : ""}`}
      style={{ backgroundColor: swatchColour(color) }}
    />
  );
}

export function CountChip({
  count,
  color = "",
  title,
}: {
  count: number;
  color?: string;
  title?: string;
}) {
  const level = stockLevel(count);
  const label = formatNumber(count);
  const described = `${LEVEL_LABEL[level]}, ${label}`;

  if (level === "backorder" || level === "out") {
    return (
      <span
        title={title ?? LEVEL_LABEL[level]}
        aria-label={described}
        className="inline-flex h-7 min-w-7 items-center justify-center rounded-[7px] bg-[#6e1d24] px-1.5 text-[12.5px] font-semibold text-white tabular-nums"
      >
        {label}
      </span>
    );
  }

  if (level === "reorder") {
    return (
      <span
        title={title ?? "Reorder"}
        aria-label={described}
        className="inline-flex h-7 min-w-7 items-center justify-center rounded-[7px] bg-[#e11d2e] px-1.5 text-[12.5px] font-semibold text-white tabular-nums"
      >
        {label}
      </span>
    );
  }

  if (level === "low") {
    return (
      <span
        title={title ?? "Low"}
        aria-label={described}
        className="inline-flex h-7 min-w-7 items-center justify-center rounded-[7px] border-[1.5px] border-[#f97316] bg-white px-1.5 text-[12.5px] font-semibold text-[#ea580c] tabular-nums"
      >
        {label}
      </span>
    );
  }

  return (
    <span
      title={title ?? "In stock"}
      aria-label={described}
      className={`inline-flex h-7 min-w-8 items-center justify-center rounded-[7px] px-1.5 text-[12.5px] font-medium text-neutral-800 tabular-nums ${color === "White" ? "shadow-[inset_0_0_0_1px_#e5e7eb]" : ""}`}
      style={{ backgroundColor: color ? cellBackground(color) : "#e5e7eb" }}
    >
      {label}
    </span>
  );
}

export function ColourName({ color }: { color: string }) {
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      <Swatch color={color} />
      <span className="text-[13px] font-medium text-neutral-800">{colourLabel(color)}</span>
    </span>
  );
}
