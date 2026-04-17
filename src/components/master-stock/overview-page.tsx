"use client";
import {
  Archive,
  ChevronDown,
  Clock3,
  Download,
  Eye,
  Filter,
  FileText,
  History,
  MoreHorizontal,
  Package,
  PackagePlus,
  PencilLine,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";

import { CategorySelectField } from "@/components/master-stock/category-select-field";
import { ManageCategoriesDialog } from "@/components/master-stock/manage-categories-dialog";
import { MasterStockShell } from "@/components/master-stock/shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useMasterStock } from "@/lib/master-stock-context";
import { exportMasterStockPdf } from "@/lib/pdf-export";
import { getCategoryName, getProductTotal } from "@/lib/stock-helpers";
import type { Product } from "@/lib/types";
import { cn, formatRelativeTime } from "@/lib/utils";

type StockTab = "active" | "archived";
type StockConditionFilter = "all" | "out" | "low";
type SummaryCardId =
  | "total-sku"
  | "total-units"
  | "out-of-stock"
  | "low-stock"
  | "archived";

interface CreateStockDraft {
  name: string;
  sku: string;
  categoryId: string;
  consignmentPrice: string;
  wholesalePrice: string;
}

interface MarketPriceEntry {
  currency: string;
  value: string;
}

interface SummaryCard {
  id: SummaryCardId;
  value: number;
  label: string;
  helper: string;
  accent: "neutral" | "danger" | "warning";
  interactive: boolean;
  targetTab?: StockTab;
  targetCondition?: StockConditionFilter;
}

interface EditStockDraft {
  wholesaleActive: boolean;
  consignmentActive: boolean;
  categoryId: string;
  sku: string;
  consignmentPrice: string;
  wholesalePrice: string;
}

interface StockActionMenuProps {
  product: Product;
  open: boolean;
  onToggle: () => void;
  actionMenuRef?: RefObject<HTMLDivElement | null>;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onArchive: () => void;
  onHistory: () => void;
}

function hashString(value: string) {
  return Array.from(value).reduce((accumulator, character) => {
    return (accumulator * 31 + character.charCodeAt(0)) % 2147483647;
  }, 7);
}

function formatIdr(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatEur(value: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function getConsignmentPrice(product: Product) {
  return product.consignmentPriceIdr ?? 0;
}

function getWholesalePrice(product: Product) {
  return product.wholesalePriceEur ?? 0;
}

function getMarketPrices(product: Product): MarketPriceEntry[] {
  const wholesaleEur = getWholesalePrice(product);
  const consignmentIdr = getConsignmentPrice(product);
  const values = [
    ["USD", new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(wholesaleEur * 1.09)],
    ["EUR", formatEur(wholesaleEur)],
    ["GBP", new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(wholesaleEur * 0.86)],
    ["SGD", new Intl.NumberFormat("en-SG", { style: "currency", currency: "SGD" }).format(wholesaleEur * 1.46)],
    ["AUD", new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(wholesaleEur * 1.77)],
    ["IDR", formatIdr(consignmentIdr)],
  ] as const;

  return values.map(([currency, value]) => ({ currency, value }));
}

function buildQrMatrix(seed: string) {
  const size = 21;
  const seedValue = hashString(seed);
  const finder = new Set<string>();

  function markFinder(startRow: number, startColumn: number) {
    for (let row = startRow; row < startRow + 7; row += 1) {
      for (let column = startColumn; column < startColumn + 7; column += 1) {
        finder.add(`${row}-${column}`);
      }
    }
  }

  markFinder(0, 0);
  markFinder(0, size - 7);
  markFinder(size - 7, 0);

  return Array.from({ length: size * size }, (_, index) => {
    const row = Math.floor(index / size);
    const column = index % size;
    const key = `${row}-${column}`;

    if (finder.has(key)) {
      const localRow = row < 7 ? row : row - (size - 7);
      const localColumn = column < 7 ? column : column - (size - 7);
      const edge =
        localRow === 0 ||
        localRow === 6 ||
        localColumn === 0 ||
        localColumn === 6;
      const center =
        localRow >= 2 &&
        localRow <= 4 &&
        localColumn >= 2 &&
        localColumn <= 4;
      return edge || center;
    }

    const signal = (seedValue + row * 17 + column * 29 + row * column * 13) % 11;
    return signal < 5;
  });
}

function QrCodeMock({ sku }: { sku: string }) {
  const matrix = buildQrMatrix(sku);

  return (
    <div className="mx-auto w-full max-w-[156px] rounded-2xl bg-white p-3">
      <div className="grid grid-cols-[repeat(21,minmax(0,1fr))] gap-px">
        {matrix.map((filled, index) => (
          <div
            key={`${sku}-${index}`}
            className={cn("aspect-square rounded-[1px] bg-white", filled && "bg-black")}
          />
        ))}
      </div>
    </div>
  );
}

function ProductPreview({ product }: { product: Product }) {
  const tint = hashString(product.sku) % 3;
  const accentClass =
    tint === 0 ? "from-amber-200/60 via-stone-100 to-white" : tint === 1 ? "from-slate-200/60 via-stone-100 to-white" : "from-zinc-200/60 via-stone-100 to-white";

  return (
    <div className={cn("flex aspect-square items-center justify-center overflow-hidden rounded-[22px] bg-gradient-to-br p-8", accentClass)}>
      <div className="relative flex h-full w-full items-center justify-center">
        <div className="absolute h-28 w-28 rounded-full border-[10px] border-[#c9a76a] opacity-80" />
        <div className="absolute h-32 w-32 rounded-full border border-[#ead6ad] opacity-70" />
        <div className="absolute flex gap-1.5">
          {["#d14f40", "#d18e3a", "#4b7a44", "#4053a4", "#8051b2", "#d1a43a"].map(
            (color, index) => (
              <span
                key={`${product.id}-${color}`}
                className="h-3.5 w-3.5 rounded-full border border-white/70 shadow-sm"
                style={{
                  backgroundColor: color,
                  transform: `translateY(${Math.abs(index - 2.5) * 2}px)`,
                }}
              />
            ),
          )}
        </div>
        <div className="absolute bottom-3 rounded-full bg-black/65 px-3 py-1 text-[10px] uppercase tracking-[0.24em] text-white/80">
          {product.imageHint}
        </div>
      </div>
    </div>
  );
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows
    .map((row) =>
      row
        .map((cell) => `"${String(cell).replaceAll('"', '""')}"`)
        .join(","),
    )
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function useMobileViewport() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const updateViewport = () => {
      setIsMobile(window.innerWidth < 768);
    };

    updateViewport();
    window.addEventListener("resize", updateViewport);

    return () => window.removeEventListener("resize", updateViewport);
  }, []);

  return isMobile;
}

function StockActionMenu({
  product,
  open,
  onToggle,
  actionMenuRef,
  onView,
  onEdit,
  onDelete,
  onArchive,
  onHistory,
}: StockActionMenuProps) {
  return (
    <div ref={open ? actionMenuRef : null} className="relative flex justify-end">
      <button
        type="button"
        aria-label={`Open actions for ${product.name}`}
        className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        onClick={onToggle}
      >
        <MoreHorizontal className="h-5 w-5" />
      </button>

      {open ? (
        <div className="absolute right-0 top-12 z-30 w-56 rounded-2xl border border-white/10 bg-[#0b0b0f] p-2 shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
          <p className="px-3 py-2 text-sm font-medium text-foreground">Actions</p>
          <button
            type="button"
            className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-foreground transition-colors hover:bg-accent"
            onClick={onView}
          >
            <Eye className="h-4 w-4 text-muted-foreground" />
            View Details &amp; QR
          </button>
          <button
            type="button"
            className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-foreground transition-colors hover:bg-accent"
            onClick={onEdit}
          >
            <PencilLine className="h-4 w-4 text-muted-foreground" />
            Edit Stock
          </button>
          <div className="my-2 border-t border-border/80" />
          <button
            type="button"
            className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-danger transition-colors hover:bg-danger/10"
            onClick={onDelete}
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </button>
          <button
            type="button"
            className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-foreground transition-colors hover:bg-accent"
            onClick={onArchive}
          >
            <Archive className="h-4 w-4 text-muted-foreground" />
            Archive Stock
          </button>
          <button
            type="button"
            className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-foreground transition-colors hover:bg-accent"
            onClick={onHistory}
          >
            <History className="h-4 w-4 text-muted-foreground" />
            View History
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function OverviewPage() {
  const {
    products,
    categories,
    preferences,
    lastSyncedAt,
    setRowsPerPage,
    createCategory,
    createProduct,
    updateProductPricing,
    archiveProduct,
  } = useMasterStock();

  const [tab, setTab] = useState<StockTab>("active");
  const [stockCondition, setStockCondition] = useState<StockConditionFilter>("all");
  const [summarySelection, setSummarySelection] =
    useState<SummaryCardId | null>(null);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("all");
  const [page, setPage] = useState(1);
  const previousRowsPerPage = useRef(preferences.rowsPerPage);
  const isMobileViewport = useMobileViewport();

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);
  const actionMenuRef = useRef<HTMLDivElement | null>(null);
  const [selectedEditProduct, setSelectedEditProduct] = useState<Product | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editStockDraft, setEditStockDraft] = useState<EditStockDraft>({
    wholesaleActive: true,
    consignmentActive: true,
    categoryId: categories[0]?.id ?? "",
    sku: "",
    consignmentPrice: "0",
    wholesalePrice: "0",
  });

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isManageCategoriesOpen, setIsManageCategoriesOpen] = useState(false);
  const [createStockDraft, setCreateStockDraft] = useState<CreateStockDraft>({
    name: "",
    sku: "",
    categoryId: "",
    consignmentPrice: "0",
    wholesalePrice: "0",
  });

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.order - b.order),
    [categories],
  );

  const activeProducts = useMemo(
    () => products.filter((product) => !product.archived),
    [products],
  );

  const archivedProducts = useMemo(
    () => products.filter((product) => product.archived),
    [products],
  );

  const totalUnits = useMemo(
    () => activeProducts.reduce((sum, product) => sum + getProductTotal(product), 0),
    [activeProducts],
  );

  const outOfStockCount = useMemo(
    () => activeProducts.filter((product) => getProductTotal(product) === 0).length,
    [activeProducts],
  );

  const lowStockCount = useMemo(
    () =>
      activeProducts.filter((product) => {
        const total = getProductTotal(product);
        return total > 0 && total < product.lowStockThreshold;
      }).length,
    [activeProducts],
  );

  const headerDropdownTriggerClassName =
    "inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:w-auto";

  const summaryCards = useMemo<SummaryCard[]>(
    () => [
      {
        id: "total-sku",
        value: activeProducts.length,
        label: "Total SKU",
        helper: "Active items",
        accent: "neutral",
        interactive: false,
      },
      {
        id: "total-units",
        value: totalUnits,
        label: "Total Units",
        helper: "Actual stock only",
        accent: "neutral",
        interactive: false,
      },
      {
        id: "out-of-stock",
        value: outOfStockCount,
        label: "Out of Stock",
        helper: "Needs restock",
        accent: "danger",
        interactive: true,
        targetTab: "active" as const,
        targetCondition: "out" as const,
      },
      {
        id: "low-stock",
        value: lowStockCount,
        label: "Low Stock",
        helper: "Below threshold",
        accent: "warning",
        interactive: true,
        targetTab: "active" as const,
        targetCondition: "low" as const,
      },
      {
        id: "archived",
        value: archivedProducts.length,
        label: "Archived",
        helper: "Hidden from active",
        accent: "neutral",
        interactive: true,
        targetTab: "archived" as const,
        targetCondition: "all" as const,
      },
    ],
    [activeProducts.length, archivedProducts.length, lowStockCount, outOfStockCount, totalUnits],
  );

  const visibleProducts = useMemo(() => {
    return products.filter((product) => (tab === "active" ? !product.archived : product.archived));
  }, [products, tab]);

  const filteredProducts = useMemo(() => {
    return visibleProducts.filter((product) => {
      const searchText = `${product.name} ${product.sku}`.toLowerCase();
      const searchMatch = searchText.includes(search.toLowerCase());
      const categoryMatch = categoryId === "all" || product.categoryId === categoryId;
      const total = getProductTotal(product);
      const stockMatch =
        stockCondition === "all" ||
        (stockCondition === "out" && total === 0) ||
        (stockCondition === "low" && total > 0 && total < product.lowStockThreshold);
      return searchMatch && categoryMatch && stockMatch;
    });
  }, [categoryId, search, stockCondition, visibleProducts]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / preferences.rowsPerPage));

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  useEffect(() => {
    if (preferences.rowsPerPage === previousRowsPerPage.current) return;
    const anchorIndex = (page - 1) * previousRowsPerPage.current;
    const nextPage = Math.floor(anchorIndex / preferences.rowsPerPage) + 1;
    previousRowsPerPage.current = preferences.rowsPerPage;
    setPage(nextPage);
  }, [page, preferences.rowsPerPage]);

  const paginatedProducts = useMemo(() => {
    const start = (page - 1) * preferences.rowsPerPage;
    return filteredProducts.slice(start, start + preferences.rowsPerPage);
  }, [filteredProducts, page, preferences.rowsPerPage]);

  const freshnessMinutes = Math.round(
    (Date.now() - new Date(lastSyncedAt).getTime()) / 60000,
  );
  const isStale = freshnessMinutes > 60;
  const detailCategoryName = selectedProduct
    ? getCategoryName(selectedProduct.categoryId, sortedCategories)
    : "";
  const detailConsignmentPrice = selectedProduct ? getConsignmentPrice(selectedProduct) : 0;
  const detailWholesalePrice = selectedProduct ? getWholesalePrice(selectedProduct) : 0;
  const detailMarketPrices = selectedProduct ? getMarketPrices(selectedProduct) : [];

  function stopRowClick(event: { stopPropagation: () => void }) {
    event.stopPropagation();
  }

  useEffect(() => {
    if (!openActionMenuId) return;

    const onPointerDown = (event: MouseEvent) => {
      if (
        actionMenuRef.current &&
        !actionMenuRef.current.contains(event.target as Node)
      ) {
        setOpenActionMenuId(null);
      }
    };

    window.addEventListener("mousedown", onPointerDown);
    return () => window.removeEventListener("mousedown", onPointerDown);
  }, [openActionMenuId]);

  useEffect(() => {
    if (!selectedEditProduct) return;

    setEditStockDraft({
      wholesaleActive: selectedEditProduct.wholesaleActive ?? true,
      consignmentActive: selectedEditProduct.consignmentActive ?? true,
      categoryId: selectedEditProduct.categoryId ?? categories[0]?.id ?? "",
      sku: selectedEditProduct.sku ?? "",
      consignmentPrice: String(selectedEditProduct.consignmentPriceIdr ?? 0),
      wholesalePrice: (selectedEditProduct.wholesalePriceEur ?? 0)
        .toFixed(2)
        .replace(".", ","),
    });
  }, [categories, selectedEditProduct]);

  function resetSummaryFilter() {
    setTab("active");
    setStockCondition("all");
    setSummarySelection(null);
    setPage(1);
  }

  function toggleSummaryFilter(
    summaryId: SummaryCardId,
    nextTab: StockTab,
    nextCondition: StockConditionFilter,
  ) {
    if (summarySelection === summaryId) {
      resetSummaryFilter();
      return;
    }

    setTab(nextTab);
    setStockCondition(nextCondition);
    setSummarySelection(summaryId);
    setPage(1);
  }

  function exportFiltered() {
    downloadCsv(
      "stocks-current.csv",
      [
        ["SKU", "Name", "Category", "Indira", "Mita", "In Stock", "Total"],
        ...filteredProducts.map((product) => [
          product.sku,
          product.name,
          getCategoryName(product.categoryId, sortedCategories),
          String(product.currentStock.indira),
          String(product.currentStock.mita),
          String(product.currentStock.warehouse),
          `${getProductTotal(product)} Total`,
        ]),
      ],
    );
  }

  function exportProductionTeam() {
    void exportMasterStockPdf({
      products: filteredProducts,
      categories: sortedCategories,
      mode: "actual",
    });
  }

  function submitAddProduct() {
    if (
      !createStockDraft.name ||
      !createStockDraft.sku ||
      !createStockDraft.categoryId
    ) {
      return;
    }

    createProduct({
      name: createStockDraft.name,
      sku: createStockDraft.sku,
      categoryId: createStockDraft.categoryId,
      imageHint:
        createStockDraft.name
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((part) => part[0])
          .join("")
          .toUpperCase() || "NS",
      currentStock: {
        indira: 0,
        mita: 0,
        warehouse: 0,
      },
      lowStockThreshold: 5,
      wholesalePriceEur: parseCurrencyInput(createStockDraft.wholesalePrice),
      consignmentPriceIdr: Math.round(
        parseCurrencyInput(createStockDraft.consignmentPrice),
      ),
    });

    setIsCreateModalOpen(false);
    setCreateStockDraft({
      name: "",
      sku: "",
      categoryId: "",
      consignmentPrice: "0",
      wholesalePrice: "0",
    });
  }

  function openCreateModal() {
    setCreateStockDraft({
      name: "",
      sku: "",
      categoryId: "",
      consignmentPrice: "0",
      wholesalePrice: "0",
    });
    setIsCreateModalOpen(true);
  }

  function closeCreateModal() {
    setIsCreateModalOpen(false);
    setCreateStockDraft({
      name: "",
      sku: "",
      categoryId: "",
      consignmentPrice: "0",
      wholesalePrice: "0",
    });
  }

  function parseCurrencyInput(value: string) {
    return Number(value.replace(/[^\d,.-]/g, "").replace(",", ".")) || 0;
  }

  function submitEditStock() {
    if (!selectedEditProduct) return;

    updateProductPricing({
      productId: selectedEditProduct.id,
      categoryId: editStockDraft.categoryId,
      sku: editStockDraft.sku,
      wholesaleActive: editStockDraft.wholesaleActive,
      consignmentActive: editStockDraft.consignmentActive,
      wholesalePriceEur: parseCurrencyInput(editStockDraft.wholesalePrice),
      consignmentPriceIdr: Math.round(parseCurrencyInput(editStockDraft.consignmentPrice)),
    });
    setIsEditModalOpen(false);
    setSelectedEditProduct(null);
  }

  function openEditStock(product: Product) {
    setOpenActionMenuId(null);
    setSelectedEditProduct(product);
    setIsEditModalOpen(true);
  }

  function handleDelete(product: Product) {
    setOpenActionMenuId(null);
    console.info("Delete stock placeholder", product.id);
  }

  function handleArchive(product: Product) {
    setOpenActionMenuId(null);
    archiveProduct(product.id);
  }

  function handleViewHistory(product: Product) {
    setOpenActionMenuId(null);
    console.info("View stock history placeholder", product.id);
  }

  return (
    <MasterStockShell currentPath="overview">
      <section className="space-y-5 md:space-y-6">
        <div className="flex flex-col gap-4 md:gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Stocks</h1>
            <div className="inline-flex w-full items-center gap-2 rounded-full border border-border bg-secondary px-3 py-2 text-xs text-muted-foreground sm:w-auto">
              <Clock3 className="h-3.5 w-3.5" />
              {isStale
                ? `Data may be stale. Last synced ${formatRelativeTime(lastSyncedAt)}`
                : `Last synced ${formatRelativeTime(lastSyncedAt)}`}
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label="Open export options"
                className={cn(
                  headerDropdownTriggerClassName,
                )}
              >
                <Download className="mr-2 h-4 w-4" />
                Export
                <ChevronDown className="ml-2 h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel>General</DropdownMenuLabel>
                <DropdownMenuItem onClick={exportFiltered}>
                  <FileText className="h-4 w-4" />
                  Stock Summary
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Production</DropdownMenuLabel>
                <DropdownMenuItem onClick={exportProductionTeam}>
                  <Package className="h-4 w-4" />
                  Production Team Report
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label="Open add stock options"
                className={cn(headerDropdownTriggerClassName)}
              >
                <PackagePlus className="mr-2 h-4 w-4" />
                Add Stock
                <ChevronDown className="ml-2 h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={openCreateModal}>
                  <PackagePlus className="h-4 w-4" />
                  Add New Stock
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setIsManageCategoriesOpen(true)}>
                  <PencilLine className="h-4 w-4" />
                  Manage Categories
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-full border border-border bg-secondary p-1">
            <button
              type="button"
              onClick={resetSummaryFilter}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm transition-colors",
                tab === "active"
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
              aria-pressed={tab === "active"}
            >
              Active Stocks
            </button>
            <button
              type="button"
              onClick={() => {
                setTab("archived");
                setStockCondition("all");
                setSummarySelection(null);
                setPage(1);
              }}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm transition-colors",
                tab === "archived"
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
              aria-pressed={tab === "archived"}
            >
              Archived
            </button>
          </div>
        </div>

        <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
          <div className="flex min-w-full gap-3 md:grid md:grid-cols-2 xl:grid-cols-5">
          {summaryCards.map((card) => (
            <div
              key={card.id}
              onClick={
                card.interactive && card.targetTab && card.targetCondition
                  ? () => toggleSummaryFilter(card.id, card.targetTab!, card.targetCondition!)
                  : undefined
              }
              className={cn(
                "min-w-[140px] shrink-0 rounded-[18px] border px-4 py-4 text-left md:min-w-0",
                card.interactive
                  ? "cursor-pointer bg-card transition-all duration-150 hover:-translate-y-1 hover:border-zinc-600 hover:bg-white/[0.03] active:scale-[0.98]"
                  : "bg-zinc-950/70 border-zinc-900/80",
                card.interactive && summarySelection === card.id
                  ? "border-white bg-zinc-800/80"
                  : card.interactive
                    ? "border-border"
                    : "",
                card.accent === "danger" &&
                  (card.interactive && summarySelection === card.id
                    ? "border-danger/70 bg-danger/[0.08]"
                    : "border-danger/20"),
                card.accent === "warning" &&
                  (card.interactive && summarySelection === card.id
                    ? "border-warning/70 bg-warning/[0.08]"
                    : card.interactive
                      ? "border-warning/20"
                      : ""),
              )}
              role={card.interactive ? "button" : undefined}
              tabIndex={card.interactive ? 0 : undefined}
              onKeyDown={
                card.interactive && card.targetTab && card.targetCondition
                  ? (event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        toggleSummaryFilter(card.id, card.targetTab!, card.targetCondition!);
                      }
                    }
                  : undefined
              }
              aria-pressed={card.interactive ? summarySelection === card.id : undefined}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p
                    className={cn(
                      "text-2xl font-semibold tracking-tight text-foreground",
                      card.accent === "danger" && "text-danger",
                      card.accent === "warning" && "text-warning",
                    )}
                  >
                    {card.value}
                  </p>
                  <p className="mt-1 text-sm text-foreground">{card.label}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{card.helper}</p>
                </div>
                {card.interactive ? (
                  <span className="pt-1 text-xs text-muted-foreground/80">
                    {summarySelection === card.id ? "Reset" : "→"}
                  </span>
                ) : null}
              </div>
              {card.interactive ? (
                <p className="mt-3 text-[11px] uppercase tracking-[0.18em] text-muted-foreground/70">
                  {summarySelection === card.id ? "Click again to reset" : "Click to filter"}
                </p>
              ) : null}
            </div>
          ))}
          </div>
        </div>

        <Card className="overflow-hidden border-white/10">
          <CardContent className="space-y-5 p-0">
            <div className="flex flex-col gap-3 border-b border-border/80 px-4 py-4 md:px-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="grid flex-1 gap-3 md:grid-cols-2 lg:grid-cols-[minmax(280px,1fr),220px]">
                <div className="relative">
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search by name or SKU..."
                    className="pr-9"
                  />
                </div>
                <div className="relative">
                  <Filter className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Select
                    value={categoryId}
                    onChange={(event) => setCategoryId(event.target.value)}
                    className="pl-9"
                  >
                    <option value="all">All Categories</option>
                    {sortedCategories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
            </div>

            {isMobileViewport ? (
              <div className="space-y-3 px-4 pb-1 md:hidden">
                {paginatedProducts.length === 0 ? (
                  <div className="rounded-[20px] border border-border/70 bg-card px-4 py-12 text-center text-sm text-muted-foreground">
                    No products match this filter.
                  </div>
                ) : (
                  paginatedProducts.map((product) => (
                    <div
                      key={product.id}
                      className="rounded-[20px] border border-white/10 bg-card p-4"
                      onClick={() => setSelectedProduct(product)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedProduct(product);
                        }
                      }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1 space-y-1">
                          <p className="line-clamp-2 text-base font-medium leading-snug text-foreground">
                            {product.name}
                          </p>
                          <p className="text-xs text-muted-foreground">{product.sku}</p>
                        </div>
                        <div onClick={stopRowClick}>
                          <StockActionMenu
                            product={product}
                            open={openActionMenuId === product.id}
                            onToggle={() =>
                              setOpenActionMenuId((current) =>
                                current === product.id ? null : product.id,
                              )
                            }
                            actionMenuRef={actionMenuRef}
                            onView={() => {
                              setOpenActionMenuId(null);
                              setSelectedProduct(product);
                            }}
                            onEdit={() => openEditStock(product)}
                            onDelete={() => handleDelete(product)}
                            onArchive={() => handleArchive(product)}
                            onHistory={() => handleViewHistory(product)}
                          />
                        </div>
                      </div>

                      <div className="mt-4 space-y-3 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">Category</span>
                          <span className="max-w-[65%] text-right text-foreground">
                            {getCategoryName(product.categoryId, sortedCategories)}
                          </span>
                        </div>
                        <div className="rounded-2xl bg-white/[0.03] px-3 py-3">
                          <p className="text-sm font-medium text-foreground">
                            In Stock: {product.currentStock.warehouse}
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Indira: {product.currentStock.indira} | Mita: {product.currentStock.mita}
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Total: {getProductTotal(product)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : null}

            {!isMobileViewport ? (
            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-full divide-y divide-border text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Image</th>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Indira</th>
                    <th className="px-4 py-3">Mita</th>
                    <th className="px-4 py-3">In Stock</th>
                    <th className="px-4 py-3">Total</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/70">
                  {paginatedProducts.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-16 text-center text-sm text-muted-foreground">
                        No products match this filter.
                      </td>
                    </tr>
                  ) : (
                    paginatedProducts.map((product) => (
                      <tr
                        key={product.id}
                        className="cursor-pointer transition-colors hover:bg-white/[0.02]"
                        onClick={() => setSelectedProduct(product)}
                      >
                        <td className="px-4 py-4">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-white text-xs font-semibold text-black">
                            {product.imageHint}
                          </div>
                        </td>
                        <td className="px-4 py-4 align-top">
                          <div className="space-y-1">
                            <p className="font-medium leading-snug">{product.name}</p>
                            <p className="text-xs text-muted-foreground">{product.sku}</p>
                          </div>
                        </td>
                        <td className="px-4 py-4 align-top text-muted-foreground">
                          {getCategoryName(product.categoryId, sortedCategories)}
                        </td>
                        <td className="px-4 py-4 align-top">
                          {product.currentStock.indira} Total
                        </td>
                        <td className="px-4 py-4 align-top">
                          {product.currentStock.mita} Total
                        </td>
                        <td className="px-4 py-4 align-top">
                          {product.currentStock.warehouse} Total
                        </td>
                        <td className="px-4 py-4 align-top">
                          <div className="space-y-1">
                            <p>{getProductTotal(product)} Total</p>
                          </div>
                        </td>
                        <td className="relative px-4 py-4 align-top" onClick={stopRowClick}>
                          <StockActionMenu
                            product={product}
                            open={openActionMenuId === product.id}
                            onToggle={() =>
                              setOpenActionMenuId((current) =>
                                current === product.id ? null : product.id,
                              )
                            }
                            actionMenuRef={actionMenuRef}
                            onView={() => {
                              setOpenActionMenuId(null);
                              setSelectedProduct(product);
                            }}
                            onEdit={() => openEditStock(product)}
                            onDelete={() => handleDelete(product)}
                            onArchive={() => handleArchive(product)}
                            onHistory={() => handleViewHistory(product)}
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            ) : null}

            <div className="flex flex-col gap-3 border-t border-border/80 px-4 py-4 md:flex-row md:items-center md:justify-between md:px-5">
              <div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center">
                <span>
                  Page {page} of {totalPages}
                </span>
                <Select
                  value={String(preferences.rowsPerPage)}
                  onChange={(event) => setRowsPerPage(Number(event.target.value))}
                  className="h-11 w-full sm:w-[128px]"
                >
                  <option value="10">10 rows</option>
                  <option value="25">25 rows</option>
                  <option value="50">50 rows</option>
                </Select>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={page === 1}
                  className="min-h-11 w-full sm:w-auto"
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  disabled={page === totalPages}
                  className="min-h-11 w-full sm:w-auto"
                >
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <Dialog
        open={Boolean(selectedProduct)}
        onOpenChange={(open) => !open && setSelectedProduct(null)}
        title={selectedProduct?.name ?? "Product details"}
        description={selectedProduct ? `SKU: ${selectedProduct.sku}` : undefined}
        className="border-white/10 bg-[#09090b] md:max-w-4xl"
        headerClassName="border-b-0 px-4 pb-2 pt-5 md:px-6 md:pt-6"
        bodyClassName="px-4 pb-5 pt-1 md:px-6 md:pb-6"
        titleClassName="text-[24px] font-semibold leading-tight tracking-tight md:text-[30px]"
        descriptionClassName="text-sm text-muted-foreground"
      >
        {selectedProduct ? (
          <div className="grid gap-6 md:gap-8 lg:grid-cols-[320px,1fr]">
            <div className="space-y-5">
              <ProductPreview product={selectedProduct} />
              <div className="rounded-[22px] bg-white/[0.03] px-5 py-6">
                <p className="text-center text-xs uppercase tracking-[0.24em] text-muted-foreground">
                  Scan QR Code
                </p>
                <div className="mt-4">
                  <QrCodeMock sku={selectedProduct.sku} />
                </div>
                <p className="mt-4 text-center text-sm text-muted-foreground">
                  {selectedProduct.sku}
                </p>
              </div>
            </div>

            <div className="space-y-7">
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                  Category
                </p>
                <p className="text-2xl font-medium tracking-tight">{detailCategoryName}</p>
              </div>

              <div className="space-y-3">
                <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                  Stock Distribution
                </p>
                <div className="grid gap-3 rounded-[22px] bg-white/[0.03] p-4 sm:grid-cols-3">
                  <div>
                    <p className="text-3xl font-semibold tracking-tight">
                      {getProductTotal(selectedProduct)}
                    </p>
                    <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      In Stock
                    </p>
                  </div>
                  <div>
                    <p className="text-2xl font-medium">{selectedProduct.currentStock.indira}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      Indira
                    </p>
                  </div>
                  <div>
                    <p className="text-2xl font-medium">{selectedProduct.currentStock.mita}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      Mita
                    </p>
                  </div>
                </div>
                <p className="text-right text-sm text-muted-foreground">
                  Total: {getProductTotal(selectedProduct)} pcs
                </p>
              </div>

              <div className="space-y-4 border-t border-border/70 pt-6">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                      Consignment Price (IDR)
                    </p>
                  </div>
                  <p className="text-3xl font-semibold tracking-tight">
                    {formatIdr(detailConsignmentPrice)}
                  </p>
                </div>
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                      Wholesale Price (EUR)
                    </p>
                  </div>
                  <p className="text-2xl font-medium text-muted-foreground">
                    {formatEur(detailWholesalePrice)}
                  </p>
                </div>
              </div>

              <div className="space-y-4 rounded-[22px] bg-white/[0.03] p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                  Wholesale Market Prices
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {detailMarketPrices.map((entry) => (
                    <div
                      key={`${selectedProduct.id}-${entry.currency}`}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <span className="text-muted-foreground">{entry.currency}</span>
                      <span className="font-medium">{entry.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </Dialog>

      <Dialog
        open={isEditModalOpen}
        onOpenChange={(open) => {
          setIsEditModalOpen(open);
          if (!open) {
            setSelectedEditProduct(null);
          }
        }}
        title="Edit Stock Prices"
        description={
          selectedEditProduct
            ? `Update prices for "${selectedEditProduct.name}".`
            : "Update stock prices."
        }
        className="border-white/10 bg-[#09090b] md:max-w-3xl"
        headerClassName="border-b-0 px-4 pb-2 pt-5 md:px-6 md:pt-6"
        bodyClassName="px-4 pb-5 pt-1 md:px-6 md:pb-6"
        titleClassName="text-[24px] font-semibold leading-tight tracking-tight md:text-[30px]"
        descriptionClassName="text-sm text-muted-foreground"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              onClick={() => {
                setIsEditModalOpen(false);
                setSelectedEditProduct(null);
              }}
              className="min-h-11 w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button onClick={submitEditStock} className="min-h-11 w-full sm:w-auto">
              Update Stock
            </Button>
          </div>
        }
      >
        {!selectedEditProduct ? null : (
        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-[18px] border border-border bg-background px-4 py-3">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Wholesale Active
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Show in wholesale
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setEditStockDraft((current) => ({
                      ...current,
                      wholesaleActive: !current.wholesaleActive,
                    }))
                  }
                  className={cn(
                    "relative h-8 w-14 rounded-full transition-colors",
                    editStockDraft.wholesaleActive ? "bg-white/70" : "bg-zinc-700",
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-1 h-6 w-6 rounded-full bg-background transition-transform",
                      editStockDraft.wholesaleActive ? "translate-x-7" : "translate-x-1",
                    )}
                  />
                </button>
              </div>
            </div>
            <div className="rounded-[18px] border border-border bg-background px-4 py-3">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Consignment Active
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Show in consignment
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setEditStockDraft((current) => ({
                      ...current,
                      consignmentActive: !current.consignmentActive,
                    }))
                  }
                  className={cn(
                    "relative h-8 w-14 rounded-full transition-colors",
                    editStockDraft.consignmentActive ? "bg-white/70" : "bg-zinc-700",
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-1 h-6 w-6 rounded-full bg-background transition-transform",
                      editStockDraft.consignmentActive ? "translate-x-7" : "translate-x-1",
                    )}
                  />
                </button>
              </div>
            </div>
          </div>

          <CategorySelectField
            label="Category"
            value={editStockDraft.categoryId}
            categories={sortedCategories}
            onChange={(categoryIdValue) =>
              setEditStockDraft((current) => ({
                ...current,
                categoryId: categoryIdValue,
              }))
            }
            onCreateCategory={createCategory}
            helperText="Can’t find category?"
            onManageCategories={() => setIsManageCategoriesOpen(true)}
          />

          <label className="space-y-2 text-sm">
            <span className="text-foreground">SKU</span>
            <Input
              value={editStockDraft.sku}
              onChange={(event) =>
                setEditStockDraft((current) => ({
                  ...current,
                  sku: event.target.value.toUpperCase(),
                }))
              }
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm">
              <span className="text-foreground">Consignment Price (IDR)</span>
              <Input
                value={editStockDraft.consignmentPrice}
                onChange={(event) =>
                  setEditStockDraft((current) => ({
                    ...current,
                    consignmentPrice: event.target.value,
                  }))
                }
              />
            </label>
            <label className="space-y-2 text-sm">
              <span className="text-foreground">Wholesale Price (EUR)</span>
              <Input
                value={editStockDraft.wholesalePrice}
                onChange={(event) =>
                  setEditStockDraft((current) => ({
                    ...current,
                    wholesalePrice: event.target.value,
                  }))
                }
              />
            </label>
          </div>
        </div>
        )}
      </Dialog>

      <Dialog
        open={isCreateModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeCreateModal();
            return;
          }
          setIsCreateModalOpen(true);
        }}
        title="Create New Stock Item"
        description="Enter the details for the new stock item. Inventory counts start at zero."
        className="border-white/10 bg-[#09090b] md:max-w-3xl"
        headerClassName="border-b-0 px-4 pb-2 pt-5 md:px-6 md:pt-6"
        bodyClassName="px-4 pb-5 pt-1 md:px-6 md:pb-6"
        titleClassName="text-[24px] font-semibold leading-tight tracking-tight md:text-[30px]"
        descriptionClassName="text-sm text-muted-foreground"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={closeCreateModal} className="min-h-11 w-full sm:w-auto">
              Cancel
            </Button>
            <Button
              onClick={submitAddProduct}
              disabled={
                !createStockDraft.name ||
                !createStockDraft.sku ||
                !createStockDraft.categoryId
              }
              className="min-h-11 w-full sm:w-auto"
            >
              Create Stock Item
            </Button>
          </div>
        }
      >
        <div className="space-y-5">
          <label className="space-y-2 text-sm">
            <span className="text-foreground">Product Name</span>
            <Input
              value={createStockDraft.name}
              onChange={(event) =>
                setCreateStockDraft((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
            />
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm">
              <span className="text-foreground">SKU</span>
              <Input
                value={createStockDraft.sku}
                onChange={(event) =>
                  setCreateStockDraft((current) => ({
                    ...current,
                    sku: event.target.value.toUpperCase(),
                  }))
                }
              />
            </label>
            <CategorySelectField
              label="Category *"
              value={createStockDraft.categoryId}
              categories={sortedCategories}
              onChange={(categoryIdValue) =>
                setCreateStockDraft((current) => ({
                  ...current,
                  categoryId: categoryIdValue,
                }))
              }
              onCreateCategory={createCategory}
              helperText="Can’t find category?"
              onManageCategories={() => setIsManageCategoriesOpen(true)}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm">
              <span className="text-foreground">Retail Price (IDR)</span>
              <Input
                value={createStockDraft.consignmentPrice}
                onChange={(event) =>
                  setCreateStockDraft((current) => ({
                    ...current,
                    consignmentPrice: event.target.value,
                  }))
                }
              />
            </label>
            <label className="space-y-2 text-sm">
              <span className="text-foreground">Wholesale Price (EUR)</span>
              <Input
                value={createStockDraft.wholesalePrice}
                onChange={(event) =>
                  setCreateStockDraft((current) => ({
                    ...current,
                    wholesalePrice: event.target.value,
                  }))
                }
              />
            </label>
          </div>
        </div>
      </Dialog>

      <ManageCategoriesDialog
        open={isManageCategoriesOpen}
        onOpenChange={setIsManageCategoriesOpen}
      />
    </MasterStockShell>
  );
}
