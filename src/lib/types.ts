export type UserRole = "owner" | "admin" | "production_lead" | "production";
export type StockStatus = "healthy" | "low" | "out";
export type StockLocationKey = "indira" | "mita" | "warehouse";
export type ProductionPlanSource = "indira" | "mita";
export type ProductionPlanStatus = "draft" | "completed";
export type BatchStatus = "draft" | "submitted" | "receiving" | "completed" | "cancelled";
export type ActivityKind = "created" | "added" | "removed" | "edited" | "completed";

export interface Category {
  id: string;
  name: string;
  order: number;
  createdAt: string;
}

export interface StockLevels {
  indira: number;
  mita: number;
  warehouse: number;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  categoryId: string;
  imageHint: string;
  currentStock: StockLevels;
  lowStockThreshold: number;
  velocity30d: number;
  wholesaleActive: boolean;
  consignmentActive: boolean;
  wholesalePriceEur: number;
  consignmentPriceIdr: number;
  archived?: boolean;
  updatedAt: string;
}

export interface ProductionPlanItem {
  productId: string;
  plannedQty: number;
  quantity: number;
}

export interface ActivityEntry {
  id: string;
  kind: ActivityKind;
  title: string;
  detail?: string;
  actor?: string;
  createdAt: string;
  action?: string;
}

export interface ProductionPlan {
  id: string;
  name: string;
  source: ProductionPlanSource;
  notes?: string;
  items: ProductionPlanItem[];
  createdAt: string;
  status: ProductionPlanStatus;
  completedAt?: string;
  history: ActivityEntry[];
}

export interface BatchPlannedItem {
  id: string;
  productId?: string;
  isCustom?: boolean;
  customName?: string;
  note?: string;
  mappedProductId?: string;
  checked?: boolean;
  quantity: number;
}

export interface ProductionBatch {
  id: string;
  name?: string;
  source: StockLocationKey;
  status: BatchStatus;
  notes?: string;
  revisionNumber?: number;
  previousRevisionId?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  submittedAt?: string;
  cancelledAt?: string;
  receivingAt?: string;
  completedAt?: string;
  items: BatchPlannedItem[];
  history: ActivityEntry[];
}

export interface StockMovement {
  id: string;
  productId: string;
  qtyDelta: number;
  destinationStockKey: StockLocationKey;
  source: "manual_adjustment" | "production_batch_receive";
  createdAt: string;
  actor: string;
  batchId?: string;
  reason?: string;
}

export interface AdjustmentLog {
  id: string;
  productId: string;
  locationKey: StockLocationKey;
  oldValue: number;
  newValue: number;
  reason: string;
  createdAt: string;
  actor: string;
}

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  variant?: "default" | "success" | "warning" | "danger";
}

export interface Preferences {
  rowsPerPage: number;
}

export interface CreateBatchInput {
  name?: string;
  source: StockLocationKey;
  notes?: string;
  items?: Array<{
    productId?: string;
    isCustom?: boolean;
    customName?: string;
    note?: string;
    mappedProductId?: string;
    checked?: boolean;
    quantity: number;
  }>;
}

export interface AddProductInput {
  name: string;
  sku: string;
  categoryId: string;
  imageHint: string;
  currentStock: StockLevels;
  lowStockThreshold: number;
  wholesaleActive?: boolean;
  consignmentActive?: boolean;
  wholesalePriceEur?: number;
  consignmentPriceIdr?: number;
}

export interface CreateProductionPlanInput {
  name: string;
  source: ProductionPlanSource;
  notes?: string;
  items?: ProductionPlanItem[];
}

export interface UpdateProductionPlanInput {
  planId: string;
  name?: string;
  source?: ProductionPlanSource;
  notes?: string;
  items?: ProductionPlanItem[];
}

export interface UpdateProductPricingInput {
  productId: string;
  categoryId: string;
  sku: string;
  wholesaleActive: boolean;
  consignmentActive: boolean;
  wholesalePriceEur: number;
  consignmentPriceIdr: number;
}
