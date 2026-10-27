const COLOUR_ORDER = [
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
];

const COLOUR_SWATCH: Record<string, string> = {
  Black: "#242424",
  "Dark Grey": "#7d838c",
  White: "#ffffff",
  "Light Blue": "#7eb6e0",
  "Royal Blue": "#3d6fad",
  Purple: "#a98bc4",
  Red: "#e58b8b",
  Orange: "#f0a15a",
  Yellow: "#f0cc55",
  "Lime Green": "#b6d36a",
  "Shadow Green": "#7ea07a",
  "Dark Green": "#3e6b4e",
};

const COLOUR_TINT: Record<string, string> = {
  Black: "#dedee2",
  "Dark Grey": "#e4e5e8",
  White: "#f3f4f6",
  "Light Blue": "#d4ebf8",
  "Royal Blue": "#d5e4f4",
  Purple: "#eadff3",
  Red: "#f8d4d6",
  Orange: "#fde4c8",
  Yellow: "#fcefc0",
  "Lime Green": "#e7f3c4",
  "Shadow Green": "#dce8d8",
  "Dark Green": "#d5e4da",
};

export function colourLabel(color: string): string {
  const trimmed = color.trim();
  return trimmed || "Unspecified";
}

export function canonicalColour(color: string): string {
  const key = color.trim().replace(/\s+/g, " ").toLowerCase().replaceAll("gray", "grey");
  if (!key) return "";
  const known = COLOUR_ORDER.find(
    (name) => name.toLowerCase().replaceAll("gray", "grey") === key,
  );
  if (known) return known;
  return key.replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

export function compareColour(a: string, b: string): number {
  const rank = colourRank(a) - colourRank(b);
  if (rank !== 0) return rank;
  return a.localeCompare(b, "en-AU");
}

export function swatchColour(color: string): string {
  const known = COLOUR_SWATCH[color];
  if (known) return known;
  if (!color.trim()) return "#d4d4d8";
  let hash = 0;
  for (let index = 0; index < color.length; index += 1) {
    hash = (hash * 33 + color.charCodeAt(index)) >>> 0;
  }
  return `hsl(${hash % 360} 42% 46%)`;
}

export function cellBackground(color: string): string {
  const tint = COLOUR_TINT[color];
  if (tint) return tint;
  if (!color.trim()) return "#ececee";
  return `color-mix(in srgb, ${swatchColour(color)} 30%, white)`;
}

export function swatchNeedsBorder(color: string): boolean {
  return !color.trim() || color === "White";
}

function colourRank(color: string): number {
  if (!color.trim()) return COLOUR_ORDER.length + 1;
  const index = COLOUR_ORDER.indexOf(color);
  return index === -1 ? COLOUR_ORDER.length : index;
}
