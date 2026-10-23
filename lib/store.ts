import "server-only";
import { cache } from "react";
import { get, put } from "@vercel/blob";
import { unstable_rethrow } from "next/navigation";
import { connection } from "next/server";
import seedJson from "../data/inventory.json";
import { blobAccess, blobConfigured } from "./blob-config";
import {
  INVENTORY_BLOB_PATH,
  parseInventory,
  type Inventory,
  type LoadDetail,
  type LoadOrigin,
} from "./inventory";

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
