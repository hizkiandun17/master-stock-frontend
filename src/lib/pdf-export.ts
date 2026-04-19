"use client";

import { getCategoryName } from "@/lib/stock-helpers";
import type {
  Category,
  Product,
  ProductionPlan,
  ProductionPlanSource,
  StockLocationKey,
} from "@/lib/types";
import { formatNumber, titleCase } from "@/lib/utils";

type PdfColumnKey = "no" | "product" | "inStock" | "indira" | "mita" | "total";

interface PdfRow {
  [key: string]: string | boolean;
  no: string;
  product: string;
  inStock: string;
  indira: string;
  mita: string;
  total: string;
  lowStock: boolean;
  updatedSource: boolean;
  updatedTotal: boolean;
}

interface PdfSection {
  title: string;
  total: number;
  rows: PdfRow[];
}

export interface MasterStockPdfModel {
  generatedOn: string;
  totalSkus: number;
  totalStock: number;
  mode: "actual" | "production-plan" | "dispatch-batch";
  source?: ProductionPlanSource;
  sections: PdfSection[];
}

interface BuildMasterStockPdfModelOptions {
  products: Product[];
  categories: Category[];
  mode?: "actual" | "production-plan" | "dispatch-batch";
  source?: ProductionPlanSource;
  productionPlans?: ProductionPlan[];
}

interface ExportMasterStockPdfOptions extends BuildMasterStockPdfModelOptions {
  fileName?: string;
}

interface ExportSingleProductionPlanPdfOptions {
  plan: ProductionPlan;
  products: Product[];
  categories: Category[];
  fileName?: string;
}

function getActualTotal(product: Product) {
  return (
    product.currentStock.indira +
    product.currentStock.mita +
    product.currentStock.warehouse
  );
}

function getPlanQuantitiesBySource(
  productionPlans: ProductionPlan[],
  source: ProductionPlanSource,
) {
  return productionPlans
    .filter((plan) => plan.source === source)
    .reduce<Record<string, number>>((accumulator, plan) => {
      for (const item of plan.items) {
        accumulator[item.productId] = (accumulator[item.productId] ?? 0) + item.quantity;
      }

      return accumulator;
    }, {});
}

function getDisplayStocks(
  product: Product,
  mode: "actual" | "production-plan" | "dispatch-batch",
  source: ProductionPlanSource | undefined,
  planQuantities: Record<string, number>,
) {
  const actual = product.currentStock;
  const updatedValue =
    mode !== "actual" && source ? planQuantities[product.id] : undefined;
  const sourceKey = source as StockLocationKey | undefined;
  const sourceWasUpdated = typeof updatedValue === "number" && sourceKey !== undefined;

  const displayStock = {
    indira:
      sourceWasUpdated && sourceKey === "indira" ? updatedValue : actual.indira,
    mita: sourceWasUpdated && sourceKey === "mita" ? updatedValue : actual.mita,
    warehouse: actual.warehouse,
  };

  return {
    displayStock,
    sourceWasUpdated,
    total:
      displayStock.indira + displayStock.mita + displayStock.warehouse,
  };
}

export function buildMasterStockPdfModel({
  products,
  categories,
  mode = "actual",
  source,
  productionPlans = [],
}: BuildMasterStockPdfModelOptions): MasterStockPdfModel {
  const sortedCategories = [...categories].sort((a, b) => a.order - b.order);
  const sourcePlanQuantities =
    mode !== "actual" && source
      ? getPlanQuantitiesBySource(productionPlans, source)
      : {};

  const sections = sortedCategories
    .map((category) => {
      const categoryProducts = products
        .filter((product) => product.categoryId === category.id)
        .sort((left, right) => left.name.localeCompare(right.name));

      if (categoryProducts.length === 0) {
        return null;
      }

      const rows = categoryProducts.map((product, index) => {
        const { displayStock, sourceWasUpdated, total } = getDisplayStocks(
          product,
          mode,
          source,
          sourcePlanQuantities,
        );
        const actualTotal = getActualTotal(product);

        return {
          no: String(index + 1),
          product: `${product.name}\n${product.sku}`,
          inStock: String(displayStock.warehouse),
          indira: String(displayStock.indira),
          mita: String(displayStock.mita),
          total: String(total),
          lowStock: total <= 3,
          updatedSource: sourceWasUpdated,
          updatedTotal: sourceWasUpdated && total !== actualTotal,
        };
      });

      return {
        title: getCategoryName(category.id, sortedCategories),
        total: rows.reduce((sum, row) => sum + Number(row.total), 0),
        rows,
      };
    })
    .filter((section): section is PdfSection => section !== null);

  return {
    generatedOn: new Date().toISOString().slice(0, 10),
    totalSkus: products.length,
    totalStock: sections.reduce((sum, section) => sum + section.total, 0),
    mode,
    source,
    sections,
  };
}

