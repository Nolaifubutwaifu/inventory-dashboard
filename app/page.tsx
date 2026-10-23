import { Suspense } from "react";
import { StockSection } from "@/components/stock-section";
import { StockSkeleton } from "@/components/stock-skeleton";

export default function Page() {
  return (
    <Suspense fallback={<StockSkeleton />}>
      <StockSection />
    </Suspense>
  );
}
