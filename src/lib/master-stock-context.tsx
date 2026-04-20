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
  defaultProductionPlans,
  defaultProducts,
  defaultRole,
} from "@/lib/mock-data";
import type {
  AddProductInput,
  AdjustmentLog,
  ActivityEntry,
  BatchPlannedItem,
  Category,
  CreateProductionPlanInput,
  CreateBatchInput,
  Preferences,
  Product,
  ProductionPlan,
  ProductionBatch,
  ProductionPlanItem,
  StockLocationKey,
  StockMovement,
  ToastMessage,
  UpdateProductionPlanInput,
  UpdateProductPricingInput,
  UserRole,
} from "@/lib/types";
import { getBatchReceivedByProduct } from "@/lib/stock-helpers";
import { titleCase } from "@/lib/utils";

type AdjustmentMode = "set" | "delta";

interface MasterStockContextValue {
  products: Product[];
  categories: Category[];
  productionPlans: ProductionPlan[];
  batches: ProductionBatch[];
  movements: StockMovement[];
  adjustments: AdjustmentLog[];
  preferences: Preferences;
  lastSyncedAt: string;
  currentUserRole: UserRole;
  toasts: ToastMessage[];
  setCurrentUserRole: (role: UserRole) => void;
  setRowsPerPage: (rowsPerPage: number) => void;
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
  createProductionPlan: (input: CreateProductionPlanInput) => ProductionPlan;
  updateProductionPlan: (input: UpdateProductionPlanInput) => void;
  completeProductionPlan: (planId: string) => void;
  deleteProductionPlan: (planId: string) => void;
  updateProductPricing: (input: UpdateProductPricingInput) => void;
  archiveProduct: (productId: string) => void;
  updateThreshold: (productId: string, threshold: number) => void;
  adjustStock: (input: {
    productId: string;
    locationKey: StockLocationKey;
    mode: AdjustmentMode;
    value: number;
    reason: string;
  }) => void;
  createIncoming: (input: CreateBatchInput) => ProductionBatch;
  updateIncoming: (input: {
    incomingId: string;
    name?: string;
    source?: StockLocationKey;
    notes?: string;
    items?: BatchPlannedItem[];
  }) => void;
  submitIncoming: (incomingId: string) => void;
  startReceivingIncoming: (incomingId: string) => void;
  completeIncoming: (incomingId: string) => void;
  deleteIncoming: (incomingId: string) => void;
  dismissToast: (id: string) => void;
}

const STORAGE_KEY = "master-stock-state-v2";

const MasterStockContext = createContext<MasterStockContextValue | null>(null);

function makeId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function getSourceLabel(source?: string) {
  return titleCase(source || "") || "-";
}

function getIncomingItemLabel(
  item: Pick<BatchPlannedItem, "productId" | "customName" | "isCustom">,
  products: Product[],
) {
  if (item.isCustom) {
    return item.customName?.trim() || "Custom item";
  }

  if (!item.productId) {
    return "Unnamed item";
  }

  return products.find((product) => product.id === item.productId)?.name ?? item.productId;
}

function createActivityEntry(
  entry: Omit<ActivityEntry, "id"> & { id?: string },
): ActivityEntry {
  return {
    id: entry.id ?? makeId("activity"),
    kind: entry.kind,
    title: entry.title,
    detail: entry.detail,
    actor: entry.actor,
    createdAt: entry.createdAt,
  };
}

