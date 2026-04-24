"use client";

import Link from "next/link";
import { ArrowLeft, Check, ChevronRight, PackagePlus, Plus, Search, ShieldCheck, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { ActivityHistory } from "@/components/master-stock/activity-history";
import { BatchItemPicker } from "@/components/master-stock/batch-item-picker";
import { MasterStockShell } from "@/components/master-stock/shell";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useMasterStock } from "@/lib/master-stock-context";
import { exportProductionBatchPdf } from "@/lib/pdf-export";
import { getBatchStatusLabel, getBatchTotals, getCategoryName } from "@/lib/stock-helpers";
import type { BatchPlannedItem, Product } from "@/lib/types";
import { cn, formatDate, formatDateTime, titleCase } from "@/lib/utils";

const longPressDurationMs = 650;

function getProductionBatchName(name: string | undefined, source: string) {
  return name?.trim() || `${titleCase(source || "")} Production Batch`;
}

function getStatusClassName(status: "draft" | "submitted" | "receiving" | "completed") {
  if (status === "completed") {
    return "bg-white text-black";
  }

  if (status === "receiving") {
    return "border border-success/30 text-success";
  }

  if (status === "submitted") {
    return "border border-warning/30 text-warning";
  }

  return "border border-white/10 text-muted-foreground";
}

function getRoleStatusLabel(
  status: "draft" | "submitted" | "receiving" | "completed",
  role: string,
) {
  if (role === "production" && status === "receiving") {
    return "In Review";
  }

  return getBatchStatusLabel(status);
}

function getIncomingItemName(item: BatchPlannedItem, products: Product[]) {
  if (item.isCustom) {
    return item.customName?.trim() || "Custom item";
  }

  if (!item.productId) {
    return "Unnamed item";
  }

  return products.find((product) => product.id === item.productId)?.name ?? item.productId;
}

function getIncomingItemMeta(item: BatchPlannedItem, products: Product[]) {
  if (item.isCustom) {
    return item.note?.trim() ? `Temporary custom item • ${item.note.trim()}` : "Temporary custom item";
  }

  if (!item.productId) {
    return "Temporary item";
  }

  const product = products.find((entry) => entry.id === item.productId);
  if (!product) {
    return "Missing from master stock";
  }

  return `${product.sku} • ${getCategoryName(product.categoryId, [])}`;
}

function getIncomingItemCategoryName(
  item: BatchPlannedItem,
  products: Product[],
  categories: { id: string; name: string; order: number }[],
) {
  if (item.isCustom) {
    return "CUSTOM ITEMS";
  }

  if (!item.productId) {
    return "UNCATEGORIZED";
  }

  const product = products.find((entry) => entry.id === item.productId);
  if (!product) {
    return "UNCATEGORIZED";
  }

  return getCategoryName(product.categoryId, categories) || "UNCATEGORIZED";
}

