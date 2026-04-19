import { redirect } from "next/navigation";

export default async function MasterStockPlanDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/master-stock/incoming/${id}`);
}
