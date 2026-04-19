import { ProductionPlanDetailPage } from "@/components/master-stock/production-plan-detail-page";

export default async function BatchDetailRoute({
  params,
}: {
  params: Promise<{ batchId: string }>;
}) {
  const { batchId } = await params;

  return <ProductionPlanDetailPage planId={batchId} />;
}
