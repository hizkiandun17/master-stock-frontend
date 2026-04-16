"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  defaultBatches,
  defaultCategories,
  defaultLastSyncedAt,
  defaultMovements,
  defaultPreferences,
  defaultProducts,
  defaultRole,
} from "@/lib/mock-data";
import { getBatchTotals } from "@/lib/stock-helpers";
import type {
  AddProductInput,
  AdjustmentLog,
  BatchLine,
  Category,
  CreateBatchInput,
  Preferences,
  Product,
  ProductionBatch,
  ReceiveLineInput,
  StockLocationKey,
  StockMovement,
  ToastMessage,
  UpdateProductPricingInput,
  UserRole,
} from "@/lib/types";

type AdjustmentMode = "set" | "delta";

interface MasterStockContextValue {
  products: Product[];
  categories: Category[];
  batches: ProductionBatch[];
  movements: StockMovement[];
  adjustments: AdjustmentLog[];
  preferences: Preferences;
  lastSyncedAt: string;
  currentUserRole: UserRole;
  toasts: ToastMessage[];
  setCurrentUserRole: (role: UserRole) => void;
  setRowsPerPage: (rowsPerPage: number) => void;
  setStockView: (view: Preferences["stockView"]) => void;
  createCategory: (name: string) => { ok: boolean; category?: Category; error?: string };
  renameCategory: (categoryId: string, name: string) => { ok: boolean; error?: string };
  reorderCategory: (
    draggedId: string,
    targetId: string,
    position?: "before" | "after",
  ) => void;
  moveCategory: (categoryId: string, direction: "up" | "down") => void;
  removeCategory: (categoryId: string) => { ok: boolean; error?: string };
  createProduct: (input: AddProductInput) => void;
  updateProductPricing: (input: UpdateProductPricingInput) => void;
  archiveProduct: (productId: string) => void;
  updatePlanning: (productId: string, quantity: number, note?: string) => void;
  resetPlanning: (productId: string) => void;
  updateThreshold: (productId: string, threshold: number) => void;
  adjustStock: (input: {
    productId: string;
    locationKey: StockLocationKey;
    mode: AdjustmentMode;
    value: number;
    reason: string;
  }) => void;
  createBatch: (input: CreateBatchInput) => void;
  updateBatchDraft: (
    batchId: string,
    patch: Partial<Pick<ProductionBatch, "assignedSource" | "destinationStockKey" | "notes">> & {
      items?: BatchLine[];
    },
  ) => void;
  markBatchPrepared: (batchId: string) => void;
  cancelBatch: (batchId: string) => void;
  enterReceiving: (batchId: string) => void;
  finalizeBatch: (batchId: string) => void;
  receiveBatch: (batchId: string, lines: ReceiveLineInput[]) => void;
  dismissToast: (id: string) => void;
}

const STORAGE_KEY = "master-stock-state-v1";

const MasterStockContext = createContext<MasterStockContextValue | null>(null);

function makeId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeCategories(input: Category[]) {
  return [...input]
    .map((category, index) => ({
      id: category.id,
      name: category.name,
      order:
        typeof category.order === "number"
          ? category.order
          : (category as Category & { sortOrder?: number }).sortOrder ?? index,
      createdAt:
        typeof category.createdAt === "string"
          ? category.createdAt
          : defaultLastSyncedAt,
    }))
    .sort((a, b) => a.order - b.order)
    .map((category, index) => ({ ...category, order: index }));
}

