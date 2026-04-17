"use client";

import Link from "next/link";
import { ArrowLeft, Check, Download, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { ActivityHistory } from "@/components/master-stock/activity-history";
import { BatchItemPicker } from "@/components/master-stock/batch-item-picker";
import { MasterStockShell } from "@/components/master-stock/shell";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useMasterStock } from "@/lib/master-stock-context";
import { exportSingleProductionPlanPdf } from "@/lib/pdf-export";
import type { ProductionPlanItem } from "@/lib/types";
import { cn, formatDate, formatDateTime, titleCase } from "@/lib/utils";

export function ProductionPlanDetailPage({ planId }: { planId: string }) {
  const {
    productionPlans,
    products,
    categories,
    updateProductionPlan,
    completeProductionPlan,
  } = useMasterStock();
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [pendingFocusProductId, setPendingFocusProductId] = useState<string | null>(null);
  const [isCompleteDialogOpen, setIsCompleteDialogOpen] = useState(false);
  const quantityInputRefs = useRef<Map<string, HTMLInputElement | null>>(new Map());
  const addItemButtonRef = useRef<HTMLButtonElement | null>(null);

  const plan = productionPlans.find((entry) => entry.id === planId);
  const safeProducts = products ?? [];
  const safeCategories = categories ?? [];
  const planItems = plan?.items ?? [];
  const planHistory = plan?.history ?? [];
  const isDraft = plan?.status === "draft";
  const totalQuantity = planItems.reduce((sum, item) => sum + item.quantity, 0);

  const selectedProductIds = useMemo(
    () => new Set(planItems.map((item) => item.productId)),
    [planItems],
  );

  useEffect(() => {
    if (!pendingFocusProductId) {
      return;
    }

    const quantityInput = quantityInputRefs.current.get(pendingFocusProductId);
    if (!quantityInput) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      quantityInput.focus();
      quantityInput.select();
      if (typeof quantityInput.scrollIntoView === "function") {
        quantityInput.scrollIntoView({
          block: "nearest",
          behavior: "smooth",
        });
      }
      setPendingFocusProductId(null);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [pendingFocusProductId, planItems]);

  if (!plan) {
    return (
      <MasterStockShell currentPath="plans">
        <section className="space-y-4">
          <Link
            href="/master-stock/plans"
            className={buttonVariants({ variant: "outline", className: "min-h-11 w-fit" })}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
          <Card className="border-white/10">
            <CardContent className="px-5 py-12">
              <h1 className="text-xl font-semibold text-foreground">Plan not found</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                This production plan no longer exists or has not been created yet.
              </p>
            </CardContent>
          </Card>
        </section>
      </MasterStockShell>
    );
  }

  const activePlan = plan;
  const createdLabel = activePlan.createdAt ? `Created ${formatDate(activePlan.createdAt)}` : "Created -";
  const completedLabel = activePlan.completedAt
    ? `Completed ${formatDateTime(activePlan.completedAt)}`
    : undefined;

  function replaceItems(nextItems: ProductionPlanItem[]) {
    updateProductionPlan({
      planId: activePlan.id,
      items: nextItems,
    });
  }

  function addProduct(productId: string) {
    replaceItems([...planItems, { productId, plannedQty: 0, quantity: 0 }]);
    setPendingFocusProductId(productId);
  }

  function updateQuantity(productId: string, value: string) {
    replaceItems(
      planItems.map((item) =>
        item.productId === productId
          ? { ...item, quantity: Math.max(0, Number(value) || 0) }
          : item,
      ),
    );
  }

  function removeProduct(productId: string) {
    replaceItems(planItems.filter((item) => item.productId !== productId));
  }

  function handleCompletePlan() {
    completeProductionPlan(activePlan.id);
    setIsCompleteDialogOpen(false);
    setIsAddItemOpen(false);
  }

  function handleExport() {
    void exportSingleProductionPlanPdf({
      plan: activePlan,
      products: safeProducts,
      categories: safeCategories,
    });
  }

  function focusNextQuantityInput(currentProductId: string) {
    const currentIndex = planItems.findIndex((item) => item.productId === currentProductId);
    if (currentIndex < 0) {
      return;
    }

    const nextItem = planItems[currentIndex + 1];
    if (!nextItem) {
      return;
    }

    const nextInput = quantityInputRefs.current.get(nextItem.productId);
    if (!nextInput) {
      return;
    }

    window.requestAnimationFrame(() => {
      nextInput.focus();
      nextInput.select();
    });
  }

  return (
    <MasterStockShell currentPath="plans">
      <section className="space-y-8 pb-24 md:pb-0">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-3">
            <Link
              href="/master-stock/plans"
              className={buttonVariants({ variant: "outline", className: "min-h-11 w-fit" })}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Link>
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{plan.name}</h1>
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span>
                  {titleCase(plan.source)} • {planItems.length} item
                  {planItems.length === 1 ? "" : "s"} • {totalQuantity} pcs
                </span>
                <span
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[11px] uppercase tracking-[0.18em]",
                    isDraft
                      ? "border border-white/10 text-muted-foreground"
                      : "bg-white text-black",
                  )}
                >
                  {titleCase(plan.status)}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">{isDraft ? createdLabel : completedLabel ?? createdLabel}</p>
              {plan.notes ? (
                <p className="text-sm text-muted-foreground">{plan.notes}</p>
              ) : null}
            </div>
          </div>

          <div className="hidden w-full flex-col gap-2 sm:w-auto sm:flex-row md:flex">
            {isDraft ? (
              <Button
                onClick={() => setIsCompleteDialogOpen(true)}
                className="min-h-11 w-full sm:w-auto"
              >
                <Check className="mr-2 h-4 w-4" />
                Complete Plan
              </Button>
            ) : (
              <Button onClick={handleExport} className="min-h-11 w-full sm:w-auto">
                <Download className="mr-2 h-4 w-4" />
                Export PDF
              </Button>
            )}
          </div>
        </div>

        <Card className="border-white/10">
          <CardContent className="space-y-5 p-4 md:p-5">
            {isDraft ? (
              <div className="relative">
                <Button
                  ref={addItemButtonRef}
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
                  title="Add items to this plan"
                  triggerRef={addItemButtonRef}
                />
              </div>
            ) : null}

            {planItems.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 px-4 py-10 text-center text-sm text-muted-foreground">
                {isDraft
                  ? "Add products to start building this plan."
                  : "No products were added to this plan."}
              </div>
            ) : (
              <div className="space-y-2">
                {planItems.map((item) => {
                  const product = safeProducts.find((entry) => entry.id === item.productId);
                  if (!product) return null;

                  return (
                    <div
                      key={item.productId}
                      className="flex items-start justify-between gap-3 rounded-2xl border border-white/10 px-4 py-4"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground">{product.name}</p>
                        <p className="text-xs text-muted-foreground">{product.sku}</p>
                      </div>

                      <div className="flex shrink-0 items-start gap-2">
                        <label className="w-[116px] text-right text-sm sm:w-[136px]">
                          <Input
                            type="number"
                            min="0"
                            inputMode="numeric"
                            value={String(item.quantity)}
                            onChange={(event) => updateQuantity(item.productId, event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                focusNextQuantityInput(item.productId);
                              }
                            }}
                            className="h-12 w-full text-base sm:w-[140px]"
                            disabled={!isDraft}
                            ref={(node) => {
                              quantityInputRefs.current.set(item.productId, node);
                            }}
                          />
                        </label>

                        {isDraft ? (
                          <Button
                            variant="outline"
                            onClick={() => removeProduct(item.productId)}
                            className="min-h-12 px-3"
                            aria-label={`Remove ${product.name}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <ActivityHistory
          entries={planHistory}
          description="Traceable audit trail for this production plan."
        />
      </section>

      <Dialog
        open={isCompleteDialogOpen}
        onOpenChange={setIsCompleteDialogOpen}
        title="Mark this plan as complete?"
        description="Once completed, this plan becomes read-only and is ready for PDF export."
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
              onClick={handleCompletePlan}
              className="min-h-11 w-full sm:w-auto"
            >
              Complete Plan
            </Button>
          </div>
        }
      >
        {null}
      </Dialog>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-background/95 p-4 backdrop-blur md:hidden">
        {isDraft ? (
          <Button
            onClick={() => setIsCompleteDialogOpen(true)}
            className="min-h-12 w-full"
          >
            <Check className="mr-2 h-4 w-4" />
            Complete Plan
          </Button>
        ) : (
          <Button onClick={handleExport} className="min-h-12 w-full">
            <Download className="mr-2 h-4 w-4" />
            Export PDF
          </Button>
        )}
      </div>
    </MasterStockShell>
  );
}