function parseLegacyActivityAction(
  action: string | undefined,
  fallbackActor: string,
  sourceLabel?: string,
): Pick<ActivityEntry, "kind" | "title" | "detail" | "actor"> {
  const normalizedAction = action?.trim();
  if (!normalizedAction) {
    return {
      kind: "created",
      title: "Created",
      actor: fallbackActor,
    };
  }

  const createdMatch = normalizedAction.match(/^Created by (.+)$/i);
  if (createdMatch) {
    return {
      kind: "created",
      title: "Created",
      actor: createdMatch[1]?.trim() || fallbackActor,
    };
  }

  const addedMatch = normalizedAction.match(/^Added (.+?)(?:: (\d+) pcs)?$/i);
  if (addedMatch) {
    const [, itemLabel, quantity] = addedMatch;
    const detailParts = [];
    if (quantity) {
      detailParts.push(`+${quantity} pcs`);
    }
    if (sourceLabel) {
      detailParts.push(`Source: ${sourceLabel}`);
    }
    return {
      kind: "added",
      title: `Added ${itemLabel?.trim() || "item"}`,
      detail: detailParts.length > 0 ? detailParts.join(" • ") : undefined,
      actor: fallbackActor,
    };
  }

  const removedMatch = normalizedAction.match(/^Removed (.+?)(?:: (\d+) pcs)?$/i);
  if (removedMatch) {
    const [, itemLabel, quantity] = removedMatch;
    const detailParts = [];
    if (quantity) {
      detailParts.push(`-${quantity} pcs`);
    }
    if (sourceLabel) {
      detailParts.push(`Source: ${sourceLabel}`);
    }
    return {
      kind: "removed",
      title: `Removed ${itemLabel?.trim() || "item"}`,
      detail: detailParts.length > 0 ? detailParts.join(" • ") : undefined,
      actor: fallbackActor,
    };
  }

  const editedMatch = normalizedAction.match(/^Edited quantity for (.+?): (\d+) → (\d+)$/i);
  if (editedMatch) {
    const [, itemLabel, previousQuantity, nextQuantity] = editedMatch;
    return {
      kind: "edited",
      title: `Edited quantity for ${itemLabel?.trim() || "item"}`,
      detail: `${previousQuantity} → ${nextQuantity} pcs`,
      actor: fallbackActor,
    };
  }

  const completedMatch = normalizedAction.match(/^Completed (plan|batch)$/i);
  if (completedMatch) {
    return {
      kind: "completed",
      title: `Completed ${completedMatch[1]}`,
      detail: sourceLabel ? `Updated stock for ${sourceLabel}` : undefined,
      actor: fallbackActor,
    };
  }

  return {
    kind: "edited",
    title: normalizedAction,
    actor: fallbackActor,
  };
}

