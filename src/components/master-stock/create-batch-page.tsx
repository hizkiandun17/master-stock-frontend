"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { BatchItemPicker } from "@/components/master-stock/batch-item-picker";
import { MasterStockShell } from "@/components/master-stock/shell";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useMasterStock } from "@/lib/master-stock-context";
import { getCategoryName } from "@/lib/stock-helpers";
import type { BatchPlannedItem, Product, StockLocationKey } from "@/lib/types";

const defaultBatchSource: StockLocationKey = "indira";
const longPressDurationMs = 650;

function getProductSubtitle(product: Product, categoryName: string) {
  return categoryName ? `${product.sku} · ${categoryName}` : product.sku;
}

export function CreateBatchPage() {
  const router = useRouter();
  const { products, categories, createIncoming } = useMasterStock();
  const [name, setName] = useState("");
  const [items, setItems] = useState<BatchPlannedItem[]>([]);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [mobileSearch, setMobileSearch] = useState("");
  const [isDesktop, setIsDesktop] = useState(false);
  const pendingFocusProductId = useRef<string | null>(null);
  const plannedInputRefs = useRef<Map<string, HTMLInputElement | null>>(new Map());
  const addItemButtonRef = useRef<HTMLButtonElement | null>(null);
  const mobileSearchInputRef = useRef<HTMLInputElement | null>(null);
  const removeTimeoutRef = useRef<number | null>(null);

  const selectedProductIds = useMemo(
    () => new Set(items.flatMap((item) => (typeof item.productId === "string" ? [item.productId] : []))),
    [items],
  );

  const filteredMobileProducts = useMemo(() => {
    const query = mobileSearch.trim().toLowerCase();

    return products.filter((product) => {
      if (product.archived) {
        return false;
      }

      if (!query) {
        return false;
      }

      return `${product.name} ${product.sku}`.toLowerCase().includes(query);
    });
  }, [mobileSearch, products]);

  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);

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
    if (items.length > 0) {
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
  }, [items.length]);

  useEffect(() => {
    return () => {
      if (removeTimeoutRef.current) {
        window.clearTimeout(removeTimeoutRef.current);
      }
    };
  }, []);

  function focusProductInput(productId: string) {
    const input = plannedInputRefs.current.get(productId);
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
    const existingItem = items.find((item) => item.productId === productId);
    if (existingItem) {
      pendingFocusProductId.current = productId;
      setMobileSearch("");
      return;
    }

    setItems((current) => [
      ...current,
      {
        id: `incoming-${productId}-${current.length + 1}`,
        productId,
        quantity: 0,
      },
    ]);
    pendingFocusProductId.current = productId;
    setMobileSearch("");
  }

  function updateItem(productId: string, patch: Partial<BatchPlannedItem>) {
    setItems((current) =>
      current.map((item) =>
        item.productId === productId
          ? {
              ...item,
              ...patch,
              quantity: patch.quantity === undefined ? item.quantity : Math.max(0, patch.quantity),
            }
          : item,
      ),
    );
  }

  function removeItem(productId: string) {
    setItems((current) => current.filter((item) => item.productId !== productId));
  }

  function scheduleMobileRemove(productId: string) {
    if (removeTimeoutRef.current) {
      window.clearTimeout(removeTimeoutRef.current);
    }

    removeTimeoutRef.current = window.setTimeout(() => {
      removeItem(productId);
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

  function focusNextInput(currentProductId: string) {
    const currentIndex = items.findIndex((item) => item.productId === currentProductId);
    if (currentIndex < 0) {
      return;
    }

    const nextItem = items[currentIndex + 1];
    if (!nextItem?.productId) {
      plannedInputRefs.current.get(currentProductId)?.blur();
      return;
    }

    focusProductInput(nextItem.productId);
  }

  function submitBatch() {
    const batch = createIncoming({
      name,
      source: defaultBatchSource,
      items: items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
      })),
    });

    router.push(`/master-stock/incoming/${batch.id}`);
  }

  return (
    <MasterStockShell currentPath="production-batch">
      <section className="space-y-6 pb-28 md:pb-0">
        <div className="hidden md:flex md:flex-row md:items-start md:justify-between md:gap-4">
          <div className="space-y-3">
            <Link
              href="/master-stock/incoming"
              className={buttonVariants({ variant: "outline", className: "min-h-11 w-fit" })}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Link>
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
                Create Production Batch
              </h1>
              <p className="max-w-2xl text-sm text-muted-foreground md:text-base">
                Prepare a production batch for what the craftsman will send back.
              </p>
            </div>
          </div>

          <Button
            onClick={submitBatch}
            disabled={items.length === 0}
            className="min-h-11 w-full sm:w-auto"
          >
            Create Production Batch
          </Button>
        </div>

        {!isDesktop ? (
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
                  {name.trim() || "New Batch"}
                </h1>
                <p className="text-sm text-muted-foreground">
                  Draft • {items.length} item{items.length === 1 ? "" : "s"} • {totalQuantity} pcs
                </p>
              </div>
              <span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                Draft
              </span>
            </div>
          </div>
        </div>
        ) : null}

        <Card className="border-white/10">
          <CardContent className="space-y-4 p-4 md:p-5">
            <label className="space-y-2 text-sm">
              <span className="text-foreground">Batch Name</span>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Optional batch name"
                className="h-11 md:h-11"
              />
            </label>
          </CardContent>
        </Card>

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
                      const categoryName = getCategoryName(product.categoryId, categories);
                      const isAdded = selectedProductIds.has(product.id);

                      return (
                        <button
                          key={product.id}
                          type="button"
                          onClick={() => addProduct(product.id)}
                          className="flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl border border-white/10 px-4 py-3 text-left transition-colors hover:bg-white/[0.03]"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">{product.name}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {getProductSubtitle(product, categoryName)}
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

          {items.length === 0 ? (
            <Card className="border-white/10">
              <CardContent className="px-4 py-10 text-center text-sm text-muted-foreground">
                Search above to add the first item to this batch.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {items.map((item) => {
                const product = products.find((entry) => entry.id === item.productId);
                if (!product || !item.productId) {
                  return null;
                }

                const categoryName = getCategoryName(product.categoryId, categories);

                return (
                  <Card
                    key={item.id}
                    className="border-white/10"
                    onTouchStart={() => scheduleMobileRemove(item.productId ?? "")}
                    onTouchEnd={clearScheduledRemove}
                    onTouchCancel={clearScheduledRemove}
                  >
                    <CardContent className="space-y-3 p-4">
                      <div className="space-y-1">
                        <p className="text-base font-medium text-foreground">{product.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {getProductSubtitle(product, categoryName)}
                        </p>
                      </div>
                      <Input
                        ref={(node) => {
                              plannedInputRefs.current.set(item.productId ?? "", node);
                              if (pendingFocusProductId.current === item.productId && node) {
                                window.requestAnimationFrame(() => {
                                  if (typeof node.scrollIntoView === "function") {
                                    node.scrollIntoView({ block: "center", behavior: "smooth" });
                                  }
                                  node.focus();
                                  node.select();
                                  pendingFocusProductId.current = null;
                                });
                              }
                        }}
                        type="number"
                        min="0"
                        inputMode="numeric"
                        enterKeyHint="next"
                        value={String(item.quantity)}
                        onChange={(event) =>
                          updateItem(item.productId ?? "", {
                            quantity: Number(event.target.value) || 0,
                          })
                        }
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            focusNextInput(item.productId ?? "");
                          }
                        }}
                        className="h-14 text-lg"
                        aria-label={`Quantity for ${product.name}`}
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
            <CardContent className="space-y-4 p-4 md:p-5">
              <div className="relative">
                <Button
                  ref={addItemButtonRef}
                  type="button"
                  variant="outline"
                  onClick={() => setIsPickerOpen((current) => !current)}
                  className="min-h-11 w-full sm:w-auto"
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

              {items.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 px-4 py-10 text-center text-sm text-muted-foreground">
                  Add products to start building this production batch.
                </div>
              ) : (
                <div className="space-y-2">
                  {items.map((item) => {
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

                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                          <Input
                            ref={(node) => {
                              plannedInputRefs.current.set(item.productId ?? "", node);
                              if (pendingFocusProductId.current === item.productId && node) {
                                window.requestAnimationFrame(() => {
                                  node.focus();
                                  node.select();
                                  pendingFocusProductId.current = null;
                                });
                              }
                            }}
                            type="number"
                            min="0"
                            inputMode="numeric"
                            value={String(item.quantity)}
                            onChange={(event) =>
                              updateItem(item.productId ?? "", {
                                quantity: Number(event.target.value) || 0,
                              })
                            }
                            className="h-11 w-full sm:w-[140px]"
                            aria-label={`Quantity for ${product.name}`}
                          />

                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => removeItem(item.productId ?? "")}
                            className="min-h-11 w-full sm:w-auto"
                            aria-label={`Remove ${product.name}`}
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
      </section>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-background/95 px-4 py-3 backdrop-blur md:hidden">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Total</p>
            <p className="text-lg font-semibold text-foreground">{totalQuantity} pcs</p>
          </div>
          <Button
            onClick={submitBatch}
            disabled={items.length === 0}
            className="min-h-12 flex-1"
          >
            Submit Batch
          </Button>
        </div>
      </div>
    </MasterStockShell>
  );
}
