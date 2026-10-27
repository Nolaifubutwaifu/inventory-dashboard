import "server-only";
import { cache } from "react";
import { get, put } from "@vercel/blob";
import { unstable_rethrow } from "next/navigation";
import { connection } from "next/server";
import seedJson from "../data/inventory.json";
import sampleSalesJson from "../data/sales.sample.json";
import { blobAccess, blobConfigured } from "./blob-config";
import { HISTORY_BLOB_PATH, parseHistory, type History, type HistoryLoadDetail } from "./history";
import {
  INVENTORY_BLOB_PATH,
  parseInventory,
  type Inventory,
  type LoadDetail,
  type LoadOrigin,
} from "./inventory";
import {
  parseSales,
  SALES_BLOB_PATH,
  type Sales,
  type SalesLoadDetail,
} from "./sales";

export type LoadedInventory = {
  inventory: Inventory;
  origin: LoadOrigin;
  detail: LoadDetail;
};

let seeded: Inventory | null = null;

function seedInventory(): Inventory {
  if (seeded) return seeded;
  const parsed = parseInventory(seedJson);
  if (!parsed.ok) {
    throw new Error(`Seeded inventory is invalid: ${parsed.error}`);
  }
  seeded = parsed.value;
  return seeded;
}

export const loadInventory = cache(async (): Promise<LoadedInventory> => {
  await connection();

  if (!blobConfigured()) {
    return { inventory: seedInventory(), origin: "seed", detail: "unconfigured" };
  }

  try {
    const result = await get(INVENTORY_BLOB_PATH, {
      access: blobAccess(),
      useCache: false,
    });

    if (!result || result.statusCode !== 200 || !result.stream) {
      return { inventory: seedInventory(), origin: "seed", detail: "empty" };
    }

    const text = await new Response(result.stream).text();
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      console.error("Blob inventory.json is not JSON");
      return { inventory: seedInventory(), origin: "seed", detail: "invalid" };
    }

    const parsed = parseInventory(body);
    if (!parsed.ok) {
      console.error("Blob inventory.json failed validation:", parsed.error);
      return { inventory: seedInventory(), origin: "seed", detail: "invalid" };
    }

    return { inventory: parsed.value, origin: "blob", detail: null };
  } catch (error) {
    unstable_rethrow(error);
    console.error(
      "Blob read failed:",
      error instanceof Error ? error.message : error,
    );
    return { inventory: seedInventory(), origin: "seed", detail: "error" };
  }
});

export async function saveInventory(inventory: Inventory): Promise<void> {
  await put(INVENTORY_BLOB_PATH, JSON.stringify(inventory), {
    access: blobAccess(),
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: 60,
  });
}

export type LoadedSales = {
  sales: Sales | null;
  detail: SalesLoadDetail;
};

export const loadSales = cache(async (): Promise<LoadedSales> => {
  await connection();

  if (!blobConfigured()) {
    return previewSales() ?? { sales: null, detail: "unconfigured" };
  }

  try {
    const result = await get(SALES_BLOB_PATH, {
      access: blobAccess(),
      useCache: false,
    });

    if (!result || result.statusCode !== 200 || !result.stream) {
      return previewSales() ?? { sales: null, detail: "empty" };
    }

    const text = await new Response(result.stream).text();
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      console.error("Blob sales.json is not JSON");
      return { sales: null, detail: "invalid" };
    }

    const parsed = parseSales(body);
    if (!parsed.ok) {
      console.error("Blob sales.json failed validation:", parsed.error);
      return { sales: null, detail: "invalid" };
    }

    return { sales: parsed.value, detail: null };
  } catch (error) {
    unstable_rethrow(error);
    console.error(
      "Blob sales read failed:",
      error instanceof Error ? error.message : error,
    );
    return { sales: null, detail: "error" };
  }
});

export async function saveSales(sales: Sales): Promise<void> {
  await put(SALES_BLOB_PATH, JSON.stringify(sales), {
    access: blobAccess(),
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: 60,
  });
}

function previewSales(): LoadedSales | null {
  if (process.env.SALES_PREVIEW !== "1") return null;
  const parsed = parseSales(sampleSalesJson);
  if (!parsed.ok) return { sales: null, detail: "invalid" };
  return { sales: parsed.value, detail: "preview" };
}

export type LoadedHistory = {
  history: History | null;
  detail: HistoryLoadDetail;
};

export const loadHistory = cache(async (): Promise<LoadedHistory> => {
  await connection();

  if (!blobConfigured()) {
    return (await previewHistory()) ?? { history: null, detail: "unconfigured" };
  }

  try {
    const result = await get(HISTORY_BLOB_PATH, {
      access: blobAccess(),
      useCache: false,
    });

    if (!result || result.statusCode !== 200 || !result.stream) {
      return (await previewHistory()) ?? { history: null, detail: "empty" };
    }

    const text = await new Response(result.stream).text();
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      console.error("Blob history.json is not JSON");
      return { history: null, detail: "invalid" };
    }

    const parsed = parseHistory(body);
    if (!parsed.ok) {
      console.error("Blob history.json failed validation:", parsed.error);
      return { history: null, detail: "invalid" };
    }

    return { history: parsed.value, detail: null };
  } catch (error) {
    unstable_rethrow(error);
    console.error(
      "Blob history read failed:",
      error instanceof Error ? error.message : error,
    );
    return { history: null, detail: "error" };
  }
});

export async function saveHistory(body: unknown): Promise<void> {
  await put(HISTORY_BLOB_PATH, JSON.stringify(body), {
    access: blobAccess(),
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: 60,
  });
}

async function previewHistory(): Promise<LoadedHistory | null> {
  if (process.env.HISTORY_PREVIEW !== "1") return null;
  const sample = (await import("../data/history.sample.json")).default;
  const parsed = parseHistory(sample);
  if (!parsed.ok) return { history: null, detail: "invalid" };
  return { history: parsed.value, detail: "preview" };
}
