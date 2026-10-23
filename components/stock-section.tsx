import { Dashboard } from "@/components/dashboard";
import { sourceLabel } from "@/lib/inventory";
import { loadInventory } from "@/lib/store";

export async function StockSection() {
  const loaded = await loadInventory();
  return (
    <Dashboard
      inventory={loaded.inventory}
      sourceLabel={sourceLabel(loaded.origin, loaded.detail)}
    />
  );
}
