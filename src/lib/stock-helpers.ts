import type {
  BatchStatus,
  Product,
  ProductionBatch,
  StockStatus,
} from "@/lib/types";

export function getCategoryName(categoryId: string, categories: { id: string; name: string }[]) {
  return categories.find((category) => category.id === categoryId)?.name ?? "Uncategorized";
}

export function getProductTotal(product: Product) {
  return (
    product.currentStock.indira +
    product.currentStock.mita +
    product.currentStock.warehouse
  );
}

export function getStockStatus(product: Product): StockStatus {
  const total = getProductTotal(product);

  if (total === 0) {
    return "out";
  }

  if (total <= product.lowStockThreshold) {
    return "low";
  }

  return "healthy";
}

export function getPriorityScore(product: Product) {
  const total = getProductTotal(product);
  const status = getStockStatus(product);
  const statusWeight = status === "out" ? 100 : status === "low" ? 50 : 0;
  const stockWeight = Math.max(0, 100 - total * 6);
  const velocityWeight = Math.min(100, product.velocity30d * 35);

  return Math.round(statusWeight * 0.5 + stockWeight * 0.3 + velocityWeight * 0.2);
}

export function getOpenBatchQuantity(
  productId: string,
  batches: ProductionBatch[],
) {
  return batches
    .filter((batch) => batch.status !== "completed")
    .flatMap((batch) => batch.items)
    .filter((item) => item.productId === productId)
    .reduce(
      (sum, item) => sum + Math.max(0, item.plannedQty - item.receivedQty),
      0,
    );
}

export function getBatchTotals(batch: ProductionBatch) {
  const planned = batch.items.reduce((sum, item) => sum + item.plannedQty, 0);
  const received = batch.items.reduce(
    (sum, item) => sum + item.receivedQty,
    0,
  );

  return { planned, received, remaining: Math.max(0, planned - received) };
}

export function getBatchStatusLabel(status: BatchStatus) {
  if (status === "in_progress") {
    return "In Progress";
  }

  return status === "completed" ? "Completed" : "Draft";
}

export function isBatchEditable(status: BatchStatus) {
  return status !== "completed";
}