export async function exportMasterStockPdf(options: ExportMasterStockPdfOptions) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const model = buildMasterStockPdfModel(options);
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 56;
  let cursorY = 72;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.setTextColor(39, 39, 42);
  doc.text("SAMAPURA JEWELRY", marginX, cursorY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(15);
  doc.setTextColor(82, 82, 91);
  doc.text("STOCK MASTER LIST", marginX, cursorY + 24);

  doc.setFontSize(10.5);
  doc.setTextColor(63, 63, 70);
  const headerLines = [
    `Generated On: ${model.generatedOn}`,
    `Total SKUs: ${formatNumber(model.totalSkus)}`,
    `Total Stock: ${formatNumber(model.totalStock)} pcs`,
  ];

  if (model.mode !== "actual" && model.source) {
    headerLines.push(model.mode === "dispatch-batch" ? "Mode: Dispatch Batch" : "Mode: Production Plan");
    headerLines.push(`Source: ${titleCase(model.source)}`);
  }

  headerLines.forEach((line, index) => {
    doc.text(line, pageWidth - marginX, cursorY + index * 16, { align: "right" });
  });

  cursorY += model.mode !== "actual" ? 92 : 76;

  const sourceColumn = model.source as PdfColumnKey | undefined;

  for (const section of model.sections) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12.5);
    doc.setTextColor(39, 39, 42);
    doc.text(
      `${section.title} (${formatNumber(section.total)} pcs)`,
      marginX,
      cursorY,
    );

    autoTable(doc, {
      startY: cursorY + 14,
      margin: { left: marginX, right: marginX },
      tableWidth: pageWidth - marginX * 2,
      theme: "grid",
      head: [["No.", "Product", "In Stock", "Indira", "Mita", "Total"]],
      body: section.rows,
      columns: [
        { header: "No.", dataKey: "no" },
        { header: "Product", dataKey: "product" },
        { header: "In Stock", dataKey: "inStock" },
        { header: "Indira", dataKey: "indira" },
        { header: "Mita", dataKey: "mita" },
        { header: "Total", dataKey: "total" },
      ],
      styles: {
        font: "helvetica",
        fontSize: 10,
        cellPadding: { top: 10, right: 10, bottom: 10, left: 10 },
        lineColor: [228, 228, 231],
        lineWidth: 0.8,
        textColor: [24, 24, 27],
        valign: "middle",
      },
      headStyles: {
        fillColor: [248, 250, 252],
        textColor: [82, 82, 91],
        fontStyle: "bold",
      },
      columnStyles: {
        no: { cellWidth: 32, halign: "center" },
        product: { cellWidth: 240 },
        inStock: { cellWidth: 70, halign: "left" },
        indira: { cellWidth: 64, halign: "left" },
        mita: { cellWidth: 64, halign: "left" },
        total: { cellWidth: 64, halign: "left", fontStyle: "bold" },
      },
      didParseCell: (hookData) => {
        if (hookData.section !== "body") {
          return;
        }

        const row = hookData.row.raw as PdfRow;
        const key = hookData.column.dataKey as PdfColumnKey;

        if (row.lowStock) {
          hookData.cell.styles.fillColor = [254, 249, 195];
        }

        const isUpdatedSourceCell =
          sourceColumn !== undefined && row.updatedSource && key === sourceColumn;
        const isUpdatedTotalCell = row.updatedTotal && key === "total";

        if (isUpdatedSourceCell || isUpdatedTotalCell) {
          hookData.cell.styles.fillColor = [230, 240, 255];
          hookData.cell.styles.textColor = [29, 78, 216];
          hookData.cell.styles.fontStyle = "bold";
        }
      },
    });

    const docWithTable = doc as typeof doc & { lastAutoTable?: { finalY?: number } };
    cursorY = docWithTable.lastAutoTable?.finalY
      ? (docWithTable.lastAutoTable.finalY ?? cursorY) + 28
      : cursorY + 120;
  }

  if (model.sections.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.setTextColor(82, 82, 91);
    doc.text("No products available in the current view.", marginX, cursorY);
  }

  const defaultFileName =
    model.mode === "production-plan"
      ? `OSHE_Samapura-Production-Stock_${model.generatedOn}.pdf`
      : model.mode === "dispatch-batch"
        ? `OSHE_Samapura-Dispatch-Batch_${model.generatedOn}.pdf`
      : `OSHE_Samapura-Stock-Master_${model.generatedOn}.pdf`;

  doc.save(options.fileName ?? defaultFileName);
}

export async function exportSingleProductionPlanPdf({
  plan,
  products,
  categories,
  fileName,
}: ExportSingleProductionPlanPdfOptions) {
  if (plan.status !== "completed") {
    return;
  }

  const productIds = new Set(plan.items.map((item) => item.productId));
  const planProducts = products.filter((product) => productIds.has(product.id));

  return exportMasterStockPdf({
    products: planProducts,
    categories,
    mode: "dispatch-batch",
    source: plan.source,
    productionPlans: [plan],
    fileName:
      fileName ??
      `OSHE_Samapura-Dispatch-Batch-${plan.source}-${new Date(plan.createdAt)
        .toISOString()
        .slice(0, 10)}.pdf`,
  });
}
