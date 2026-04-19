"use client";

import Link from "next/link";
import { ArrowLeft, Check, PackagePlus, Plus, ShieldCheck, Trash2 } from "lucide-react";
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
import { getBatchStatusLabel, getBatchTotals, getCategoryName } from "@/lib/stock-helpers";
import type { BatchPlannedItem, Product } from "@/lib/types";
import { cn, formatDate, formatDateTime, titleCase } from "@/lib/utils";

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

export function BatchDetailPage({ batchId }: { batchId: string }) {
  const {
    batches,
    products,
    categories,
    currentUserRole,
    updateIncoming,
    submitIncoming,
    startReceivingIncoming,
    completeIncoming,
  } = useMasterStock();
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [isCompleteDialogOpen, setIsCompleteDialogOpen] = useState(false);
  const [isCustomItemOpen, setIsCustomItemOpen] = useState(false);
  const [customItemName, setCustomItemName] = useState("");
  const [customItemQuantity, setCustomItemQuantity] = useState("0");
  const [customItemNote, setCustomItemNote] = useState("");
  const quantityInputRefs = useRef<Map<string, HTMLInputElement | null>>(new Map());
  const pendingFocusItemId = useRef<string | null>(null);
  const addItemButtonRef = useRef<HTMLButtonElement | null>(null);

  const incoming = batches.find((entry) => entry.id === batchId);
  const safeProducts = products ?? [];
  const safeCategories = categories ?? [];
  const incomingItems = incoming?.items ?? [];
  const selectedProductIds = useMemo(
    () =>
      new Set(
        incomingItems.flatMap((item) => (typeof item.productId === "string" ? [item.productId] : [])),
      ),
    [incomingItems],
  );

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

  if (currentUserRole === "production") {
    return (
      <MasterStockShell currentPath="production-batch">
        <section className="space-y-4">
          <Card className="border-white/10">
            <CardContent className="px-5 py-12">
              <h1 className="text-xl font-semibold text-foreground">Production Batch is internal-only</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Internal users receive craftsman reports, verify them, and update stock from this page.
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

  function addProduct(productId: string) {
    const existingItem = incomingItems.find(
      (item) => !item.isCustom && (item.productId === productId || item.mappedProductId === productId),
    );
    if (existingItem) {
      pendingFocusItemId.current = existingItem.id;
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

  return (
    <MasterStockShell currentPath="production-batch">
      <section className="space-y-8 pb-24 md:pb-0">
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
              {(activeIncoming.status === "draft" || activeIncoming.status === "submitted") ? (
                <Button
                  onClick={() =>
                    activeIncoming.status === "draft"
                      ? submitIncoming(activeIncoming.id)
                      : startReceivingIncoming(activeIncoming.id)
                  }
                  className="min-h-11 w-full sm:w-auto"
                >
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  {activeIncoming.status === "draft" ? "Submit Batch" : "Receive"}
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
            </div>
          </div>
        </div>

        {!isReceiving && !isCompleted ? (
          <Card className="border-white/10">
            <CardContent className="space-y-5 p-4 md:p-5">
              <div className="space-y-2">
                <h2 className="text-lg font-semibold text-foreground">Submission summary</h2>
                <p className="text-sm text-muted-foreground">
                  Review the saved craftsman report first, then click Receive to begin checklist verification.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
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

              <div className="grid gap-3 sm:grid-cols-3">
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

              {renderVerificationRows()}
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
        {(activeIncoming.status === "draft" || activeIncoming.status === "submitted") ? (
          <Button
            onClick={() =>
              activeIncoming.status === "draft"
                ? submitIncoming(activeIncoming.id)
                : startReceivingIncoming(activeIncoming.id)
            }
            className="min-h-12 w-full"
          >
            {activeIncoming.status === "draft" ? "Submit Batch" : "Receive"}
          </Button>
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
