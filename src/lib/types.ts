export type UserRole = "owner" | "admin" | "production_lead" | "production";
export type StockView = "current" | "projected";
export type StockStatus = "healthy" | "low" | "out";
export type StockLocationKey = "indira" | "mita" | "warehouse";
export type BatchStatus =
  | "draft"
  | "prepared"
  | "receiving"
  | "partially_received"
  | "received"
  | "cancelled";

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
  plannedQuantity: number;
  plannedNote?: string;
  wholesaleActive: boolean;
  consignmentActive: boolean;
  wholesalePriceEur: number;
  consignmentPriceIdr: number;
  archived?: boolean;
  updatedAt: string;
}

export interface BatchLine {
  id: string;
  productId: string;
  plannedQty: number;
  receivedQtyConfirmed: number;
  note?: string;
}

export interface ProductionBatch {
  id: string;
  code: string;
  status: BatchStatus;
  assignedSource: string;
  destinationStockKey: StockLocationKey;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  items: BatchLine[];
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
  stockView: StockView;
}

export interface ReceiveLineInput {
  lineId: string;
  quantity: number;
}

export interface CreateBatchInput {
  code?: string;
  assignedSource: string;
  destinationStockKey: StockLocationKey;
  notes?: string;
  items: Array<{
    productId: string;
    plannedQty: number;
    note?: string;
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

export interface UpdateProductPricingInput {
  productId: string;
  categoryId: string;
  sku: string;
  wholesaleActive: boolean;
  consignmentActive: boolean;
  wholesalePriceEur: number;
  consignmentPriceIdr: number;
}
