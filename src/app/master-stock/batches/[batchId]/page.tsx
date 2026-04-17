import { BatchDetailPage } from "@/components/master-stock/batch-detail-page";

export default async function BatchDetailRoute({
  params,
}: {
  params: Promise<{ batchId: string }>;
}) {
  const { batchId } = await params;

  return <BatchDetailPage batchId={batchId} />;
}
