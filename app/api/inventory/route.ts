import { loadInventory } from "@/lib/store";

export async function GET() {
  const loaded = await loadInventory();
  return Response.json(loaded.inventory, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
