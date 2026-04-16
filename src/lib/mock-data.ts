import type {
  Category,
  Preferences,
  Product,
  ProductionBatch,
  StockMovement,
  UserRole,
} from "@/lib/types";

const now = new Date("2026-04-15T09:40:54+08:00");

export const defaultPreferences: Preferences = {
  rowsPerPage: 10,
  stockView: "current",
};

export const defaultRole: UserRole = "owner";

export const defaultLastSyncedAt = new Date(
  now.getTime() - 12 * 60 * 1000,
).toISOString();

export const defaultCategories: Category[] = [
  { id: "cat-1", name: "VALENTINE'S DAY EDITION", order: 0, createdAt: defaultLastSyncedAt },
  { id: "cat-2", name: "RAMADHAN EDITION", order: 1, createdAt: defaultLastSyncedAt },
  { id: "cat-3", name: "LUNAR NEW YEAR EDITION", order: 2, createdAt: defaultLastSyncedAt },
  { id: "cat-4", name: "GALAXY COLLECTION", order: 3, createdAt: defaultLastSyncedAt },
  { id: "cat-5", name: "CLASSIC ESSENTIALS", order: 4, createdAt: defaultLastSyncedAt }
];

export const defaultProducts: Product[] = [
  {
    id: "prd-1",
    sku: "VAL-GEM-4ER-G",
    name: "4EVER Bracelet | Gold | Valentine's Day Edition",
    categoryId: "cat-1",
    imageHint: "4V",
    currentStock: { indira: 2, mita: 0, warehouse: 17 },
    lowStockThreshold: 7,
    velocity30d: 1.2,
    plannedQuantity: 4,
    plannedNote: "Casting finishing next week",
    wholesaleActive: true,
    consignmentActive: true,
    wholesalePriceEur: 9.9,
    consignmentPriceIdr: 370000,
    updatedAt: defaultLastSyncedAt,
  },
  {
    id: "prd-2",
    sku: "VAL-GEM-4ER-S",
    name: "4EVER Bracelet | Silver | Valentine's Day Edition",
    categoryId: "cat-1",
    imageHint: "4S",
    currentStock: { indira: 0, mita: 0, warehouse: 11 },
    lowStockThreshold: 5,
    velocity30d: 0.4,
    plannedQuantity: 0,
    wholesaleActive: true,
    consignmentActive: true,
    wholesalePriceEur: 8.8,
    consignmentPriceIdr: 342000,
    updatedAt: defaultLastSyncedAt,
  },
  {
    id: "prd-3",
    sku: "VAL-GEM-B-G",
    name: "BABE Bracelet | Gold | Valentine's Day Edition",
    categoryId: "cat-1",
    imageHint: "BB",
    currentStock: { indira: 0, mita: 0, warehouse: 10 },
    lowStockThreshold: 5,
    velocity30d: 0.9,
    plannedQuantity: 0,
    wholesaleActive: true,
    consignmentActive: true,
    wholesalePriceEur: 8.6,
    consignmentPriceIdr: 335000,
    updatedAt: defaultLastSyncedAt,
  },
  {
    id: "prd-4",
    sku: "VAL-GEM-B-S",
    name: "BABE Bracelet | Silver | Valentine's Day Edition",
    categoryId: "cat-1",
    imageHint: "BS",
    currentStock: { indira: 0, mita: 0, warehouse: 0 },
    lowStockThreshold: 5,
    velocity30d: 1.7,
    plannedQuantity: 16,
    plannedNote: "Covered by new plating run",
    wholesaleActive: true,
    consignmentActive: false,
    wholesalePriceEur: 9.4,
    consignmentPriceIdr: 365000,
    updatedAt: defaultLastSyncedAt,
  },
  {
    id: "prd-5",
    sku: "RE-GEM-EM-G",
    name: "Eid Mubarak Bracelet | Gold | Ramadhan Edition",
    categoryId: "cat-2",
    imageHint: "EM",
    currentStock: { indira: 0, mita: 0, warehouse: 0 },
    lowStockThreshold: 6,
    velocity30d: 0.8,
    plannedQuantity: 20,
    plannedNote: "Incoming from workshop A",
    wholesaleActive: true,
    consignmentActive: true,
    wholesalePriceEur: 10.2,
    consignmentPriceIdr: 392000,
    updatedAt: defaultLastSyncedAt,
  },
  {
    id: "prd-6",
    sku: "LNY-GEM-IW-G",
    name: "Iron Will Bracelet | Gold | Lunar New Year Edition",
    categoryId: "cat-3",
    imageHint: "IW",
    currentStock: { indira: 0, mita: 0, warehouse: 0 },
    lowStockThreshold: 4,
    velocity30d: 0.2,
    plannedQuantity: 0,
    wholesaleActive: false,
    consignmentActive: true,
    wholesalePriceEur: 7.9,
    consignmentPriceIdr: 310000,
    updatedAt: defaultLastSyncedAt,
  },
  {
    id: "prd-7",
    sku: "LNY-GEM-IW-S",
    name: "Iron Will Bracelet | Silver | Lunar New Year Edition",
    categoryId: "cat-3",
    imageHint: "IS",
    currentStock: { indira: 0, mita: 0, warehouse: 11 },
    lowStockThreshold: 4,
    velocity30d: 0.5,
    plannedQuantity: 0,
    wholesaleActive: true,
    consignmentActive: true,
    wholesalePriceEur: 8.2,
    consignmentPriceIdr: 318000,
    updatedAt: defaultLastSyncedAt,
  },
  {
    id: "prd-8",
    sku: "RE-GEM-LAL-Q",
    name: "Laylat al-Qadr Bracelet | Gold | Ramadhan Edition",
    categoryId: "cat-2",
    imageHint: "LQ",
    currentStock: { indira: 0, mita: 0, warehouse: 0 },
    lowStockThreshold: 5,
    velocity30d: 1.1,
    plannedQuantity: 8,
    plannedNote: "Waiting assembly",
    wholesaleActive: true,
    consignmentActive: true,
    wholesalePriceEur: 9.1,
    consignmentPriceIdr: 356000,
    updatedAt: defaultLastSyncedAt,
  },
  {
    id: "prd-9",
    sku: "GAL-MON-LUNE-G",
    name: "Moon Lunar Eclipse Bracelet | Gold",
    categoryId: "cat-4",
    imageHint: "ML",
    currentStock: { indira: 0, mita: 0, warehouse: 23 },
    lowStockThreshold: 8,
    velocity30d: 1.4,
    plannedQuantity: 0,
    wholesaleActive: true,
    consignmentActive: true,
    wholesalePriceEur: 11.4,
    consignmentPriceIdr: 405000,
    updatedAt: defaultLastSyncedAt,
  },
  {
    id: "prd-10",
    sku: "RE-GEM-NI-G",
    name: "Noor Iftar Bracelet | Gold | Ramadhan Edition",
    categoryId: "cat-2",
    imageHint: "NI",
    currentStock: { indira: 0, mita: 1, warehouse: 0 },
    lowStockThreshold: 6,
    velocity30d: 2.2,
    plannedQuantity: 12,
    plannedNote: "Hand-off to Indira expected",
    wholesaleActive: true,
    consignmentActive: true,
    wholesalePriceEur: 10.8,
    consignmentPriceIdr: 398000,
    updatedAt: defaultLastSyncedAt,
  }
];

