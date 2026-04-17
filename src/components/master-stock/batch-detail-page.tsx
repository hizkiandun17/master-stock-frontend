"use client";

import Link from "next/link";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { ActivityHistory } from "@/components/master-stock/activity-history";
import { BatchItemPicker } from "@/components/master-stock/batch-item-picker";
import { MasterStockShell } from "@/components/master-stock/shell";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useMasterStock } from "@/lib/master-stock-context";
import {
  getBatchStatusLabel,
  getBatchTotals,
  getCategoryName,
  isBatchEditable,
} from "@/lib/stock-helpers";
import type { BatchLine } from "@/lib/types";
import { cn, formatDate, formatDateTime, titleCase } from "@/lib/utils";

function getBatchName(name: string | undefined, source: string) {
  return name?.trim() || `${titleCase(source || "")} Batch`;
}

function getStatusClassName(status: "draft" | "in_progress" | "completed") {
  if (status === "completed") {
    return "bg-white text-black";
  }

  if (status === "in_progress") {
    return "border border-warning/30 text-warning";
  }

  return "border border-white/10 text-muted-foreground";
}

export function BatchDetailPage({ batchId }: { batchId: string }) {
  const { batches, products, categories, updateBatch, completeBatch } = useMasterStock();
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isCompleteDialogOpen, setIsCompleteDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const pendingFocusProductId = useRef<string | null>(null);
  const plannedInputRefs = useRef<Map<string, HTMLInputElement | null>>(new Map());
  const addItemButtonRef = useRef<HTMLButtonElement | null>(null);

  function isMobilePickerViewport() {
    return (
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(max-width: 639px)").matches
    );
  }

  const batch = batches.find((entry) => entry.id === batchId);
  const editable = batch ? isBatchEditable(batch.status) : false;

  const selectedProductIds = useMemo(
    () => new Set(batch?.items.map((item) => item.productId) ?? []),
    [batch?.items],
  );

  useEffect(() => {
    if (!batch || !pendingFocusProductId.current) {
      return;
    }

    const quantityInput = plannedInputRefs.current.get(pendingFocusProductId.current);
    if (!quantityInput) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      if (typeof quantityInput.scrollIntoView === "function") {
        quantityInput.scrollIntoView({
          block: "center",
          behavior: "smooth",
        });
      }
      quantityInput.focus({ preventScroll: true });
      quantityInput.select();
      pendingFocusProductId.current = null;
    });

    return () => window.cancelAnimationFrame(frame);
  }, [batch, batch?.items, searchQuery]);

  if (!batch) {
    return (
      <MasterStockShell currentPath="batches">
        <section className="space-y-4">
          <Link
            href="/master-stock/batches"
            className={buttonVariants({ variant: "outline", className: "min-h-11 w-fit" })}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
          <Card className="border-white/10">
            <CardContent className="px-5 py-12">
              <h1 className="text-xl font-semibold text-foreground">Batch not found</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                This batch no longer exists or has not been created yet.
              </p>
            </CardContent>
          </Card>
        </section>
      </MasterStockShell>
    );
  }

  const activeBatch = batch;
  const totals = getBatchTotals(batch);
  const sourceLabel = titleCase(batch.source || "") || "-";
  const createdLabel = batch.createdAt ? `Created ${formatDate(batch.createdAt)}` : "Created -";
  const itemCount = Array.isArray(batch.items) ? batch.items.length : 0;
  const completedItems = batch.items.filter((item) => item.checked && item.receivedQty > 0);
  const completedQuantity = completedItems.reduce((sum, item) => sum + item.receivedQty, 0);
  const completedLabel = batch.completedAt
    ? `Completed ${formatDateTime(batch.completedAt)}`
    : "Completed -";
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const visibleItems =
    batch.status === "in_progress" && normalizedSearchQuery
      ? batch.items.filter((item) => {
          const product = products.find((entry) => entry.id === item.productId);
          if (!product) return false;

          return [product.name, product.sku]
            .filter(Boolean)
            .some((value) => value.toLowerCase().includes(normalizedSearchQuery));
        })
      : batch.items;

  function replaceItems(nextItems: BatchLine[]) {
    updateBatch(activeBatch.id, { items: nextItems });
  }

  function addProduct(productId: string) {
    const existingItem = activeBatch.items.find((item) => item.productId === productId);
    if (existingItem) {
      pendingFocusProductId.current = productId;
      if (isMobilePickerViewport()) {
        setIsPickerOpen(false);
      }
      return;
    }

    replaceItems([
      ...activeBatch.items,
      {
        id: `line-${productId}-${activeBatch.items.length + 1}`,
        productId,
        plannedQty: 0,
        receivedQty: 0,
        checked: false,
      },
    ]);
    pendingFocusProductId.current = productId;
    if (isMobilePickerViewport()) {
      setIsPickerOpen(false);
    }
  }

  function updateItem(
    productId: string,
    patch: {
      receivedQty?: number;
      checked?: boolean;
    },
  ) {
    replaceItems(
      activeBatch.items.map((item) =>
        item.productId === productId
          ? {
              ...item,
              receivedQty:
                patch.receivedQty === undefined ? item.receivedQty : Math.max(0, patch.receivedQty),
              checked: patch.checked === undefined ? item.checked : patch.checked,
            }
          : item,
      ),
    );
  }

  function removeItem(productId: string) {
    replaceItems(activeBatch.items.filter((item) => item.productId !== productId));
  }

  function handleCompleteBatch() {
    completeBatch(activeBatch.id);
    setIsCompleteDialogOpen(false);
    setIsPickerOpen(false);
  }

  return (
    <MasterStockShell currentPath="batches">
      <section className="space-y-8 pb-24 md:pb-0">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-3">
            <Link
              href="/master-stock/batches"
              className={buttonVariants({ variant: "outline", className: "min-h-11 w-fit" })}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Link>
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
                {getBatchName(batch.name, batch.source)}
              </h1>
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span>
                  {sourceLabel} •{" "}
                  {batch.status === "completed" ? completedItems.length : itemCount} item
                  {(batch.status === "completed" ? completedItems.length : itemCount) === 1 ? "" : "s"} •{" "}
                  {batch.status === "completed" ? completedQuantity : totals.planned} pcs
                </span>
                <span
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[11px] uppercase tracking-[0.18em]",
                    getStatusClassName(batch.status),
                  )}
                >
                  {getBatchStatusLabel(batch.status)}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {batch.status === "completed" ? completedLabel : createdLabel}
              </p>
            </div>
          </div>

          {batch.status !== "completed" ? (
            <Button
              onClick={() => setIsCompleteDialogOpen(true)}
              className="hidden min-h-11 w-full sm:w-auto md:inline-flex"
            >
              Update Stock & Complete
            </Button>
          ) : null}
        </div>

        <Card className="border-white/10">
          <CardContent className="space-y-4 p-4 md:p-5">
            {editable ? (
              <div className="relative">
                <Button
                  ref={addItemButtonRef}
                  type="button"
                  variant="outline"
                  onClick={() => setIsPickerOpen((current) => !current)}
                  className="min-h-12 w-full sm:w-auto"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Item
                </Button>

                <BatchItemPicker
                  open={isPickerOpen}
                  onOpenChange={setIsPickerOpen}
                  products={products}
                  categories={categories}
                  selectedProductIds={selectedProductIds}
                  onAdd={addProduct}
                  triggerRef={addItemButtonRef}
                />
              </div>
            ) : null}

            {batch.status === "completed" ? (
              <div className="space-y-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">
                    Updated {sourceLabel} stock
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Final record of the quantities that were applied when this batch was completed.
                  </p>
                </div>

                {completedItems.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/10 px-4 py-10 text-center text-sm text-muted-foreground">
                    No checked items were applied when this batch was completed.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {completedItems.map((item) => {
                      const product = products.find((entry) => entry.id === item.productId);
                      if (!product) return null;

                      return (
                        <div
                          key={item.id}
                          className="flex flex-col gap-3 rounded-2xl border border-white/10 px-4 py-4 md:flex-row md:items-center md:justify-between"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground">{product.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {product.sku} · {getCategoryName(product.categoryId, categories)}
                            </p>
                          </div>

                          <div className="space-y-1 text-sm md:text-right">
                            <p className="font-medium text-foreground">{item.receivedQty} pcs</p>
                            <p className="text-xs text-muted-foreground">
                              Applied to {sourceLabel}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : batch.items.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 px-4 py-10 text-center text-sm text-muted-foreground">
                No items have been added to this batch yet.
              </div>
            ) : (
              <div className="space-y-2">
                {batch.status === "in_progress" ? (
                  <Input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search items in this batch..."
                    className="h-11"
                    aria-label="Search items in this batch"
                  />
                ) : null}

                {visibleItems.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/10 px-4 py-10 text-center text-sm text-muted-foreground">
                    No matching items in this batch.
                  </div>
                ) : (
                  visibleItems.map((item) => {
                    const product = products.find((entry) => entry.id === item.productId);
                    if (!product) return null;

                    return (
                      <div
                        key={item.id}
                        className={cn(
                          "flex items-start justify-between gap-3 rounded-2xl border px-4 py-4",
                          item.checked ? "border-white/20 bg-white/[0.03]" : "border-white/10",
                        )}
                      >
                        <div className="flex min-w-0 flex-1 items-start gap-3">
                          <Checkbox
                            aria-label={`Mark ${product.name} checked`}
                            checked={item.checked}
                            onChange={(event) =>
                              updateItem(item.productId, { checked: event.target.checked })
                            }
                            disabled={!editable}
                            className="mt-1 h-5 w-5"
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground">{product.name}</p>
                            <p className="text-xs text-muted-foreground">{product.sku}</p>
                          </div>
                        </div>

                        <div className="flex shrink-0 items-start gap-2">
                          <label className="w-[116px] space-y-2 text-right text-sm sm:w-[136px]">
                            <span className="block text-xs text-muted-foreground">
                              Planned: {item.plannedQty} pcs
                            </span>
                            <Input
                              ref={(node) => {
                                plannedInputRefs.current.set(item.productId, node);
                              }}
                              type="number"
                              min="0"
                              inputMode="numeric"
                              value={String(item.receivedQty)}
                              onChange={(event) =>
                                updateItem(item.productId, {
                                  receivedQty: Number(event.target.value) || 0,
                                })
                              }
                              onKeyDown={(event) => {
                                if (event.key !== "Enter") {
                                  return;
                                }

                                event.preventDefault();
                                const currentIndex = visibleItems.findIndex(
                                  (entry) => entry.productId === item.productId,
                                );
                                const nextItem = visibleItems[currentIndex + 1];
                                if (!nextItem) {
                                  return;
                                }

                                const nextInput = plannedInputRefs.current.get(nextItem.productId);
                                if (!nextInput) {
                                  return;
                                }

                                window.requestAnimationFrame(() => {
                                  nextInput.focus();
                                  nextInput.select();
                                });
                              }}
                              className="h-12 text-base"
                              disabled={!editable}
                            />
                          </label>

                          {editable ? (
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => removeItem(item.productId)}
                              className="min-h-12 px-3"
                              aria-label={`Remove ${product.name}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <ActivityHistory
          entries={batch.history}
          description="Traceable audit trail for this batch."
        />
      </section>

      <Dialog
        open={isCompleteDialogOpen}
        onOpenChange={setIsCompleteDialogOpen}
        title="Complete batch?"
        description="This will update stock based on the checked items and current quantities."
        className="border-white/10 bg-[#09090b] md:max-w-md"
        headerClassName="border-b-0 px-4 pb-2 pt-5 md:px-6 md:pt-6"
        bodyClassName="hidden"
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
              onClick={handleCompleteBatch}
              className="min-h-11 w-full sm:w-auto"
            >
              Update Stock & Complete
            </Button>
          </div>
        }
      >
        {null}
      </Dialog>

      {batch.status !== "completed" ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-background/95 p-4 backdrop-blur md:hidden">
          <Button
            onClick={() => setIsCompleteDialogOpen(true)}
            className="min-h-12 w-full"
          >
            Update Stock & Complete
          </Button>
        </div>
      ) : null}
    </MasterStockShell>
  );
}
