import { Dashboard } from "@/components/dashboard";
import { sourceLabel } from "@/lib/inventory";
import { loadInventory, loadSales } from "@/lib/store";

export async function StockSection() {
  const [loaded, salesLoaded] = await Promise.all([loadInventory(), loadSales()]);
  return (
    <Dashboard
      inventory={loaded.inventory}
      sourceLabel={sourceLabel(loaded.origin, loaded.detail)}
      sales={salesLoaded.sales}
      salesDetail={salesLoaded.detail}
    />
  );
}
