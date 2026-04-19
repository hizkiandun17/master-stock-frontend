import type { BatchStatus, Product, ProductionBatch, StockStatus } from "@/lib/types";

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

export function getBatchReceivedByProduct(batch: ProductionBatch) {
  return batch.items.reduce<Map<string, number>>((accumulator, item) => {
    if (!item.checked) {
      return accumulator;
    }

    const targetProductId = item.mappedProductId ?? item.productId;
    if (!targetProductId) {
      return accumulator;
    }

    accumulator.set(
      targetProductId,
      (accumulator.get(targetProductId) ?? 0) + Math.max(0, item.quantity),
    );
    return accumulator;
  }, new Map());
}

export function getBatchAggregateItems(batch: ProductionBatch) {
  return batch.items.map((item) => ({
    productId: item.mappedProductId ?? item.productId,
    quantity: Math.max(0, item.quantity),
  }));
}

export function getOpenBatchQuantity(productId: string, batches: ProductionBatch[]) {
  return batches
    .filter((batch) => batch.status !== "completed")
    .flatMap((batch) => getBatchAggregateItems(batch))
    .filter((item) => item.productId === productId)
    .reduce((sum, item) => sum + item.quantity, 0);
}

export function getBatchTotals(batch: ProductionBatch) {
  const total = batch.items.reduce((sum, item) => sum + Math.max(0, item.quantity), 0);
  const mappedTotal = batch.items
    .filter((item) => Boolean(item.mappedProductId ?? item.productId))
    .reduce((sum, item) => sum + Math.max(0, item.quantity), 0);
  const customCount = batch.items.filter((item) => item.isCustom).length;
  return { total, mappedTotal, customCount };
}

export function getBatchStatusLabel(status: BatchStatus) {
  if (status === "submitted") {
    return "Submitted";
  }

  if (status === "receiving") {
    return "Receiving";
  }

  return status === "completed" ? "Completed" : "Draft";
}

export function isBatchEditable(status: BatchStatus) {
  return status !== "completed";
}
