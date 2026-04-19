"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";

import { BatchItemPicker } from "@/components/master-stock/batch-item-picker";
import { MasterStockShell } from "@/components/master-stock/shell";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useMasterStock } from "@/lib/master-stock-context";
import { getCategoryName } from "@/lib/stock-helpers";
import type { BatchPlannedItem, StockLocationKey } from "@/lib/types";
import { titleCase } from "@/lib/utils";

const batchSourceOptions: StockLocationKey[] = ["indira", "mita", "warehouse"];

export function CreateBatchPage() {
  const router = useRouter();
  const { products, categories, createIncoming, currentUserRole } = useMasterStock();
  const [name, setName] = useState("");
  const [source, setSource] = useState<StockLocationKey>("indira");
  const [items, setItems] = useState<BatchPlannedItem[]>([]);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const pendingFocusProductId = useRef<string | null>(null);
  const plannedInputRefs = useRef<Map<string, HTMLInputElement | null>>(new Map());
  const addItemButtonRef = useRef<HTMLButtonElement | null>(null);

  const selectedProductIds = useMemo(
    () => new Set(items.flatMap((item) => (typeof item.productId === "string" ? [item.productId] : []))),
    [items],
  );

  function addProduct(productId: string) {
    if (items.some((item) => item.productId === productId)) {
      pendingFocusProductId.current = productId;
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
  }

  function updateItem(productId: string, patch: Partial<BatchPlannedItem>) {
    setItems((current) =>
      current.map((item) =>
        item.productId === productId
          ? {
              ...item,
              ...patch,
              quantity:
                patch.quantity === undefined ? item.quantity : Math.max(0, patch.quantity),
            }
          : item,
      ),
    );
  }

  function removeItem(productId: string) {
    setItems((current) => current.filter((item) => item.productId !== productId));
  }

  function submitBatch() {
    const batch = createIncoming({
      name,
      source,
      items: items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
      })),
    });

    router.push(`/master-stock/incoming/${batch.id}`);
  }

  return (
    <MasterStockShell currentPath="production-batch">
      <section className="space-y-6">
        {currentUserRole === "production" ? (
          <Card className="border-white/10">
            <CardContent className="space-y-4 px-5 py-12">
              <h1 className="text-xl font-semibold text-foreground">Production batches are managed internally</h1>
              <p className="text-sm text-muted-foreground">
                Craftsman users can fill in assigned production batches, but only the internal team can create them.
              </p>
              <Link
                href="/master-stock/incoming"
                className={buttonVariants({ variant: "outline", className: "min-h-11 w-fit" })}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Production Batch
              </Link>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
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

            <Card className="border-white/10">
              <CardContent className="grid gap-4 p-4 md:grid-cols-2 md:p-5">
                <label className="space-y-2 text-sm">
                  <span className="text-foreground">Batch Name</span>
                  <Input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Optional batch name"
                    className="h-11"
                  />
                </label>

                <label className="space-y-2 text-sm">
                  <span className="text-foreground">Source</span>
                  <Select
                    value={source}
                    onChange={(event) => setSource(event.target.value as StockLocationKey)}
                    className="h-11"
                  >
                    {batchSourceOptions.map((option) => (
                      <option key={option} value={option}>
                        {titleCase(option || "") || "-"}
                      </option>
                    ))}
                  </Select>
                </label>
              </CardContent>
            </Card>

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
                            <label className="space-y-2 text-sm">
                              <span className="text-muted-foreground">Quantity</span>
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
                              />
                            </label>

                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => removeItem(item.productId ?? "")}
                              className="min-h-11 w-full sm:mt-6 sm:w-auto"
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
          </>
        )}
      </section>
    </MasterStockShell>
  );
}