export const defaultBatches: ProductionBatch[] = [
  {
    id: "batch-1",
    code: "BAT-240415-01",
    status: "prepared",
    assignedSource: "Craftsman Arif",
    destinationStockKey: "indira",
    notes: "Priority Ramadan replenishment",
    createdAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: defaultLastSyncedAt,
    createdBy: "Production Lead",
    items: [
      { id: "line-1", productId: "prd-5", plannedQty: 20, receivedQtyConfirmed: 0 },
      { id: "line-2", productId: "prd-10", plannedQty: 12, receivedQtyConfirmed: 0 }
    ]
  },
  {
    id: "batch-2",
    code: "BAT-240414-02",
    status: "partially_received",
    assignedSource: "Workshop Nusa",
    destinationStockKey: "warehouse",
    notes: "Valentine backfill",
    createdAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: defaultLastSyncedAt,
    createdBy: "Production Lead",
    items: [
      { id: "line-3", productId: "prd-4", plannedQty: 10, receivedQtyConfirmed: 5 },
      { id: "line-4", productId: "prd-8", plannedQty: 8, receivedQtyConfirmed: 8 }
    ]
  }
];

export const defaultMovements: StockMovement[] = [
  {
    id: "mv-1",
    productId: "prd-4",
    qtyDelta: 5,
    destinationStockKey: "warehouse",
    source: "production_batch_receive",
    createdAt: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
    actor: "Production Lead",
    batchId: "batch-2",
    reason: "First partial receive"
  }
];
