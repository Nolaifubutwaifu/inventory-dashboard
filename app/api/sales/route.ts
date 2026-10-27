import { loadSales } from "@/lib/store";

export async function GET() {
  const loaded = await loadSales();
  if (!loaded.sales) {
    return Response.json(
      { sales: null, detail: loaded.detail },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
  return Response.json(loaded.sales, {
    headers: { "Cache-Control": "no-store" },
  });
}
