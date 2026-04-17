"use client";

import Link from "next/link";
import { ArrowLeft, Check, Download, Plus, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { MasterStockShell } from "@/components/master-stock/shell";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useMasterStock } from "@/lib/master-stock-context";
import { exportSingleProductionPlanPdf } from "@/lib/pdf-export";
import { getCategoryName } from "@/lib/stock-helpers";
import type { ProductionPlanItem } from "@/lib/types";
import { cn, titleCase } from "@/lib/utils";

export function ProductionPlanDetailPage({ planId }: { planId: string }) {
  const {
    productionPlans,
    products,
    categories,
    updateProductionPlan,
    completeProductionPlan,
  } = useMasterStock();
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [pendingFocusProductId, setPendingFocusProductId] = useState<string | null>(null);
  const [isCompleteDialogOpen, setIsCompleteDialogOpen] = useState(false);
  const quantityInputRefs = useRef<Map<string, HTMLInputElement | null>>(new Map());
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const addItemButtonRef = useRef<HTMLButtonElement | null>(null);
  const pickerPanelRef = useRef<HTMLDivElement | null>(null);

  const plan = productionPlans.find((entry) => entry.id === planId);
  const planItems = plan?.items ?? [];
  const isDraft = plan?.status === "draft";
  const totalQuantity = planItems.reduce((sum, item) => sum + item.quantity, 0);

  const selectedProductIds = useMemo(
    () => new Set(planItems.map((item) => item.productId)),
    [planItems],
  );

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();

    return products.filter((product) => {
      if (product.archived || selectedProductIds.has(product.id)) {
        return false;
      }

      if (!query) {
        return true;
      }

      return `${product.name} ${product.sku}`.toLowerCase().includes(query);
    });
  }, [products, search, selectedProductIds]);

  useEffect(() => {
    setHighlightedIndex((current) => {
      if (filteredProducts.length === 0) {
        return 0;
      }

      return Math.min(current, filteredProducts.length - 1);
    });
  }, [filteredProducts]);

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

  useEffect(() => {
    if (!isAddItemOpen) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isAddItemOpen]);

  useEffect(() => {
    if (!isAddItemOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent | TouchEvent) {
      const target = event.target as Node | null;
      if (!target) {
        return;
      }

      if (pickerPanelRef.current?.contains(target)) {
        return;
      }

      if (addItemButtonRef.current?.contains(target)) {
        return;
      }

      setIsAddItemOpen(false);
    }

    function handleWindowKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsAddItemOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    window.addEventListener("keydown", handleWindowKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      window.removeEventListener("keydown", handleWindowKeyDown);
    };
  }, [isAddItemOpen]);

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

  function replaceItems(nextItems: ProductionPlanItem[]) {
    updateProductionPlan({
      planId: activePlan.id,
      items: nextItems,
    });
  }

  function addProduct(productId: string) {
    replaceItems([...activePlan.items, { productId, quantity: 0 }]);
    setPendingFocusProductId(productId);
  }

  function updateQuantity(productId: string, value: string) {
    replaceItems(
      activePlan.items.map((item) =>
        item.productId === productId
          ? { ...item, quantity: Math.max(0, Number(value) || 0) }
          : item,
      ),
    );
  }

  function removeProduct(productId: string) {
    replaceItems(activePlan.items.filter((item) => item.productId !== productId));
  }

  function handleCompletePlan() {
    completeProductionPlan(activePlan.id);
    setIsCompleteDialogOpen(false);
    setIsAddItemOpen(false);
  }

  function handleExport() {
    void exportSingleProductionPlanPdf({
      plan: activePlan,
      products,
      categories,
    });
  }

  function handlePickerKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (filteredProducts.length === 0) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightedIndex((current) =>
        Math.min(current + 1, filteredProducts.length - 1),
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex((current) => Math.max(current - 1, 0));
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const highlightedProduct = filteredProducts[highlightedIndex] ?? filteredProducts[0];
      if (highlightedProduct) {
        addProduct(highlightedProduct.id);
      }
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setIsAddItemOpen(false);
    }
  }

  return (
    <MasterStockShell currentPath="plans">
      <section className="space-y-6">
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
                  {titleCase(plan.source)} • {plan.items.length} item
                  {plan.items.length === 1 ? "" : "s"} • {totalQuantity} pcs
                </span>
                <span
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[11px] uppercase tracking-[0.18em]",
                    isDraft
                      ? "border border-white/10 text-muted-foreground"
                      : "bg-white text-black",
                  )}
                >
                  {plan.status}
                </span>
              </div>
              {plan.notes ? (
                <p className="text-sm text-muted-foreground">{plan.notes}</p>
              ) : null}
            </div>
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
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
          <CardContent className="space-y-4 p-4 md:p-5">
            {isDraft ? (
              <div className="relative">
                <Button
                  ref={addItemButtonRef}
                  variant="outline"
                  onClick={() => setIsAddItemOpen((current) => !current)}
                  className="min-h-11 w-full sm:w-auto"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Item
                </Button>

                {isAddItemOpen ? (
                  <div
                    ref={pickerPanelRef}
                    className="mt-3 rounded-2xl border border-white/10 bg-[#09090b] p-3 shadow-2xl sm:absolute sm:left-0 sm:top-full sm:z-20 sm:mt-2 sm:w-[520px]"
                  >
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-foreground">Add items to this plan</p>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setIsAddItemOpen(false)}
                        className="min-h-11 px-3 text-muted-foreground hover:text-foreground"
                        aria-label="Close add item picker"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>

                    <Input
                      ref={searchInputRef}
                      value={search}
                      onChange={(event) => {
                        setSearch(event.target.value);
                        setHighlightedIndex(0);
                      }}
                      onKeyDown={handlePickerKeyDown}
                      placeholder="Search product or SKU..."
                      className="h-11"
                    />

                    <div className="mt-3 max-h-[340px] space-y-2 overflow-y-auto pr-1">
                      {filteredProducts.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-muted-foreground">
                          No products match this search.
                        </div>
                      ) : (
                        filteredProducts.map((product, index) => (
                          <div
                            key={product.id}
                            className={cn(
                              "flex items-start justify-between gap-3 rounded-xl border border-transparent px-3 py-3 transition-colors hover:bg-white/[0.03]",
                              index === highlightedIndex
                                ? "border-white/10 bg-white/[0.04]"
                                : "",
                            )}
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground">{product.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {product.sku} · {getCategoryName(product.categoryId, categories)}
                              </p>
                            </div>
                            <Button
                              variant="outline"
                              onClick={() => addProduct(product.id)}
                              className="min-h-11 shrink-0"
                            >
                              <Plus className="mr-2 h-4 w-4" />
                              Add
                            </Button>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="mt-3 sm:hidden">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsAddItemOpen(false)}
                        className="min-h-11 w-full"
                      >
                        Done
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {plan.items.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 px-4 py-10 text-center text-sm text-muted-foreground">
                {isDraft
                  ? "Add products to start building this plan."
                  : "No products were added to this plan."}
              </div>
            ) : (
              <div className="space-y-2">
                {plan.items.map((item) => {
                  const product = products.find((entry) => entry.id === item.productId);
                  if (!product) return null;

                  return (
                    <div
                      key={item.productId}
                      className="flex flex-col gap-3 rounded-2xl border border-white/10 px-4 py-4 md:flex-row md:items-center md:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">{product.name}</p>
                        <p className="text-xs text-muted-foreground">{product.sku}</p>
                      </div>

                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <label className="space-y-2 text-sm">
                          <span className="text-muted-foreground">Quantity</span>
                          <Input
                            type="number"
                            min="0"
                            inputMode="numeric"
                            value={String(item.quantity)}
                            onChange={(event) => updateQuantity(item.productId, event.target.value)}
                            className="h-11 w-full sm:w-[120px]"
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
                            className="min-h-11 w-full sm:mt-6 sm:w-auto"
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
    </MasterStockShell>
  );
}
