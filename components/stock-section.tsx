import { Dashboard } from "@/components/dashboard";
import { presentHistory } from "@/lib/history";
import { sourceLabel } from "@/lib/inventory";
import { loadHistory, loadInventory, loadSales } from "@/lib/store";

export async function StockSection() {
  const [loaded, salesLoaded, historyLoaded] = await Promise.all([
    loadInventory(),
    loadSales(),
    loadHistory(),
  ]);
  const showCustomers = process.env.SHOW_CUSTOMERS === "true";
  const history = historyLoaded.history
    ? presentHistory(historyLoaded.history, showCustomers)
    : null;
  return (
    <Dashboard
      inventory={loaded.inventory}
      sourceLabel={sourceLabel(loaded.origin, loaded.detail)}
      sales={salesLoaded.sales}
      salesDetail={salesLoaded.detail}
      history={history}
      historyDetail={historyLoaded.detail}
    />
  );
}