function normalizeHistoryEntry(
  entry: Partial<ActivityEntry> | undefined,
  createdAt: string,
  fallbackActor: string,
  sourceLabel?: string,
): ActivityEntry {
  if (entry?.title && entry?.kind) {
    return {
      id: entry.id || makeId("activity"),
      kind: entry.kind,
      title: entry.title,
      detail: entry.detail,
      actor: entry.actor || fallbackActor,
      createdAt: typeof entry.createdAt === "string" ? entry.createdAt : createdAt,
    };
  }

  const parsed = parseLegacyActivityAction(entry?.action, fallbackActor, sourceLabel);
  return {
    id: entry?.id || makeId("activity"),
    kind: parsed.kind,
    title: parsed.title,
    detail: parsed.detail,
    actor: parsed.actor,
    createdAt: typeof entry?.createdAt === "string" ? entry.createdAt : createdAt,
  };
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

function normalizeProductionPlans(input: ProductionPlan[]): ProductionPlan[] {
  return input.map((plan, index): ProductionPlan => ({
    id: plan.id,
    name:
      typeof plan.name === "string" && plan.name.trim()
        ? plan.name.trim()
        : `Batch ${index + 1}`,
    source: plan.source,
    notes:
      typeof plan.notes === "string" && plan.notes.trim() ? plan.notes.trim() : undefined,
    items: Array.isArray(plan.items)
      ? plan.items.map((item) => ({
          productId: item.productId,
          plannedQty: Math.max(0, item.plannedQty ?? item.quantity),
          quantity: Math.max(0, item.quantity),
        }))
      : [],
    createdAt: typeof plan.createdAt === "string" ? plan.createdAt : defaultLastSyncedAt,
    status: plan.status === "completed" ? "completed" : "draft",
    completedAt:
      plan.status === "completed" && typeof plan.completedAt === "string"
        ? plan.completedAt
        : undefined,
    history: Array.isArray(plan.history)
      ? plan.history.map((entry) =>
          normalizeHistoryEntry(
            entry,
            typeof plan.createdAt === "string" ? plan.createdAt : defaultLastSyncedAt,
            "Unknown",
            getSourceLabel(plan.source),
          ),
        )
      : [
          createActivityEntry({
            kind: "created",
            title: "Created",
            actor: "Unknown",
            createdAt: typeof plan.createdAt === "string" ? plan.createdAt : defaultLastSyncedAt,
          }),
        ],
  }));
}

function normalizeBatches(input: ProductionBatch[]): ProductionBatch[] {
  return input.map((batch, index): ProductionBatch => ({
    id: batch.id,
    name:
      typeof batch.name === "string" && batch.name.trim()
        ? batch.name.trim()
        : `Production Batch ${index + 1}`,
    source: batch.source,
    status:
      batch.status === "completed"
        ? "completed"
        : batch.status === "receiving"
          ? "receiving"
          : batch.status === "submitted"
            ? "submitted"
            : "draft",
    notes:
      typeof batch.notes === "string" && batch.notes.trim() ? batch.notes.trim() : undefined,
    createdAt: typeof batch.createdAt === "string" ? batch.createdAt : defaultLastSyncedAt,
    updatedAt: typeof batch.updatedAt === "string" ? batch.updatedAt : defaultLastSyncedAt,
    createdBy: batch.createdBy,
    submittedAt:
      typeof batch.submittedAt === "string" ? batch.submittedAt : undefined,
    receivingAt:
      typeof (batch as ProductionBatch & { receivingAt?: string }).receivingAt === "string"
        ? (batch as ProductionBatch & { receivingAt?: string }).receivingAt
        : typeof (batch as ProductionBatch & { verifiedAt?: string }).verifiedAt === "string"
          ? (batch as ProductionBatch & { verifiedAt?: string }).verifiedAt
          : undefined,
    completedAt:
      batch.status === "completed" && typeof batch.completedAt === "string"
        ? batch.completedAt
        : undefined,
    items: Array.isArray(batch.items)
      ? batch.items.map((item) => ({
          id: item.id ?? makeId("incoming-item"),
          productId: item.productId,
          isCustom: Boolean(item.isCustom || (!item.productId && item.customName)),
          customName:
            typeof item.customName === "string" && item.customName.trim()
              ? item.customName.trim()
              : undefined,
          note:
            typeof item.note === "string" && item.note.trim() ? item.note.trim() : undefined,
          mappedProductId:
            typeof item.mappedProductId === "string" && item.mappedProductId.trim()
              ? item.mappedProductId
              : undefined,
          checked:
            typeof item.checked === "boolean"
              ? item.checked
              : batch.status === "completed",
          quantity: Math.max(0, item.quantity),
        }))
      : Array.isArray((batch as ProductionBatch & {
            plannedItems?: Array<{ id?: string; productId: string; plannedQty?: number }>;
          }).plannedItems)
        ? (((batch as ProductionBatch & {
              plannedItems?: Array<{ id?: string; productId: string; plannedQty?: number }>;
            }).plannedItems ?? [])).map((item) => ({
              id: item.id ?? makeId("incoming-item"),
              productId: item.productId,
              quantity: Math.max(0, item.plannedQty ?? 0),
            }))
        : [],
    history: Array.isArray(batch.history)
      ? batch.history.map((entry) =>
          normalizeHistoryEntry(
            entry,
            typeof batch.createdAt === "string" ? batch.createdAt : defaultLastSyncedAt,
            batch.createdBy || "Unknown",
            getSourceLabel(batch.source),
          ),
        )
      : [
          createActivityEntry({
            kind: "created",
            title: "Created",
            actor: batch.createdBy || "Unknown",
            createdAt: typeof batch.createdAt === "string" ? batch.createdAt : defaultLastSyncedAt,
          }),
        ],
  }));
}

export function MasterStockProvider({ children }: { children: ReactNode }) {
  const toastTimeouts = useRef<Map<string, number>>(new Map());
  const [products, setProducts] = useState<Product[]>(defaultProducts);
  const [categories, setCategories] = useState<Category[]>(defaultCategories);
  const [productionPlans, setProductionPlans] =
    useState<ProductionPlan[]>(normalizeProductionPlans(defaultProductionPlans));
  const [batches, setBatches] = useState<ProductionBatch[]>(normalizeBatches(defaultBatches));
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
        productionPlans: ProductionPlan[];
        batches: ProductionBatch[];
        movements: StockMovement[];
        adjustments: AdjustmentLog[];
        preferences: Preferences;
        lastSyncedAt: string;
        currentUserRole: UserRole;
      }>;

      if (parsed.products) setProducts(parsed.products);
      if (parsed.categories) setCategories(normalizeCategories(parsed.categories));
      if (parsed.productionPlans) setProductionPlans(normalizeProductionPlans(parsed.productionPlans));
      if (parsed.batches) setBatches(normalizeBatches(parsed.batches));
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
        productionPlans,
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
    productionPlans,
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

  const createProductionPlan = useCallback(
    (input: CreateProductionPlanInput) => {
      const normalizedItems = (input.items ?? []).map((item) => ({
        productId: item.productId,
        plannedQty: Math.max(0, item.plannedQty ?? item.quantity),
        quantity: Math.max(0, item.quantity),
      }));
      const createdAt = new Date().toISOString();
      const actorLabel = titleCase(currentUserRole);

      const nextPlan: ProductionPlan = {
        id: makeId("plan"),
        name: input.name.trim(),
        source: input.source,
        notes: input.notes?.trim() || undefined,
        items: normalizedItems,
        createdAt,
        status: "draft",
        history: [
          createActivityEntry({
            id: makeId("plan-history"),
            kind: "created",
            title: "Created batch",
            actor: actorLabel,
            createdAt,
          }),
          ...normalizedItems.map((item) => {
            const productName =
              products.find((product) => product.id === item.productId)?.name ?? item.productId;
            return createActivityEntry({
              id: makeId("plan-history"),
              kind: "added",
              title: `Added ${productName}`,
              detail: `+${item.quantity} pcs • Source: ${getSourceLabel(input.source)}`,
              actor: actorLabel,
              createdAt,
            });
          }),
        ],
      };

      setProductionPlans((current) => [nextPlan, ...current]);
      pushToast({
        title: "Batch created successfully",
        description: "The outgoing dispatch batch was saved and is ready for item prep.",
        variant: "success",
      });

      return nextPlan;
    },
    [currentUserRole, products, pushToast],
  );

  const updateProductionPlan = useCallback(
    ({ planId, name, source, notes, items }: UpdateProductionPlanInput) => {
      setProductionPlans((current) =>
        current.map((plan) => {
          if (plan.id !== planId) {
            return plan;
          }

          if (plan.status === "completed") {
            return plan;
          }

          const normalizedItems: ProductionPlanItem[] | undefined = items?.map((item) => ({
            productId: item.productId,
            plannedQty: Math.max(
              0,
              item.plannedQty ??
                plan.items.find((existingItem) => existingItem.productId === item.productId)?.plannedQty ??
                item.quantity,
            ),
            quantity: Math.max(0, item.quantity),
          }));
          const historyEntries = [...plan.history];
          const entryCreatedAt = new Date().toISOString();
          const actorLabel = titleCase(currentUserRole);
          const previousItemsByProductId = new Map(plan.items.map((item) => [item.productId, item]));
          const nextItems = normalizedItems ?? plan.items;
          const addedItems = nextItems.filter((item) => !previousItemsByProductId.has(item.productId));
          const removedItems = plan.items.filter(
            (item) => !nextItems.some((nextItem) => nextItem.productId === item.productId),
          );

          addedItems.forEach((item) => {
            const productName =
              products.find((product) => product.id === item.productId)?.name ?? item.productId;
            historyEntries.push(createActivityEntry({
              id: makeId("plan-history"),
              kind: "added",
              title: `Added ${productName}`,
              detail: `+${item.quantity} pcs • Source: ${getSourceLabel(source ?? plan.source)}`,
              actor: actorLabel,
              createdAt: entryCreatedAt,
            }));
          });

          removedItems.forEach((item) => {
            const productName =
              products.find((product) => product.id === item.productId)?.name ?? item.productId;
            historyEntries.push(createActivityEntry({
              id: makeId("plan-history"),
              kind: "removed",
              title: `Removed ${productName}`,
              detail: `-${item.quantity} pcs • Source: ${getSourceLabel(source ?? plan.source)}`,
              actor: actorLabel,
              createdAt: entryCreatedAt,
            }));
          });

          nextItems.forEach((item) => {
            const previousItem = previousItemsByProductId.get(item.productId);
            if (!previousItem || previousItem.quantity === item.quantity) {
              return;
            }

            const productName =
              products.find((product) => product.id === item.productId)?.name ?? item.productId;
            historyEntries.push(createActivityEntry({
              id: makeId("plan-history"),
              kind: "edited",
              title: `Edited quantity for ${productName}`,
              detail: `${previousItem.quantity} → ${item.quantity} pcs`,
              actor: actorLabel,
              createdAt: entryCreatedAt,
            }));
          });

          return {
            ...plan,
            name: typeof name === "string" ? name.trim() || plan.name : plan.name,
            source: source ?? plan.source,
            notes:
              typeof notes === "string"
                ? notes.trim() || undefined
                : notes === undefined
                  ? plan.notes
                  : undefined,
            items: nextItems,
            history: historyEntries,
          };
        }),
      );
    },
    [currentUserRole, products],
  );

  const completeProductionPlan = useCallback(
    (planId: string) => {
      const completedAt = new Date().toISOString();

      setProductionPlans((current) =>
        current.map((plan) =>
          plan.id === planId
            ? {
                ...plan,
                status: "completed",
                completedAt,
                history: [
                  ...plan.history,
                  createActivityEntry({
                    id: makeId("plan-history"),
                    kind: "completed",
                    title: "Completed batch",
                    detail: "Ready for export",
                    actor: titleCase(currentUserRole),
                    createdAt: completedAt,
                  }),
                ],
              }
            : plan,
        ),
      );

      pushToast({
        title: "Batch completed",
        description: "This dispatch batch is now locked and ready for PDF export.",
        variant: "success",
      });
    },
    [pushToast],
  );

  const deleteProductionPlan = useCallback(
    (planId: string) => {
      setProductionPlans((current) => current.filter((plan) => plan.id !== planId));
      pushToast({
        title: "Batch deleted",
        description: "The outgoing dispatch batch was removed.",
      });
    },
    [pushToast],
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

  const createIncoming = useCallback(
    (input: CreateBatchInput) => {
      const createdAt = new Date().toISOString();
      const actorLabel = titleCase(currentUserRole);
      const items: BatchPlannedItem[] = (input.items ?? []).map((item) => ({
        id: makeId("incoming-item"),
        productId: item.productId,
        isCustom: Boolean(item.isCustom || (!item.productId && item.customName)),
        customName: item.customName?.trim() || undefined,
        note: item.note?.trim() || undefined,
        mappedProductId: item.mappedProductId,
        checked: Boolean(item.checked),
        quantity: Math.max(0, item.quantity),
      }));
      const incoming: ProductionBatch = {
        id: makeId("incoming"),
        name: input.name?.trim() || `Production Batch ${batches.length + 1}`,
        source: input.source,
        status: "draft",
        notes: input.notes?.trim() || undefined,
        createdAt,
        updatedAt: createdAt,
        createdBy: actorLabel,
        items,
        history: [
          createActivityEntry({
            id: makeId("incoming-history"),
            kind: "created",
            title: "Created production batch",
            actor: actorLabel,
            createdAt,
          }),
          ...items.map((item) => {
            const productName = getIncomingItemLabel(item, products);
            return createActivityEntry({
              id: makeId("incoming-history"),
              kind: "added",
              title: `Added ${productName}`,
              detail: `+${item.quantity} pcs • Source: ${getSourceLabel(input.source)}`,
              actor: actorLabel,
              createdAt,
            });
          }),
        ],
      };

      setBatches((current) => [incoming, ...current]);
      pushToast({
        title: "Production batch created",
        description: `${incoming.name} is ready for craftsman input.`,
        variant: "success",
      });

      return incoming;
    },
    [batches.length, currentUserRole, products, pushToast],
  );

  const updateIncoming = useCallback(
    ({
      incomingId,
      name,
      source,
      notes,
      items,
    }: {
      incomingId: string;
      name?: string;
      source?: StockLocationKey;
      notes?: string;
      items?: BatchPlannedItem[];
    }) => {
      setBatches((current) =>
        current.map((incoming) => {
          if (incoming.id !== incomingId || incoming.status === "completed") {
            return incoming;
          }

          const normalizedItems =
            items?.map((item) => ({
              id: item.id ?? makeId("incoming-item"),
              productId: item.productId,
              isCustom: Boolean(item.isCustom || (!item.productId && item.customName)),
              customName: item.customName?.trim() || undefined,
              note: item.note?.trim() || undefined,
              mappedProductId: item.mappedProductId,
              checked: Boolean(item.checked),
              quantity: Math.max(0, item.quantity),
            })) ?? incoming.items;

          const historyEntries = [...incoming.history];
          const entryCreatedAt = new Date().toISOString();
          const actorLabel = titleCase(currentUserRole);
          const previousItemsById = new Map(incoming.items.map((item) => [item.id, item]));
          const addedItems = normalizedItems.filter((item) => !previousItemsById.has(item.id));
          const removedItems = incoming.items.filter(
            (item) => !normalizedItems.some((nextItem) => nextItem.id === item.id),
          );

          addedItems.forEach((item) => {
            const productName = getIncomingItemLabel(item, products);
            historyEntries.push(
              createActivityEntry({
                id: makeId("incoming-history"),
                kind: "added",
                title: `Added ${productName}`,
                detail: `+${item.quantity} pcs • Source: ${getSourceLabel(source ?? incoming.source)}`,
                actor: actorLabel,
                createdAt: entryCreatedAt,
              }),
            );
          });

          removedItems.forEach((item) => {
            const productName = getIncomingItemLabel(item, products);
            historyEntries.push(
              createActivityEntry({
                id: makeId("incoming-history"),
                kind: "removed",
                title: `Removed ${productName}`,
                detail: `-${item.quantity} pcs • Source: ${getSourceLabel(source ?? incoming.source)}`,
                actor: actorLabel,
                createdAt: entryCreatedAt,
              }),
            );
          });

          normalizedItems.forEach((item) => {
            const previousItem = previousItemsById.get(item.id);
            if (!previousItem || previousItem.quantity === item.quantity) {
              if (previousItem?.checked !== item.checked) {
                const productName = getIncomingItemLabel(item, products);
                historyEntries.push(
                  createActivityEntry({
                    id: makeId("incoming-history"),
                    kind: "edited",
                    title: `Updated checklist for ${productName}`,
                    detail: item.checked ? "Checked for receiving" : "Unchecked for receiving",
                    actor: actorLabel,
                    createdAt: entryCreatedAt,
                  }),
                );
              }
              return;
            }

            const productName = getIncomingItemLabel(item, products);
            historyEntries.push(
              createActivityEntry({
                id: makeId("incoming-history"),
                kind: "edited",
                title: `Edited quantity for ${productName}`,
                detail: `${previousItem.quantity} → ${item.quantity} pcs`,
                actor: actorLabel,
                createdAt: entryCreatedAt,
              }),
            );
          });

          return {
            ...incoming,
            name: typeof name === "string" ? name.trim() || incoming.name : incoming.name,
            source: source ?? incoming.source,
            notes:
              typeof notes === "string"
                ? notes.trim() || undefined
                : notes === undefined
                  ? incoming.notes
                  : undefined,
            items: normalizedItems,
            updatedAt: entryCreatedAt,
            history: historyEntries,
          };
        }),
      );
    },
    [currentUserRole, products],
  );

  const submitIncoming = useCallback(
    (incomingId: string) => {
      const submittedAt = new Date().toISOString();

      setBatches((current) =>
        current.map((incoming) =>
          incoming.id === incomingId && incoming.status === "draft"
            ? {
                ...incoming,
                status: "submitted",
                submittedAt,
                updatedAt: submittedAt,
                history: [
                  ...incoming.history,
                  createActivityEntry({
                    id: makeId("incoming-history"),
                    kind: "completed",
                    title: "Submitted production batch",
                    detail: "Ready for internal verification",
                    actor: titleCase(currentUserRole),
                    createdAt: submittedAt,
                  }),
                ],
              }
            : incoming,
        ),
      );

      pushToast({
        title: "Production batch submitted",
        description: "The internal team can now receive this craftsman report.",
        variant: "success",
      });
    },
    [currentUserRole, pushToast],
  );

  const startReceivingIncoming = useCallback(
    (incomingId: string) => {
      const receivingAt = new Date().toISOString();

      setBatches((current) =>
        current.map((incoming) =>
          incoming.id === incomingId && incoming.status !== "completed"
            ? {
                ...incoming,
                status: "receiving",
                receivingAt,
                updatedAt: receivingAt,
                history: [
                  ...incoming.history,
                  createActivityEntry({
                    id: makeId("incoming-history"),
                    kind: "completed",
                    title: "Started receiving production batch",
                    detail: "Checklist verification started",
                    actor: titleCase(currentUserRole),
                    createdAt: receivingAt,
                  }),
                ],
              }
            : incoming,
        ),
      );

      pushToast({
        title: "Receiving started",
        description: "Checklist verification is now active for this production batch.",
        variant: "success",
      });
    },
    [currentUserRole, pushToast],
  );

  const completeIncoming = useCallback(
    (incomingId: string) => {
      const incoming = batches.find((entry) => entry.id === incomingId);
      if (!incoming || incoming.status === "completed") return;

      const createdAt = new Date().toISOString();
      const stockDeltas = getBatchReceivedByProduct(incoming);

      setProducts((current) =>
        current.map((product) => {
          const delta = stockDeltas.get(product.id);
          if (!delta) return product;

          return {
            ...product,
            currentStock: {
              ...product.currentStock,
              [incoming.source]: product.currentStock[incoming.source] + delta,
            },
            updatedAt: createdAt,
          };
        }),
      );

      setMovements((current) => [
        ...Array.from(stockDeltas.entries())
          .filter(([, qty]) => qty > 0)
          .map(([productId, qty]) => ({
            id: makeId("mv"),
            productId,
            qtyDelta: qty,
            destinationStockKey: incoming.source,
            source: "production_batch_receive" as const,
            createdAt,
            actor: currentUserRole,
            batchId: incomingId,
            reason: `Completed through ${incoming.name}`,
          })),
        ...current,
      ]);

      setBatches((current) =>
        current.map((entry) =>
          entry.id === incomingId
            ? {
                ...entry,
                status: "completed",
                completedAt: createdAt,
                updatedAt: createdAt,
                history: [
                  ...entry.history,
                  createActivityEntry({
                    id: makeId("incoming-history"),
                    kind: "completed",
                    title: "Completed production batch",
                    detail: `Updated stock for ${getSourceLabel(entry.source)}`,
                    actor: titleCase(currentUserRole),
                    createdAt,
                  }),
                ],
              }
            : entry,
        ),
      );

      syncTimestamp();
      pushToast({
        title: "Production batch completed",
        description: `${getSourceLabel(incoming.source)} stock was updated from the checked receiving list.`,
        variant: "success",
      });
    },
    [batches, currentUserRole, pushToast, syncTimestamp],
  );

  const deleteIncoming = useCallback(
    (incomingId: string) => {
      setBatches((current) => current.filter((incoming) => incoming.id !== incomingId));
      pushToast({
        title: "Production batch deleted",
        description: "The production batch was removed.",
      });
    },
    [pushToast],
  );

  const value = useMemo<MasterStockContextValue>(
    () => ({
      products,
      categories,
      productionPlans,
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
      createCategory,
      renameCategory,
      reorderCategory,
      moveCategory,
      removeCategory,
      createProduct,
      createProductionPlan,
      updateProductionPlan,
      completeProductionPlan,
      deleteProductionPlan,
      updateProductPricing,
      archiveProduct,
      updateThreshold,
      adjustStock,
      createIncoming,
      updateIncoming,
      submitIncoming,
      startReceivingIncoming,
      completeIncoming,
      deleteIncoming,
      dismissToast,
    }),
    [
      adjustments,
      adjustStock,
      batches,
      categories,
      createProductionPlan,
      createIncoming,
      createCategory,
      createProduct,
      completeIncoming,
      completeProductionPlan,
      deleteIncoming,
      submitIncoming,
      updateIncoming,
      updateProductionPlan,
      currentUserRole,
      deleteProductionPlan,
      dismissToast,
      lastSyncedAt,
      moveCategory,
      movements,
      preferences,
      productionPlans,
      products,
      removeCategory,
      renameCategory,
      reorderCategory,
      toasts,
      updateProductPricing,
      archiveProduct,
      updateThreshold,
      startReceivingIncoming,
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
