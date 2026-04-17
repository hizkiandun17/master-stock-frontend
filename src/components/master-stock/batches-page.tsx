"use client";

import { useRouter } from "next/navigation";
import { FilePlus2, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import { MasterStockShell } from "@/components/master-stock/shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { useMasterStock } from "@/lib/master-stock-context";
import { getBatchStatusLabel, getBatchTotals } from "@/lib/stock-helpers";
import type { ProductionBatch } from "@/lib/types";
import { cn, formatDate, titleCase } from "@/lib/utils";

function getBatchName(batch: ProductionBatch) {
  return batch.name?.trim() || `${titleCase(batch.source || "")} Batch`;
}

function getStatusClassName(status: ProductionBatch["status"]) {
  if (status === "completed") {
    return "bg-white text-black";
  }

  if (status === "in_progress") {
    return "border border-warning/30 text-warning";
  }

  return "border border-white/10 text-muted-foreground";
}

export function BatchesPage() {
  const router = useRouter();
  const { batches, deleteBatch } = useMasterStock();
  const [batchToDelete, setBatchToDelete] = useState<string | null>(null);

  const sortedBatches = useMemo(
    () =>
      batches
        .slice()
        .sort(
          (left, right) =>
            new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime(),
        ),
    [batches],
  );

  function confirmDelete() {
    if (!batchToDelete) return;
    deleteBatch(batchToDelete);
    setBatchToDelete(null);
  }

  return (
    <MasterStockShell currentPath="batches">
      <section className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Batches</h1>
            <p className="max-w-2xl text-sm text-muted-foreground md:text-base">
              Track incoming stock from production.
            </p>
          </div>

          <Button
            onClick={() => router.push("/master-stock/batches/new")}
            className="min-h-12 w-full sm:w-auto"
          >
            <FilePlus2 className="mr-2 h-4 w-4" />
            Create Batch
          </Button>
        </div>

        {sortedBatches.length === 0 ? (
          <Card className="border-white/10">
            <CardContent className="px-5 py-12 text-center">
              <h2 className="text-lg font-semibold text-foreground">No batches yet</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Create a batch to track what production planned and what actually arrived.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {sortedBatches.map((batch) => {
              const totals = getBatchTotals(batch);
              const sourceLabel = titleCase(batch.source || "") || "-";
              const createdLabel = batch.createdAt
                ? `Created ${formatDate(batch.createdAt)}`
                : "Created -";
              const itemCount = Array.isArray(batch.items) ? batch.items.length : 0;

              return (
                <div
                  key={batch.id}
                  onClick={() => router.push(`/master-stock/batches/${batch.id}`)}
                  className="group rounded-[20px] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      router.push(`/master-stock/batches/${batch.id}`);
                    }
                  }}
                >
                  <Card className="border-white/10 transition-colors group-hover:border-white/20">
                    <CardContent className="space-y-4 p-4 md:p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-2">
                          <p className="text-base font-semibold text-foreground">
                            {getBatchName(batch)}
                          </p>
                          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                            {sourceLabel}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "rounded-full px-2.5 py-1 text-[11px] uppercase tracking-[0.18em]",
                              getStatusClassName(batch.status),
                            )}
                          >
                            {getBatchStatusLabel(batch.status)}
                          </span>
                          {batch.status === "draft" ? (
                            <button
                              type="button"
                              aria-label={`Delete ${getBatchName(batch)}`}
                              onClick={(event) => {
                                event.stopPropagation();
                                setBatchToDelete(batch.id);
                              }}
                              className="rounded-full p-2.5 text-muted-foreground opacity-100 transition hover:bg-accent hover:text-foreground md:opacity-0 md:group-hover:opacity-100"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          ) : null}
                        </div>
                      </div>

                      <div className="space-y-2 text-sm text-muted-foreground">
                        <p>
                          {totals.planned} pcs • {itemCount} item
                          {itemCount === 1 ? "" : "s"}
                        </p>
                        <p>{createdLabel}</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <Dialog
        open={batchToDelete !== null}
        onOpenChange={(open) => {
          if (!open) {
            setBatchToDelete(null);
          }
        }}
        title="Delete batch?"
        description="This will permanently remove the selected draft batch."
        className="border-white/10 bg-[#09090b] md:max-w-md"
        headerClassName="border-b-0 px-4 pb-2 pt-5 md:px-6 md:pt-6"
        bodyClassName="hidden"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              onClick={() => setBatchToDelete(null)}
              className="min-h-11 w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={confirmDelete}
              className="min-h-11 w-full sm:w-auto"
            >
              Delete Batch
            </Button>
          </div>
        }
      >
        {null}
      </Dialog>
    </MasterStockShell>
  );
}
