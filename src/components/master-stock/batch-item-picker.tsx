"use client";

import { Plus, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getCategoryName } from "@/lib/stock-helpers";
import type { Category, Product } from "@/lib/types";
import { cn } from "@/lib/utils";

interface BatchItemPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: Product[];
  categories: Category[];
  selectedProductIds: Set<string>;
  onAdd: (productId: string) => void;
  title?: string;
  triggerRef?: RefObject<HTMLElement | null>;
}

export function BatchItemPicker({
  open,
  onOpenChange,
  products,
  categories,
  selectedProductIds,
  onAdd,
  title = "Add items to this batch",
  triggerRef,
}: BatchItemPickerProps) {
  const [search, setSearch] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

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
    if (!open) {
      setSearch("");
      setHighlightedIndex(0);
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    setHighlightedIndex((current) => {
      if (filteredProducts.length === 0) {
        return 0;
      }

      return Math.min(current, filteredProducts.length - 1);
    });
  }, [filteredProducts]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: MouseEvent | TouchEvent) {
      const target = event.target as Node | null;
      if (!target || panelRef.current?.contains(target) || triggerRef?.current?.contains(target)) {
        return;
      }

      onOpenChange(false);
    }

    function handleWindowKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onOpenChange(false);
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
  }, [onOpenChange, open]);

  function handlePickerKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (filteredProducts.length === 0) {
      if (event.key === "Escape") {
        event.preventDefault();
        onOpenChange(false);
      }
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightedIndex((current) => Math.min(current + 1, filteredProducts.length - 1));
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
        onAdd(highlightedProduct.id);
      }
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      onOpenChange(false);
    }
  }

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[110] bg-black/60 sm:absolute sm:inset-auto sm:left-0 sm:top-full sm:z-20 sm:mt-2 sm:bg-transparent"
      onClick={() => onOpenChange(false)}
    >
      <div
        ref={panelRef}
        className="flex h-full flex-col bg-[#09090b] p-4 shadow-2xl sm:h-auto sm:max-h-[520px] sm:w-[520px] sm:rounded-2xl sm:border sm:border-white/10"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="min-h-11 px-3 text-muted-foreground hover:text-foreground"
            aria-label="Close item picker"
          >
            <X className="mr-2 h-4 w-4" />
            <span className="sm:hidden">Close</span>
          </Button>
          <p className="flex-1 text-right text-sm font-medium text-foreground sm:text-left sm:text-base">
            {title}
          </p>
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
          className="h-12 text-base"
        />

        <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
          <div className="space-y-2 pr-1">
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
                    index === highlightedIndex ? "border-white/10 bg-white/[0.04]" : "",
                  )}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{product.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {product.sku} · {getCategoryName(product.categoryId, categories)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onAdd(product.id)}
                    className="min-h-11 shrink-0 px-4"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="mt-4 border-t border-white/10 pt-4 sm:hidden">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="min-h-12 w-full"
          >
            Done
          </Button>
        </div>
        <div className="mt-4 hidden sm:block">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="min-h-11 w-full"
          >
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
