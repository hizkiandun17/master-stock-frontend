import { redirect } from "next/navigation";

export default async function BatchDetailRoute({
  params,
}: {
  params: Promise<{ batchId: string }>;
}) {
  await params;
  redirect("/master-stock");
}