export function MasterStockProvider({ children }: { children: ReactNode }) {
  const toastTimeouts = useRef<Map<string, number>>(new Map());
  const [products, setProducts] = useState<Product[]>(defaultProducts);
  const [categories, setCategories] = useState<Category[]>(defaultCategories);
  const [batches, setBatches] = useState(defaultBatches);
  const [movements, setMovements] = useState(defaultMovements);
  const [adjustments, setAdjustments] = useState<AdjustmentLog[]>([]);
  const [preferences, setPreferences] = useState(defaultPreferences);
  const [lastSyncedAt, setLastSyncedAt] = useState(defaultLastSyncedAt);
  const [currentUserRole, setCurrentUserRole] = useState<UserRole>(defaultRole);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return;

    try {
      const parsed = JSON.parse(stored) as Partial<{
        products: Product[];
        categories: Category[];
        batches: ProductionBatch[];
        movements: StockMovement[];
        adjustments: AdjustmentLog[];
        preferences: Preferences;
        lastSyncedAt: string;
        currentUserRole: UserRole;
      }>;

      if (parsed.products) setProducts(parsed.products);
      if (parsed.categories) setCategories(normalizeCategories(parsed.categories));
      if (parsed.batches) setBatches(parsed.batches);
      if (parsed.movements) setMovements(parsed.movements);
      if (parsed.adjustments) setAdjustments(parsed.adjustments);
      if (parsed.preferences) setPreferences(parsed.preferences);
      if (parsed.lastSyncedAt) setLastSyncedAt(parsed.lastSyncedAt);
      if (parsed.currentUserRole) setCurrentUserRole(parsed.currentUserRole);
    } catch {
      // Ignore malformed local state and fall back to defaults.
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        products,
        categories,
        batches,
        movements,
        adjustments,
        preferences,
        lastSyncedAt,
        currentUserRole,
      }),
    );
  }, [
    adjustments,
    batches,
    categories,
    currentUserRole,
    lastSyncedAt,
    movements,
    preferences,
    products,
  ]);

  const dismissToast = useCallback((id: string) => {
    const timeout = toastTimeouts.current.get(id);
    if (timeout) {
      window.clearTimeout(timeout);
      toastTimeouts.current.delete(id);
    }
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const pushToast = useCallback(
    (toast: Omit<ToastMessage, "id">) => {
      const id = makeId("toast");
      setToasts((current) => [...current, { ...toast, id }]);
      const timeout = window.setTimeout(() => dismissToast(id), 4200);
      toastTimeouts.current.set(id, timeout);
    },
    [dismissToast],
  );

  const syncTimestamp = useCallback(() => {
    setLastSyncedAt(new Date().toISOString());
  }, []);

  const createCategory = useCallback(
    (name: string) => {
      const normalized = name.trim().toUpperCase();
      const duplicate = categories.find(
        (category) => category.name.toUpperCase() === normalized,
      );

      if (!normalized) {
        return { ok: false, error: "Category name is required." };
      }

      if (duplicate) {
        return {
          ok: false,
          error: `${duplicate.name} already exists. Use the existing category instead.`,
        };
      }

      const category: Category = {
        id: makeId("cat"),
        name: normalized,
        order: categories.length,
        createdAt: new Date().toISOString(),
      };

      setCategories((current) => normalizeCategories([...current, category]));
      pushToast({
        title: "Category created",
        description: `${normalized} is now available in filters and forms.`,
        variant: "success",
      });
      return { ok: true, category };
    },
    [categories, pushToast],
  );

  const renameCategory = useCallback(
    (categoryId: string, name: string) => {
      const normalized = name.trim().toUpperCase();

      if (!normalized) {
        return { ok: false, error: "Category name is required." };
      }

      const duplicate = categories.find(
        (category) =>
          category.id !== categoryId &&
          category.name.toUpperCase() === normalized,
      );

      if (duplicate) {
        return {
          ok: false,
          error: `${duplicate.name} already exists. Use the existing category instead.`,
        };
      }

      setCategories((current) =>
        current.map((category) =>
          category.id === categoryId ? { ...category, name: normalized } : category,
        ),
      );
      pushToast({
        title: "Category renamed",
        description: `${normalized} was updated across the stock module.`,
        variant: "success",
      });
      return { ok: true };
    },
    [categories, pushToast],
  );

  const reorderCategory = useCallback((
    draggedId: string,
    targetId: string,
    position: "before" | "after" = "before",
  ) => {
    setCategories((current) => {
      const ordered = [...current].sort((a, b) => a.order - b.order);
      const fromIndex = ordered.findIndex((category) => category.id === draggedId);
      const toIndex = ordered.findIndex((category) => category.id === targetId);

      if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
        return current;
      }

      const [moved] = ordered.splice(fromIndex, 1);
      const targetIndex =
        position === "after"
          ? fromIndex < toIndex
            ? toIndex
            : toIndex + 1
          : fromIndex < toIndex
            ? toIndex - 1
            : toIndex;
      ordered.splice(Math.max(0, Math.min(ordered.length, targetIndex)), 0, moved);
      return ordered.map((category, index) => ({ ...category, order: index }));
    });
  }, []);

  const moveCategory = useCallback(
    (categoryId: string, direction: "up" | "down") => {
      const ordered = [...categories].sort((a, b) => a.order - b.order);
      const index = ordered.findIndex((category) => category.id === categoryId);
      const targetIndex = direction === "up" ? index - 1 : index + 1;

      if (index < 0 || targetIndex < 0 || targetIndex >= ordered.length) {
        return;
      }

      reorderCategory(
        categoryId,
        ordered[targetIndex].id,
        direction === "up" ? "before" : "after",
      );
    },
    [categories, reorderCategory],
  );

  const removeCategory = useCallback(
    (categoryId: string) => {
      const inUse = products.some((product) => product.categoryId === categoryId && !product.archived);

      if (inUse) {
        return {
          ok: false,
          error: "This category is still used by active products. Reassign them before deleting it.",
        };
      }

      setCategories((current) =>
        normalizeCategories(current.filter((category) => category.id !== categoryId)),
      );

      pushToast({
        title: "Category removed",
        description: "The category was deleted from Master Stock.",
      });

      return { ok: true };
    },
    [products, pushToast],
  );

  const createProduct = useCallback(
    (input: AddProductInput) => {
      setProducts((current) => [
        {
          id: makeId("prd"),
          name: input.name,
          sku: input.sku.toUpperCase(),
          categoryId: input.categoryId,
          imageHint: input.imageHint,
          currentStock: input.currentStock,
          lowStockThreshold: input.lowStockThreshold,
          velocity30d: 0,
          plannedQuantity: 0,
          wholesaleActive: input.wholesaleActive ?? true,
          consignmentActive: input.consignmentActive ?? true,
          wholesalePriceEur: input.wholesalePriceEur ?? 0,
          consignmentPriceIdr: input.consignmentPriceIdr ?? 0,
          updatedAt: new Date().toISOString(),
        },
        ...current,
      ]);
      syncTimestamp();
      pushToast({
        title: "Product added",
        description: `${input.name} is now available in the active stock list.`,
        variant: "success",
      });
    },
    [pushToast, syncTimestamp],
  );

  const updateProductPricing = useCallback(
    ({
      productId,
      categoryId,
      sku,
      wholesaleActive,
      consignmentActive,
      wholesalePriceEur,
      consignmentPriceIdr,
    }: UpdateProductPricingInput) => {
      setProducts((current) =>
        current.map((product) =>
          product.id === productId
            ? {
                ...product,
                categoryId,
                sku: sku.toUpperCase(),
                wholesaleActive,
                consignmentActive,
                wholesalePriceEur,
                consignmentPriceIdr,
                updatedAt: new Date().toISOString(),
              }
            : product,
        ),
      );
      syncTimestamp();
      pushToast({
        title: "Stock prices updated",
        description: "Category, SKU, and pricing settings were saved.",
        variant: "success",
      });
    },
    [pushToast, syncTimestamp],
  );

  const archiveProduct = useCallback(
    (productId: string) => {
      setProducts((current) =>
        current.map((product) =>
          product.id === productId
            ? { ...product, archived: true, updatedAt: new Date().toISOString() }
            : product,
        ),
      );
      syncTimestamp();
      pushToast({
        title: "Stock archived",
        description: "The stock item was moved out of the active list.",
      });
    },
    [pushToast, syncTimestamp],
  );

  const updatePlanning = useCallback(
    (productId: string, quantity: number, note?: string) => {
      setProducts((current) =>
        current.map((product) =>
          product.id === productId
            ? {
                ...product,
                plannedQuantity: Math.max(0, quantity),
                plannedNote: note,
                updatedAt: new Date().toISOString(),
              }
            : product,
        ),
      );
      syncTimestamp();
      pushToast({
        title: "Planning layer updated",
        description: "Projected stock changed, but physical stock remains untouched.",
        variant: "success",
      });
    },
    [pushToast, syncTimestamp],
  );

  const resetPlanning = useCallback(
    (productId: string) => {
      setProducts((current) =>
        current.map((product) =>
          product.id === productId
            ? {
                ...product,
                plannedQuantity: 0,
                plannedNote: undefined,
                updatedAt: new Date().toISOString(),
              }
            : product,
        ),
      );
      syncTimestamp();
      pushToast({
        title: "Planning layer reset",
        description: "Projected stock now matches physical stock again.",
      });
    },
    [pushToast, syncTimestamp],
  );

  const updateThreshold = useCallback(
    (productId: string, threshold: number) => {
      setProducts((current) =>
        current.map((product) =>
          product.id === productId
            ? { ...product, lowStockThreshold: threshold, updatedAt: new Date().toISOString() }
            : product,
        ),
      );
      syncTimestamp();
      pushToast({
        title: "Threshold updated",
        description: `Low-stock alert for this SKU now triggers at ${threshold} pcs.`,
        variant: "success",
      });
    },
    [pushToast, syncTimestamp],
  );

  const adjustStock = useCallback(
    ({
      productId,
      locationKey,
      mode,
      value,
      reason,
    }: {
      productId: string;
      locationKey: StockLocationKey;
      mode: AdjustmentMode;
      value: number;
      reason: string;
    }) => {
      let oldValue = 0;
      let newValue = 0;

      setProducts((current) =>
        current.map((product) => {
          if (product.id !== productId) {
            return product;
          }

          oldValue = product.currentStock[locationKey];
          newValue = mode === "set" ? Math.max(0, value) : Math.max(0, oldValue + value);

          return {
            ...product,
            currentStock: {
              ...product.currentStock,
              [locationKey]: newValue,
            },
            updatedAt: new Date().toISOString(),
          };
        }),
      );

      const createdAt = new Date().toISOString();
      setAdjustments((current) => [
        {
          id: makeId("adj"),
          productId,
          locationKey,
          oldValue,
          newValue,
          reason,
          createdAt,
          actor: currentUserRole,
        },
        ...current,
      ]);

      setMovements((current) => [
        {
          id: makeId("mv"),
          productId,
          qtyDelta: newValue - oldValue,
          destinationStockKey: locationKey,
          source: "manual_adjustment",
          createdAt,
          actor: currentUserRole,
          reason,
        },
        ...current,
      ]);

      syncTimestamp();
      pushToast({
        title: "Stock adjusted",
        description: `${locationKey} changed from ${oldValue} to ${newValue}.`,
        variant: "success",
      });
    },
    [currentUserRole, pushToast, syncTimestamp],
  );

  const createBatch = useCallback(
    (input: CreateBatchInput) => {
      const datePart = new Date().toISOString().slice(2, 10).replaceAll("-", "");
      const batch: ProductionBatch = {
        id: makeId("batch"),
        code: input.code?.trim() || `BAT-${datePart}-${String(batches.length + 1).padStart(2, "0")}`,
        status: "draft",
        assignedSource: input.assignedSource,
        destinationStockKey: input.destinationStockKey,
        notes: input.notes,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: currentUserRole,
        items: input.items.map((item) => ({
          id: makeId("line"),
          productId: item.productId,
          plannedQty: item.plannedQty,
          receivedQtyConfirmed: 0,
          note: item.note,
        })),
      };

      setBatches((current) => [batch, ...current]);
      pushToast({
        title: "Batch created",
        description: `${batch.code} is ready for preparation.`,
        variant: "success",
      });
    },
    [batches.length, currentUserRole, pushToast],
  );

  const updateBatchDraft = useCallback(
    (
      batchId: string,
      patch: Partial<Pick<ProductionBatch, "assignedSource" | "destinationStockKey" | "notes">> & {
        items?: BatchLine[];
      },
    ) => {
      setBatches((current) =>
        current.map((batch) =>
          batch.id === batchId
            ? {
                ...batch,
                ...patch,
                updatedAt: new Date().toISOString(),
                items: patch.items ?? batch.items,
              }
            : batch,
        ),
      );
      pushToast({
        title: "Batch updated",
        description: "Preparation details were saved.",
      });
    },
    [pushToast],
  );

  const markBatchPrepared = useCallback(
    (batchId: string) => {
      setBatches((current) =>
        current.map((batch) =>
          batch.id === batchId
            ? { ...batch, status: "prepared", updatedAt: new Date().toISOString() }
            : batch,
        ),
      );
      pushToast({
        title: "Batch prepared",
        description: "The batch is ready to move into receiving when items arrive.",
      });
    },
    [pushToast],
  );

  const cancelBatch = useCallback(
    (batchId: string) => {
      setBatches((current) =>
        current.map((batch) =>
          batch.id === batchId
            ? { ...batch, status: "cancelled", updatedAt: new Date().toISOString() }
            : batch,
        ),
      );
      pushToast({
        title: "Batch cancelled",
        description: "The operational record is kept, but no more receiving can happen from it.",
        variant: "warning",
      });
    },
    [pushToast],
  );

  const enterReceiving = useCallback(
    (batchId: string) => {
      setBatches((current) =>
        current.map((batch) =>
          batch.id === batchId
            ? { ...batch, status: "receiving", updatedAt: new Date().toISOString() }
            : batch,
        ),
      );
      pushToast({
        title: "Receiving mode started",
        description: "You can now verify partials and post real stock updates from this batch.",
      });
    },
    [pushToast],
  );

  const finalizeBatch = useCallback(
    (batchId: string) => {
      setBatches((current) =>
        current.map((batch) =>
          batch.id === batchId
            ? { ...batch, status: "received", updatedAt: new Date().toISOString() }
            : batch,
        ),
      );
      pushToast({
        title: "Batch finalized",
        description: "The batch is now closed with its current actual receiving totals.",
      });
    },
    [pushToast],
  );

  const receiveBatch = useCallback(
    (batchId: string, lines: ReceiveLineInput[]) => {
      const batch = batches.find((entry) => entry.id === batchId);
      if (!batch) return;

      const selected = new Map(lines.map((line) => [line.lineId, line.quantity]));
      const createdAt = new Date().toISOString();
      const stockDeltas = new Map<string, number>();

      setBatches((current) =>
        current.map((entry) => {
          if (entry.id !== batchId) {
            return entry;
          }

          const nextItems = entry.items.map((item) => {
            const receiveQty = selected.get(item.id);
            if (!receiveQty || receiveQty <= 0) {
              return item;
            }

            stockDeltas.set(
              item.productId,
              (stockDeltas.get(item.productId) ?? 0) + receiveQty,
            );

            return {
              ...item,
              receivedQtyConfirmed: item.receivedQtyConfirmed + receiveQty,
            };
          });

          const nextBatch = {
            ...entry,
            items: nextItems,
            updatedAt: createdAt,
          };
          const totals = getBatchTotals(nextBatch);

          return {
            ...nextBatch,
            status:
              totals.received === 0
                ? "receiving"
                : totals.remaining === 0
                  ? "received"
                  : "partially_received",
          };
        }),
      );

      setProducts((current) =>
        current.map((product) => {
          const delta = stockDeltas.get(product.id);
          if (!delta) return product;

          return {
            ...product,
            currentStock: {
              ...product.currentStock,
              [batch.destinationStockKey]:
                product.currentStock[batch.destinationStockKey] + delta,
            },
            updatedAt: createdAt,
          };
        }),
      );

      setMovements((current) => [
        ...lines
          .filter((line) => line.quantity > 0)
          .map((line) => {
            const batchLine = batch.items.find((item) => item.id === line.lineId);
            return {
              id: makeId("mv"),
              productId: batchLine?.productId ?? "",
              qtyDelta: line.quantity,
              destinationStockKey: batch.destinationStockKey,
              source: "production_batch_receive" as const,
              createdAt,
              actor: currentUserRole,
              batchId,
              reason: `Received through ${batch.code}`,
            };
          }),
        ...current,
      ]);

      syncTimestamp();
      pushToast({
        title: "Stock received",
        description: `${lines.length} selected line(s) updated ${batch.destinationStockKey} stock directly.`,
        variant: "success",
      });
    },
    [batches, currentUserRole, pushToast, syncTimestamp],
  );

  const value = useMemo<MasterStockContextValue>(
    () => ({
      products,
      categories,
      batches,
      movements,
      adjustments,
      preferences,
      lastSyncedAt,
      currentUserRole,
      toasts,
      setCurrentUserRole,
      setRowsPerPage: (rowsPerPage) =>
        setPreferences((current) => ({ ...current, rowsPerPage })),
      setStockView: (stockView) =>
        setPreferences((current) => ({ ...current, stockView })),
      createCategory,
      renameCategory,
      reorderCategory,
      moveCategory,
      removeCategory,
      createProduct,
      updateProductPricing,
      archiveProduct,
      updatePlanning,
      resetPlanning,
      updateThreshold,
      adjustStock,
      createBatch,
      updateBatchDraft,
      markBatchPrepared,
      cancelBatch,
      enterReceiving,
      finalizeBatch,
      receiveBatch,
      dismissToast,
    }),
    [
      adjustments,
      adjustStock,
      batches,
      cancelBatch,
      categories,
      createBatch,
      createCategory,
      createProduct,
      currentUserRole,
      dismissToast,
      enterReceiving,
      finalizeBatch,
      lastSyncedAt,
      moveCategory,
      movements,
      preferences,
      products,
      receiveBatch,
      removeCategory,
      renameCategory,
      reorderCategory,
      toasts,
      updateProductPricing,
      archiveProduct,
      updateBatchDraft,
      updatePlanning,
      updateThreshold,
      resetPlanning,
    ],
  );

  return (
    <MasterStockContext.Provider value={value}>
      {children}
    </MasterStockContext.Provider>
  );
}

export function useMasterStock() {
  const context = useContext(MasterStockContext);

  if (!context) {
    throw new Error("useMasterStock must be used inside MasterStockProvider");
  }

  return context;
}
