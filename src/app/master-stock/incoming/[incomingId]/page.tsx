import { BatchDetailPage } from "@/components/master-stock/batch-detail-page";

export default async function IncomingDetailRoute({
  params,
}: {
  params: Promise<{ incomingId: string }>;
}) {
  const { incomingId } = await params;

  return <BatchDetailPage batchId={incomingId} />;
}
