import { ProductionPlanDetailPage } from "@/components/master-stock/production-plan-detail-page";

export default async function MasterStockPlanDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <ProductionPlanDetailPage planId={id} />;
}