export function BatchDetailPage({ batchId }: { batchId: string }) {
  const {
    batches,
    products,
    categories,
    currentUserRole,
    updateIncoming,
    submitIncoming,
    cancelIncomingSubmission,
    startReceivingIncoming,
    completeIncoming,
  } = useMasterStock();
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [isCompleteDialogOpen, setIsCompleteDialogOpen] = useState(false);
  const [isCustomItemOpen, setIsCustomItemOpen] = useState(false);
  const [customItemName, setCustomItemName] = useState("");
  const [customItemQuantity, setCustomItemQuantity] = useState("0");
  const [customItemNote, setCustomItemNote] = useState("");
  const [mobileSearch, setMobileSearch] = useState("");
  const [isMobileQuickAddOpen, setIsMobileQuickAddOpen] = useState(false);
  const [quickAddSearch, setQuickAddSearch] = useState("");
  const [isFullPreviewOpen, setIsFullPreviewOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const quantityInputRefs = useRef<Map<string, HTMLInputElement | null>>(new Map());
  const pendingFocusItemId = useRef<string | null>(null);
  const addItemButtonRef = useRef<HTMLButtonElement | null>(null);
  const mobileSearchInputRef = useRef<HTMLInputElement | null>(null);
  const quickAddSearchInputRef = useRef<HTMLInputElement | null>(null);
  const removeTimeoutRef = useRef<number | null>(null);

  const incoming = batches.find((entry) => entry.id === batchId);
  const safeProducts = products ?? [];
  const safeCategories = categories ?? [];
  const incomingItems = incoming?.items ?? [];
  const previewGroups = useMemo(() => {
    const categoryOrder = new Map(safeCategories.map((category) => [category.name, category.order]));
    const groups = incomingItems.reduce<
      Array<{
        category: string;
        order: number;
        items: BatchPlannedItem[];
      }>
    >((accumulator, item) => {
      const category = getIncomingItemCategoryName(item, safeProducts, safeCategories);
      const existingGroup = accumulator.find((entry) => entry.category === category);

      if (existingGroup) {
        existingGroup.items.push(item);
        return accumulator;
      }

      accumulator.push({
        category,
        order: categoryOrder.get(category) ?? Number.MAX_SAFE_INTEGER,
        items: [item],
      });

      return accumulator;
    }, []);

    return groups.sort((left, right) => {
      if (left.order !== right.order) {
        return left.order - right.order;
      }

      return left.category.localeCompare(right.category);
    });
  }, [incomingItems, safeCategories, safeProducts]);
  const selectedProductIds = useMemo(
    () =>
      new Set(
        incomingItems.flatMap((item) => (typeof item.productId === "string" ? [item.productId] : [])),
      ),
    [incomingItems],
  );
  const filteredMobileProducts = useMemo(() => {
    const query = mobileSearch.trim().toLowerCase();

    return safeProducts.filter((product) => {
      if (product.archived) {
        return false;
      }

      if (!query) {
        return false;
      }

      return `${product.name} ${product.sku}`.toLowerCase().includes(query);
    });
  }, [mobileSearch, safeProducts]);
  const filteredQuickAddProducts = useMemo(() => {
    const query = quickAddSearch.trim().toLowerCase();

    if (!query) {
      return safeProducts.filter((product) => !product.archived).slice(0, 8);
    }

    return safeProducts
      .filter((product) => {
        if (product.archived) {
          return false;
        }

        return `${product.name} ${product.sku}`.toLowerCase().includes(query);
      })
      .slice(0, 10);
  }, [quickAddSearch, safeProducts]);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      return;
    }

    const mediaQuery = window.matchMedia("(min-width: 768px)");
    const syncLayout = () => setIsDesktop(mediaQuery.matches);

    syncLayout();
    mediaQuery.addEventListener("change", syncLayout);

    return () => mediaQuery.removeEventListener("change", syncLayout);
  }, []);

  useEffect(() => {
    if (!pendingFocusItemId.current) {
      return;
    }

    const quantityInput = quantityInputRefs.current.get(pendingFocusItemId.current);
    if (!quantityInput) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      if (typeof quantityInput.scrollIntoView === "function") {
        quantityInput.scrollIntoView({ block: "center", behavior: "smooth" });
      }
      quantityInput.focus({ preventScroll: true });
      quantityInput.select();
      pendingFocusItemId.current = null;
    });

    return () => window.cancelAnimationFrame(frame);
  }, [incomingItems]);

  useEffect(() => {
    if (incoming?.status !== "draft" || incomingItems.length > 0) {
      return;
    }

    const activeElement = document.activeElement;
    if (
      activeElement instanceof HTMLElement &&
      (activeElement.tagName === "INPUT" ||
        activeElement.tagName === "TEXTAREA" ||
        activeElement.tagName === "SELECT" ||
        activeElement.isContentEditable)
    ) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      mobileSearchInputRef.current?.focus();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [incoming?.status, incomingItems.length]);

  useEffect(() => {
    if (!isMobileQuickAddOpen) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      quickAddSearchInputRef.current?.focus();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isMobileQuickAddOpen]);

  useEffect(() => {
    return () => {
      if (removeTimeoutRef.current) {
        window.clearTimeout(removeTimeoutRef.current);
      }
    };
  }, []);

  if (!incoming) {
    return (
      <MasterStockShell currentPath="production-batch">
        <section className="space-y-4">
          <Link
            href="/master-stock/incoming"
            className={buttonVariants({ variant: "outline", className: "min-h-11 w-fit" })}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
          <Card className="border-white/10">
            <CardContent className="px-5 py-12">
              <h1 className="text-xl font-semibold text-foreground">Production batch not found</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                This production batch no longer exists or has not been created yet.
              </p>
            </CardContent>
          </Card>
        </section>
      </MasterStockShell>
    );
  }

  const activeIncoming = incoming;
  const totals = getBatchTotals(activeIncoming);
  const sourceLabel = titleCase(activeIncoming.source || "") || "-";
  const isReceiving = activeIncoming.status === "receiving";
  const isCompleted = activeIncoming.status === "completed";
  const canEditItems = isReceiving && !isCompleted;
  const checkedItems = incomingItems.filter((item) => item.checked);
  const checkedCount = checkedItems.length;
  const checkedTotal = checkedItems.reduce((sum, item) => sum + item.quantity, 0);
  const currentStageLabel = activeIncoming.completedAt
    ? `Completed ${formatDateTime(activeIncoming.completedAt)}`
    : activeIncoming.receivingAt
      ? `Receiving started ${formatDateTime(activeIncoming.receivingAt)}`
      : activeIncoming.submittedAt
        ? `Submitted ${formatDateTime(activeIncoming.submittedAt)}`
        : `Created ${formatDate(activeIncoming.createdAt)}`;

  function replaceItems(nextItems: BatchPlannedItem[]) {
    updateIncoming({
      incomingId: activeIncoming.id,
      items: nextItems,
    });
  }

  function focusIncomingInput(itemId: string) {
    const input = quantityInputRefs.current.get(itemId);
    if (!input) {
      return;
    }

    window.requestAnimationFrame(() => {
      if (typeof input.scrollIntoView === "function") {
        input.scrollIntoView({ block: "center", behavior: "smooth" });
      }
      input.focus({ preventScroll: true });
      input.select();
    });
  }

  function addProduct(productId: string) {
    const existingItem = incomingItems.find(
      (item) => !item.isCustom && (item.productId === productId || item.mappedProductId === productId),
    );
    if (existingItem) {
      pendingFocusItemId.current = existingItem.id;
      focusIncomingInput(existingItem.id);
      setMobileSearch("");
      return;
    }

    const nextItem: BatchPlannedItem = {
      id: `incoming-item-${productId}-${incomingItems.length + 1}`,
      productId,
      checked: false,
      quantity: 0,
    };
    replaceItems([...incomingItems, nextItem]);
    pendingFocusItemId.current = nextItem.id;
    setMobileSearch("");
  }

  function addProductFromQuickSheet(productId: string) {
    addProduct(productId);
    setQuickAddSearch("");
  }

  function addCustomItem() {
    const trimmedName = customItemName.trim();
    if (!trimmedName) {
      return;
    }

    const nextItem: BatchPlannedItem = {
      id: `incoming-custom-${incomingItems.length + 1}`,
      isCustom: true,
      customName: trimmedName,
      note: customItemNote.trim() || undefined,
      checked: false,
      quantity: Math.max(0, Number(customItemQuantity) || 0),
    };

    replaceItems([...incomingItems, nextItem]);
    pendingFocusItemId.current = nextItem.id;
    setCustomItemName("");
    setCustomItemQuantity("0");
    setCustomItemNote("");
    setIsCustomItemOpen(false);
  }

  function updateItem(itemId: string, patch: Partial<BatchPlannedItem>) {
    replaceItems(
      incomingItems.map((item) =>
        item.id === itemId
          ? {
              ...item,
              ...patch,
              quantity: patch.quantity === undefined ? item.quantity : Math.max(0, patch.quantity),
            }
          : item,
      ),
    );
  }

  function removeItem(itemId: string) {
    replaceItems(incomingItems.filter((item) => item.id !== itemId));
  }

  function focusNextIncomingInput(currentItemId: string) {
    const currentIndex = incomingItems.findIndex((item) => item.id === currentItemId);
    if (currentIndex < 0) {
      return;
    }

    const nextItem = incomingItems[currentIndex + 1];
    if (!nextItem?.id) {
      quantityInputRefs.current.get(currentItemId)?.blur();
      return;
    }

    focusIncomingInput(nextItem.id);
  }

  function scheduleMobileRemove(itemId: string) {
    if (removeTimeoutRef.current) {
      window.clearTimeout(removeTimeoutRef.current);
    }

    removeTimeoutRef.current = window.setTimeout(() => {
      removeItem(itemId);
      removeTimeoutRef.current = null;
    }, longPressDurationMs);
  }

  function clearScheduledRemove() {
    if (!removeTimeoutRef.current) {
      return;
    }

    window.clearTimeout(removeTimeoutRef.current);
    removeTimeoutRef.current = null;
  }

  function renderVerificationRows() {
    if (incomingItems.length === 0) {
      return (
        <div className="rounded-2xl border border-dashed border-white/10 px-4 py-10 text-center text-sm text-muted-foreground">
          No items added yet. Add missing or custom items to continue receiving.
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {incomingItems.map((item) => {
          const product = item.productId
            ? safeProducts.find((entry) => entry.id === item.productId)
            : undefined;
          const itemName = getIncomingItemName(item, safeProducts);
          const itemMeta = item.isCustom
            ? item.note?.trim()
              ? `Temporary custom item • ${item.note.trim()}`
              : "Temporary custom item"
            : product
              ? `${product.sku} • ${getCategoryName(product.categoryId, safeCategories)}`
              : "Missing from master stock";

          return (
            <div
              key={item.id}
              className={cn(
                "flex flex-col gap-3 rounded-2xl border border-white/10 px-4 py-4 md:flex-row md:items-center md:justify-between",
                item.isCustom ? "bg-white/[0.02]" : "",
              )}
            >
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <Checkbox
                  checked={Boolean(item.checked)}
                  onChange={(event) => updateItem(item.id, { checked: event.target.checked })}
                  disabled={!canEditItems}
                  aria-label={`Check ${itemName}`}
                  className="mt-1 h-4 w-4 shrink-0"
                />
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-foreground">{itemName}</p>
                    {item.isCustom ? (
                      <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                        Custom
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground">{itemMeta}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 md:justify-end">
                <Input
                  ref={(node) => {
                    quantityInputRefs.current.set(item.id, node);
                  }}
                  type="number"
                  min="0"
                  inputMode="numeric"
                  value={String(item.quantity)}
                  onChange={(event) =>
                    updateItem(item.id, { quantity: Number(event.target.value) || 0 })
                  }
                  className="h-12 w-full text-base md:w-[148px]"
                  disabled={!canEditItems}
                  aria-label={`Quantity for ${itemName}`}
                />
                <Button
                  variant="outline"
                  onClick={() => removeItem(item.id)}
                  className="min-h-12 px-3"
                  aria-label={`Remove ${itemName}`}
                  disabled={!canEditItems}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  function renderCompletedRows() {
    if (checkedItems.length === 0) {
      return (
        <div className="rounded-2xl border border-dashed border-white/10 px-4 py-10 text-center text-sm text-muted-foreground">
          No checked items were applied to stock.
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {checkedItems.map((item) => {
          const product = item.productId
            ? safeProducts.find((entry) => entry.id === item.productId)
            : undefined;
          const itemName = getIncomingItemName(item, safeProducts);
          const itemMeta = item.isCustom
            ? item.note?.trim()
              ? `Temporary custom item • ${item.note.trim()}`
              : "Temporary custom item"
            : product
              ? `${product.sku} • ${getCategoryName(product.categoryId, safeCategories)}`
              : "Missing from master stock";

          return (
            <div
              key={item.id}
              className={cn(
                "rounded-2xl border border-white/10 px-4 py-4",
                item.isCustom ? "bg-white/[0.02]" : "",
              )}
            >
              <div className="flex items-start justify-between gap-4 md:hidden">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-foreground">{itemName}</p>
                    {item.isCustom ? (
                      <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                        Custom
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground">{itemMeta}</p>
                </div>

                <div className="shrink-0 text-right">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    Qty
                  </p>
                  <p className="mt-1 text-lg font-semibold text-foreground">{item.quantity} pcs</p>
                </div>
              </div>

              <div className="hidden items-center justify-between gap-4 md:flex">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-foreground">{itemName}</p>
                    {item.isCustom ? (
                      <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                        Custom
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground">{itemMeta}</p>
                </div>

                <div className="shrink-0 rounded-2xl border border-white/10 px-4 py-3 text-right md:min-w-[132px]">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    Final Qty
                  </p>
                  <p className="mt-2 text-lg font-semibold text-foreground">{item.quantity} pcs</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  if (currentUserRole === "production") {
    const isEditableDraft = activeIncoming.status === "draft";
    const itemCount = incomingItems.length;
    const totalQuantity = incomingItems.reduce((sum, item) => sum + item.quantity, 0);

    return (
      <MasterStockShell currentPath="production-batch">
        <section className="space-y-6 pb-28 md:pb-0">
          <div className="space-y-3">
            <Link
              href="/master-stock/incoming"
              className={buttonVariants({ variant: "outline", className: "min-h-11 w-fit" })}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Link>

            <div className="space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                    {getProductionBatchName(activeIncoming.name, activeIncoming.source)}
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    {getRoleStatusLabel(activeIncoming.status, currentUserRole)} • {itemCount} item
                    {itemCount === 1 ? "" : "s"} • {totalQuantity} pcs
                  </p>
                </div>
                <span
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[11px] uppercase tracking-[0.18em]",
                    getStatusClassName(activeIncoming.status),
                  )}
                >
                  {getRoleStatusLabel(activeIncoming.status, currentUserRole)}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">{currentStageLabel}</p>
            </div>
          </div>

          <Card className="border-white/10">
            <CardContent className="space-y-4 p-4 md:p-5">
              <label className="space-y-2 text-sm">
                <span className="text-foreground">Batch Name</span>
                <Input
                  value={activeIncoming.name ?? ""}
                  onChange={(event) =>
                    updateIncoming({
                      incomingId: activeIncoming.id,
                      name: event.target.value,
                    })
                  }
                  placeholder="Optional batch name"
                  className="h-11"
                  disabled={!isEditableDraft}
                />
              </label>
            </CardContent>
          </Card>

          {isEditableDraft && isDesktop ? (
            <Button
              onClick={() => submitIncoming(activeIncoming.id)}
              className="min-h-12 w-full sm:w-auto"
              disabled={incomingItems.length === 0}
            >
              Submit Batch
            </Button>
          ) : null}

          {isEditableDraft ? (
            <>
              {!isDesktop ? (
              <div className="space-y-4">
                <Card className="border-white/10">
                  <CardContent className="space-y-4 p-4">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        ref={mobileSearchInputRef}
                        value={mobileSearch}
                        onChange={(event) => setMobileSearch(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key !== "Enter") {
                            return;
                          }

                          const firstMatch = filteredMobileProducts[0];
                          if (!firstMatch) {
                            return;
                          }

                          event.preventDefault();
                          addProduct(firstMatch.id);
                        }}
                        placeholder="Search or add item..."
                        className="h-14 pl-11 text-base"
                      />
                    </div>

                    {mobileSearch.trim() ? (
                      <div className="space-y-2">
                        {filteredMobileProducts.length === 0 ? (
                          <div className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-center text-sm text-muted-foreground">
                            No items match this search.
                          </div>
                        ) : (
                          filteredMobileProducts.slice(0, 8).map((product) => {
                            const categoryName = getCategoryName(product.categoryId, safeCategories);
                            const isAdded = selectedProductIds.has(product.id);

                            return (
                              <button
                                key={product.id}
                                type="button"
                                onClick={() => addProduct(product.id)}
                                className="flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl border border-white/10 px-4 py-3 text-left transition-colors hover:bg-white/[0.03]"
                              >
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-medium text-foreground">
                                    {product.name}
                                  </p>
                                  <p className="truncate text-xs text-muted-foreground">
                                    {product.sku} • {categoryName}
                                  </p>
                                </div>
                                <span className="text-sm text-muted-foreground">
                                  {isAdded ? "Focus" : "Add"}
                                </span>
                              </button>
                            );
                          })
                        )}
                      </div>
                    ) : null}
                  </CardContent>
                </Card>

                {incomingItems.length === 0 ? (
                  <Card className="border-white/10">
                    <CardContent className="px-4 py-10 text-center text-sm text-muted-foreground">
                      Search above to add the first item to this batch.
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {incomingItems.map((item) => {
                      const itemName = getIncomingItemName(item, safeProducts);
                      const itemMeta = getIncomingItemMeta(item, safeProducts);

                      return (
                        <Card
                          key={item.id}
                          className={cn("border-white/10", item.isCustom ? "bg-white/[0.02]" : "")}
                          onTouchStart={() => scheduleMobileRemove(item.id)}
                          onTouchEnd={clearScheduledRemove}
                          onTouchCancel={clearScheduledRemove}
                        >
                          <CardContent className="space-y-3 p-4">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <p className="text-base font-medium text-foreground">{itemName}</p>
                                {item.isCustom ? (
                                  <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                                    Custom
                                  </span>
                                ) : null}
                              </div>
                              <p className="text-sm text-muted-foreground">{itemMeta}</p>
                            </div>
                            <Input
                              ref={(node) => {
                                quantityInputRefs.current.set(item.id, node);
                                if (pendingFocusItemId.current === item.id && node) {
                                  window.requestAnimationFrame(() => {
                                    if (typeof node.scrollIntoView === "function") {
                                      node.scrollIntoView({ block: "center", behavior: "smooth" });
                                    }
                                    node.focus();
                                    node.select();
                                    pendingFocusItemId.current = null;
                                  });
                                }
                              }}
                              type="number"
                              min="0"
                              inputMode="numeric"
                              enterKeyHint="next"
                              value={String(item.quantity)}
                              onChange={(event) =>
                                updateItem(item.id, { quantity: Number(event.target.value) || 0 })
                              }
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault();
                                  focusNextIncomingInput(item.id);
                                }
                              }}
                              className="h-14 text-lg"
                              aria-label={`Quantity for ${itemName}`}
                            />
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
              ) : null}

              {isDesktop ? (
              <div>
                <Card className="border-white/10">
                  <CardContent className="space-y-5 p-4 md:p-5">
                    <div className="relative">
                      <Button
                        ref={addItemButtonRef}
                        type="button"
                        variant="outline"
                        onClick={() => setIsAddItemOpen((current) => !current)}
                        className="min-h-12 w-full sm:w-auto"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Add Item
                      </Button>

                      <BatchItemPicker
                        open={isAddItemOpen}
                        onOpenChange={setIsAddItemOpen}
                        products={safeProducts}
                        categories={safeCategories}
                        selectedProductIds={selectedProductIds}
                        onAdd={addProduct}
                        title="Add item to this production batch"
                        triggerRef={addItemButtonRef}
                      />
                    </div>

                    {incomingItems.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-white/10 px-4 py-10 text-center text-sm text-muted-foreground">
                        Add items to start filling this production batch.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {incomingItems.map((item) => {
                          const itemName = getIncomingItemName(item, safeProducts);
                          const itemMeta = getIncomingItemMeta(item, safeProducts);

                          return (
                            <div
                              key={item.id}
                              className={cn(
                                "flex items-center justify-between gap-4 rounded-2xl border border-white/10 px-4 py-4",
                                item.isCustom ? "bg-white/[0.02]" : "",
                              )}
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-medium text-foreground">{itemName}</p>
                                  {item.isCustom ? (
                                    <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                                      Custom
                                    </span>
                                  ) : null}
                                </div>
                                <p className="text-xs text-muted-foreground">{itemMeta}</p>
                              </div>

                              <div className="flex items-center gap-2">
                                <Input
                                  ref={(node) => {
                                    quantityInputRefs.current.set(item.id, node);
                                    if (pendingFocusItemId.current === item.id && node) {
                                      window.requestAnimationFrame(() => {
                                        node.focus();
                                        node.select();
                                        pendingFocusItemId.current = null;
                                      });
                                    }
                                  }}
                                  type="number"
                                  min="0"
                                  inputMode="numeric"
                                  value={String(item.quantity)}
                                  onChange={(event) =>
                                    updateItem(item.id, {
                                      quantity: Number(event.target.value) || 0,
                                    })
                                  }
                                  className="h-12 w-[148px] text-base"
                                  aria-label={`Quantity for ${itemName}`}
                                />
                                <Button
                                  variant="outline"
                                  onClick={() => removeItem(item.id)}
                                  className="min-h-12 px-3"
                                  aria-label={`Remove ${itemName}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
              ) : null}
            </>
          ) : (
            <Card className="border-white/10">
              <CardContent className="space-y-4 p-4 md:p-5">
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold text-foreground">
                    {activeIncoming.status === "submitted"
                      ? "Submitted summary"
                      : activeIncoming.status === "receiving"
                        ? "In review"
                        : "Completed summary"}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {activeIncoming.status === "submitted"
                      ? "This batch is locked and waiting for internal receiving."
                      : activeIncoming.status === "receiving"
                        ? "The internal team is reviewing this submission. No actions are available."
                        : "This batch is completed and read-only."}
                  </p>
                </div>
                <div className="space-y-3">
                  {incomingItems.map((item) => (
                    <div
                      key={item.id}
                      className={cn(
                        "rounded-2xl border border-white/10 px-4 py-4",
                        item.isCustom ? "bg-white/[0.02]" : "",
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground">
                          {getIncomingItemName(item, safeProducts)}
                        </p>
                        {item.isCustom ? (
                          <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                            Custom
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {getIncomingItemMeta(item, safeProducts)}
                      </p>
                      <p className="mt-3 text-sm text-foreground">{item.quantity} pcs</p>
                    </div>
                  ))}
                </div>

                {activeIncoming.status === "submitted" ? (
                  <Button
                    variant="outline"
                    onClick={() => cancelIncomingSubmission(activeIncoming.id)}
                    className="min-h-12 w-full sm:w-auto"
                  >
                    Cancel Submission
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          )}
        </section>

        {isEditableDraft ? (
          <>
            <Button
              type="button"
              aria-label="Add item"
              onClick={() => setIsMobileQuickAddOpen(true)}
              className="pointer-events-auto fixed bottom-[96px] right-5 z-[9999] h-16 w-16 rounded-full border border-white/20 bg-white p-0 text-black shadow-[0_18px_55px_rgba(0,0,0,0.65)] hover:bg-white active:scale-95 md:hidden"
            >
              <Plus className="h-7 w-7" />
            </Button>

            {isMobileQuickAddOpen ? (
              <div className="pointer-events-auto fixed inset-x-4 bottom-[92px] z-[10000] rounded-[24px] border border-white/10 bg-[#09090b] p-4 shadow-[0_24px_90px_rgba(0,0,0,0.58)] md:hidden">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">Add item</h2>
                    <p className="text-xs text-muted-foreground">
                      Search, tap, then fill quantity in the list.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsMobileQuickAddOpen(false);
                      setQuickAddSearch("");
                    }}
                    className="min-h-10 px-3"
                  >
                    Done
                  </Button>
                </div>

                <div className="relative">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    ref={quickAddSearchInputRef}
                    value={quickAddSearch}
                    onChange={(event) => setQuickAddSearch(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter") {
                        return;
                      }

                      const firstMatch = filteredQuickAddProducts[0];
                      if (!firstMatch) {
                        return;
                      }

                      event.preventDefault();
                      addProductFromQuickSheet(firstMatch.id);
                    }}
                    placeholder="Search product or SKU..."
                    className="h-14 pl-11 text-base"
                  />
                </div>

                <div className="mt-3 max-h-[42vh] space-y-2 overflow-y-auto pr-1">
                  {filteredQuickAddProducts.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-center text-sm text-muted-foreground">
                      No items match this search.
                    </div>
                  ) : (
                    filteredQuickAddProducts.map((product) => {
                      const categoryName = getCategoryName(product.categoryId, safeCategories);
                      const isAdded = selectedProductIds.has(product.id);

                      return (
                        <button
                          key={product.id}
                          type="button"
                          onClick={() => addProductFromQuickSheet(product.id)}
                          className="flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl border border-white/10 px-4 py-3 text-left transition-colors active:bg-white/[0.04]"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">
                              {product.name}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {product.sku} • {categoryName}
                            </p>
                          </div>
                          <span className="shrink-0 text-sm text-muted-foreground">
                            {isAdded ? "Focus" : "Add"}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            ) : null}
          </>
        ) : null}

        {isEditableDraft ? (
          <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-background/95 px-4 py-3 backdrop-blur md:hidden">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Total</p>
                <p className="text-lg font-semibold text-foreground">{totalQuantity} pcs</p>
              </div>
              <Button
                onClick={() => submitIncoming(activeIncoming.id)}
                className="min-h-12 flex-1"
                disabled={incomingItems.length === 0}
              >
                Submit Batch
              </Button>
            </div>
          </div>
        ) : null}

        {activeIncoming.status === "submitted" ? (
          <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-background/95 px-4 py-3 backdrop-blur md:hidden">
            <Button
              variant="outline"
              onClick={() => cancelIncomingSubmission(activeIncoming.id)}
              className="min-h-12 w-full"
            >
              Cancel Submission
            </Button>
          </div>
        ) : null}
      </MasterStockShell>
    );
  }

  return (
    <MasterStockShell currentPath="production-batch">
      <section className="space-y-5 pb-24 md:space-y-8 md:pb-0">
        <div className="space-y-3">
          <Link
            href="/master-stock/incoming"
            className={buttonVariants({ variant: "outline", className: "min-h-11 w-fit" })}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>

          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
                {getProductionBatchName(activeIncoming.name, activeIncoming.source)}
              </h1>
              <p className="text-sm text-muted-foreground">{currentStageLabel}</p>
            </div>

            <div className="hidden w-full flex-col gap-2 sm:w-auto sm:flex-row md:flex">
              {activeIncoming.status === "submitted" ? (
                <Button
                  variant="outline"
                  onClick={() =>
                    exportProductionBatchPdf({
                      batch: activeIncoming,
                      products: safeProducts,
                      categories: safeCategories,
                      reportType: "temporary",
                    })
                  }
                  className="min-h-11 w-full sm:w-auto"
                >
                  Export Temporary PDF
                </Button>
              ) : null}

              {activeIncoming.status === "submitted" ? (
                <Button
                  onClick={() => startReceivingIncoming(activeIncoming.id)}
                  className="min-h-11 w-full sm:w-auto"
                >
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  Receive
                </Button>
              ) : null}

              {activeIncoming.status === "receiving" ? (
                <Button
                  onClick={() => setIsCompleteDialogOpen(true)}
                  className="min-h-11 w-full sm:w-auto"
                  disabled={checkedCount === 0}
                >
                  <Check className="mr-2 h-4 w-4" />
                  Update & Complete
                </Button>
              ) : null}

              {activeIncoming.status === "completed" ? (
                <Button
                  variant="outline"
                  onClick={() =>
                    exportProductionBatchPdf({
                      batch: activeIncoming,
                      products: safeProducts,
                      categories: safeCategories,
                      reportType: "final",
                    })
                  }
                  className="min-h-11 w-full sm:w-auto"
                >
                  Export Final PDF
                </Button>
              ) : null}
            </div>
          </div>
        </div>

        {!isReceiving && !isCompleted ? (
          <Card className="border-white/10">
            <CardContent className="space-y-4 p-4 md:space-y-5 md:p-5">
              <div className="space-y-1.5 md:space-y-2">
                <h2 className="text-lg font-semibold text-foreground">Submission summary</h2>
                <p className="text-sm leading-5 text-muted-foreground">
                  Review the saved craftsman report first, then click Receive to begin checklist verification.
                </p>
              </div>

              <div className="space-y-3 md:hidden">
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-2xl border border-white/10 px-3 py-3">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Source</p>
                    <p className="mt-1.5 truncate text-sm font-semibold text-foreground">{sourceLabel}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 px-3 py-3">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Items</p>
                    <p className="mt-1.5 text-sm font-semibold text-foreground">{incomingItems.length}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 px-3 py-3">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Qty</p>
                    <p className="mt-1.5 text-sm font-semibold text-foreground">{totals.total} pcs</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 px-3 py-2.5">
                  <div className="flex items-center justify-between gap-3 py-1.5">
                    <span className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Created</span>
                    <span className="text-sm text-foreground">{formatDate(activeIncoming.createdAt)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 border-t border-white/10 py-1.5">
                    <span className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Submitted</span>
                    <span className="text-right text-sm text-foreground">
                      {activeIncoming.submittedAt ? formatDateTime(activeIncoming.submittedAt) : "-"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 border-t border-white/10 py-1.5">
                    <span className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Status</span>
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.18em]",
                        getStatusClassName(activeIncoming.status),
                      )}
                    >
                      {getBatchStatusLabel(activeIncoming.status)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="hidden gap-3 md:grid md:grid-cols-2 xl:grid-cols-3">
                <div className="rounded-2xl border border-white/10 px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Source</p>
                  <p className="mt-2 text-lg font-semibold text-foreground">{sourceLabel}</p>
                </div>
                <div className="rounded-2xl border border-white/10 px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Total Items</p>
                  <p className="mt-2 text-lg font-semibold text-foreground">{incomingItems.length}</p>
                </div>
                <div className="rounded-2xl border border-white/10 px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Total Quantity</p>
                  <p className="mt-2 text-lg font-semibold text-foreground">{totals.total} pcs</p>
                </div>
                <div className="rounded-2xl border border-white/10 px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Created</p>
                  <p className="mt-2 text-sm text-foreground">{formatDate(activeIncoming.createdAt)}</p>
                </div>
                <div className="rounded-2xl border border-white/10 px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Submitted</p>
                  <p className="mt-2 text-sm text-foreground">
                    {activeIncoming.submittedAt ? formatDateTime(activeIncoming.submittedAt) : "-"}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Status</p>
                  <span
                    className={cn(
                      "mt-2 inline-flex rounded-full px-2.5 py-1 text-[11px] uppercase tracking-[0.18em]",
                      getStatusClassName(activeIncoming.status),
                    )}
                  >
                    {getBatchStatusLabel(activeIncoming.status)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {!isReceiving && !isCompleted ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsFullPreviewOpen(true)}
            className="min-h-12 w-full justify-between rounded-2xl px-4 text-left transition-all hover:border-white/20 hover:bg-white/[0.03] active:scale-[0.99]"
          >
            <span className="min-w-0">
              <span className="block text-sm font-medium">
                Preview {incomingItems.length} Item{incomingItems.length === 1 ? "" : "s"}
              </span>
              <span className="block text-xs font-normal text-muted-foreground">
                Tap to review submitted quantities
              </span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </Button>
        ) : null}

        {isReceiving ? (
          <Card className="border-white/10">
            <CardContent className="space-y-5 p-4 md:p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="space-y-2">
                  <h2 className="text-lg font-semibold text-foreground">Receiving checklist</h2>
                  <p className="text-sm text-muted-foreground">
                    Check items, adjust quantities, add missing lines, then update stock in bulk.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {checkedCount}/{incomingItems.length} items checked • {checkedTotal} pcs ready
                  </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <div className="relative">
                    <Button
                      ref={addItemButtonRef}
                      type="button"
                      variant="outline"
                      onClick={() => setIsAddItemOpen((current) => !current)}
                      className="min-h-12 w-full sm:w-auto"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Item
                    </Button>

                    <BatchItemPicker
                      open={isAddItemOpen}
                      onOpenChange={setIsAddItemOpen}
                      products={safeProducts}
                      categories={safeCategories}
                      selectedProductIds={selectedProductIds}
                      onAdd={addProduct}
                      title="Add item to this production batch"
                      triggerRef={addItemButtonRef}
                    />
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCustomItemOpen((current) => !current)}
                    className="min-h-12 w-full sm:w-auto"
                  >
                    <PackagePlus className="mr-2 h-4 w-4" />
                    Add Custom Item
                  </Button>
                </div>
              </div>

              {isCustomItemOpen ? (
                <div className="grid gap-3 rounded-2xl border border-white/10 px-4 py-4 md:grid-cols-2">
                  <label className="space-y-2 text-sm">
                    <span className="text-foreground">Custom item name</span>
                    <Input
                      value={customItemName}
                      onChange={(event) => setCustomItemName(event.target.value)}
                      placeholder="e.g. Sample bracelet repair"
                      className="h-11"
                    />
                  </label>

                  <label className="space-y-2 text-sm">
                    <span className="text-foreground">Quantity</span>
                    <Input
                      value={customItemQuantity}
                      onChange={(event) => setCustomItemQuantity(event.target.value)}
                      type="number"
                      min="0"
                      inputMode="numeric"
                      className="h-11"
                    />
                  </label>

                  <label className="space-y-2 text-sm md:col-span-2">
                    <span className="text-foreground">Short note</span>
                    <Textarea
                      value={customItemNote}
                      onChange={(event) => setCustomItemNote(event.target.value)}
                      placeholder="Optional short note for the internal team"
                      className="min-h-[96px]"
                    />
                  </label>

                  <div className="flex flex-col-reverse gap-2 md:col-span-2 sm:flex-row sm:justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setIsCustomItemOpen(false);
                        setCustomItemName("");
                        setCustomItemQuantity("0");
                        setCustomItemNote("");
                      }}
                      className="min-h-11 w-full sm:w-auto"
                    >
                      Cancel
                    </Button>
                    <Button type="button" onClick={addCustomItem} className="min-h-11 w-full sm:w-auto">
                      Add Custom Item
                    </Button>
                  </div>
                </div>
              ) : null}

              {renderVerificationRows()}
            </CardContent>
          </Card>
        ) : null}

        {isCompleted ? (
          <Card className="border-white/10">
            <CardContent className="space-y-5 p-4 md:p-5">
              <div className="space-y-2">
                <h2 className="text-lg font-semibold text-foreground">Completed summary</h2>
                <p className="text-sm text-muted-foreground">
                  Stock was updated from the checked receiving checklist. This record is now locked.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 md:hidden">
                <div className="rounded-2xl border border-white/10 px-3 py-3">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Source</p>
                  <p className="mt-1.5 truncate text-sm font-semibold text-foreground">{sourceLabel}</p>
                </div>
                <div className="rounded-2xl border border-white/10 px-3 py-3">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Items</p>
                  <p className="mt-1.5 text-sm font-semibold text-foreground">{checkedCount}</p>
                </div>
                <div className="rounded-2xl border border-white/10 px-3 py-3">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Qty</p>
                  <p className="mt-1.5 text-sm font-semibold text-foreground">{checkedTotal} pcs</p>
                </div>
              </div>

              <div className="hidden gap-3 md:grid md:grid-cols-3">
                <div className="rounded-2xl border border-white/10 px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Source</p>
                  <p className="mt-2 text-lg font-semibold text-foreground">{sourceLabel}</p>
                </div>
                <div className="rounded-2xl border border-white/10 px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Checked Items</p>
                  <p className="mt-2 text-lg font-semibold text-foreground">{checkedCount}</p>
                </div>
                <div className="rounded-2xl border border-white/10 px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Applied Quantity</p>
                  <p className="mt-2 text-lg font-semibold text-foreground">{checkedTotal} pcs</p>
                </div>
              </div>

              {renderCompletedRows()}
            </CardContent>
          </Card>
        ) : null}

        {isReceiving || isCompleted ? (
          <ActivityHistory
            entries={activeIncoming.history}
            description="Lightweight record of the report, receiving step, edits, and stock update."
          />
        ) : null}
      </section>

      <Dialog
        open={isFullPreviewOpen}
        onOpenChange={setIsFullPreviewOpen}
        title="Submitted Items"
        description={`${incomingItems.length} item${incomingItems.length === 1 ? "" : "s"} • ${totals.total} pcs`}
        className="h-auto max-h-[78vh] rounded-t-[28px] border-t border-white/10 bg-[#09090b] md:max-h-[82vh] md:max-w-xl md:rounded-[24px] md:border"
        headerClassName="border-b border-white/10 px-4 py-4 md:px-6"
        bodyClassName="max-h-[58vh] space-y-1 overflow-y-auto px-4 py-3 md:max-h-[60vh] md:px-6"
      >
        {incomingItems.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">No submitted items yet.</p>
        ) : (
          <div className="space-y-5">
            {previewGroups.map((group) => (
              <section key={group.category} className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  {group.category}
                </h3>
                <div className="space-y-0">
                  {group.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-4 border-b border-white/10 py-3 last:border-b-0"
                    >
                      <p className="min-w-0 truncate text-sm text-foreground">
                        {getIncomingItemName(item, safeProducts)}
                      </p>
                      <p className="shrink-0 text-sm font-medium text-foreground">{item.quantity} pcs</p>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </Dialog>

      <Dialog
        open={isCompleteDialogOpen}
        onOpenChange={setIsCompleteDialogOpen}
        title="Update stock and complete?"
        description="This will update stock in bulk from the checked receiving list."
        className="border-white/10 bg-[#09090b] md:max-w-lg"
        headerClassName="border-b-0 px-4 pb-2 pt-5 md:px-6 md:pt-6"
        bodyClassName="space-y-3 px-4 pb-5 pt-0 md:px-6 md:pb-6"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              onClick={() => setIsCompleteDialogOpen(false)}
              className="min-h-11 w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                completeIncoming(activeIncoming.id);
                setIsCompleteDialogOpen(false);
              }}
              className="min-h-11 w-full sm:w-auto"
              disabled={checkedCount === 0}
            >
              Update & Complete
            </Button>
          </div>
        }
      >
        <div className="rounded-2xl border border-white/10 px-4 py-4 text-sm text-muted-foreground">
          {checkedTotal} pcs from {checkedCount} checked item{checkedCount === 1 ? "" : "s"} will be
          posted into {sourceLabel} stock.
        </div>
      </Dialog>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-background/95 px-4 py-3 backdrop-blur md:hidden">
        {activeIncoming.status === "submitted" ? (
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() =>
                exportProductionBatchPdf({
                  batch: activeIncoming,
                  products: safeProducts,
                  categories: safeCategories,
                  reportType: "temporary",
                })
              }
              className="min-h-12 flex-1"
            >
              Export Temporary PDF
            </Button>
            <Button
              onClick={() => startReceivingIncoming(activeIncoming.id)}
              className="min-h-12 flex-1"
            >
              Receive
            </Button>
          </div>
        ) : null}

        {activeIncoming.status === "receiving" ? (
          <Button
            onClick={() => setIsCompleteDialogOpen(true)}
            className="min-h-12 w-full"
            disabled={checkedCount === 0}
          >
            Update & Complete
          </Button>
        ) : null}
      </div>
    </MasterStockShell>
  );
}
