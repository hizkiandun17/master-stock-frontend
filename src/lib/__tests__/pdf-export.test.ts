import { describe, expect, it } from "vitest";

import { buildMasterStockPdfModel, buildTemporaryProductionBatchPdfModel } from "@/lib/pdf-export";
import type { Category, Product, ProductionBatch, ProductionPlan } from "@/lib/types";

const categories: Category[] = [
  {
    id: "cat-1",
    name: "GEMSTONE GOLD COLLECTION",
    order: 0,
    createdAt: "2026-04-17T00:00:00.000Z",
  },
];

const products: Product[] = [
  {
    id: "prd-1",
    sku: "YOG-CHA-NUG-MOO-G",
    name: "7 Chakras Moonstone Bracelet | Gold",
    categoryId: "cat-1",
    imageHint: "7C",
    currentStock: {
      indira: 2,
      mita: 0,
      warehouse: 20,
    },
    lowStockThreshold: 4,
    velocity30d: 0,
    wholesaleActive: true,
    consignmentActive: true,
    wholesalePriceEur: 9.9,
    consignmentPriceIdr: 370000,
    updatedAt: "2026-04-17T00:00:00.000Z",
  },
  {
    id: "prd-2",
    sku: "GEM-AFTU-G",
    name: "African Turquoise Bracelet | Gold",
    categoryId: "cat-1",
    imageHint: "AT",
    currentStock: {
      indira: 0,
      mita: 0,
      warehouse: 1,
    },
    lowStockThreshold: 4,
    velocity30d: 0,
    wholesaleActive: true,
    consignmentActive: true,
    wholesalePriceEur: 9.9,
    consignmentPriceIdr: 370000,
    updatedAt: "2026-04-17T00:00:00.000Z",
  },
];

const productionPlans: ProductionPlan[] = [
  {
    id: "plan-1",
    source: "indira",
    items: [{ productId: "prd-1", quantity: 10 }],
    createdAt: "2026-04-17T00:00:00.000Z",
  },
  {
    id: "plan-2",
    source: "indira",
    items: [{ productId: "prd-1", quantity: 6 }],
    createdAt: "2026-04-17T01:00:00.000Z",
  },
];

const submittedBatch: ProductionBatch = {
  id: "incoming-1",
  name: "Kiriman Indira",
  source: "indira",
  status: "submitted",
  createdAt: "2026-04-24T00:00:00.000Z",
  updatedAt: "2026-04-24T00:00:00.000Z",
  createdBy: "production",
  submittedAt: "2026-04-24T01:00:00.000Z",
  items: [
    {
      id: "incoming-item-1",
      productId: "prd-1",
      quantity: 14,
    },
  ],
  history: [],
};

describe("buildMasterStockPdfModel", () => {
  it("replaces the selected source column with production-plan quantities", () => {
    const model = buildMasterStockPdfModel({
      products,
      categories,
      mode: "production-plan",
      source: "indira",
      productionPlans,
    });

    expect(model.mode).toBe("production-plan");
    expect(model.source).toBe("indira");
    expect(model.totalSkus).toBe(2);
    expect(model.sections[0]?.rows[0]).toMatchObject({
      indira: "16",
      mita: "0",
      inStock: "20",
      total: "36",
      updatedSource: true,
      updatedTotal: true,
      lowStock: false,
    });
  });

  it("keeps original stock values for products that are not in the plan", () => {
    const model = buildMasterStockPdfModel({
      products,
      categories,
      mode: "production-plan",
      source: "indira",
      productionPlans,
    });

    expect(model.sections[0]?.rows[1]).toMatchObject({
      indira: "0",
      mita: "0",
      inStock: "1",
      total: "1",
      updatedSource: false,
      updatedTotal: false,
      lowStock: true,
    });
  });

  it("maps submitted production batch quantities into the selected source column", () => {
    const model = buildTemporaryProductionBatchPdfModel({
      batch: submittedBatch,
      products,
      categories,
    });

    expect(model.mode).toBe("production-plan");
    expect(model.source).toBe("indira");
    expect(model.sections[0]?.rows[0]).toMatchObject({
      indira: "14",
      mita: "0",
      inStock: "20",
      total: "34",
      updatedSource: true,
      updatedTotal: true,
    });
  });
});
