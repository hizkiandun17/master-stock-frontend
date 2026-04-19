"use client";

import { useRouter } from "next/navigation";
import { FilePlus2, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import { CreateProductionPlanDialog } from "@/components/master-stock/create-production-plan-dialog";
import { MasterStockShell } from "@/components/master-stock/shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { useMasterStock } from "@/lib/master-stock-context";
import { cn, formatDate, titleCase } from "@/lib/utils";

function getStatusClassName(status: "draft" | "completed") {
  return status === "completed"
    ? "bg-white text-black"
    : "border border-white/10 text-muted-foreground";
}

export function ProductionPlansPage() {
  const router = useRouter();
  const { productionPlans, deleteProductionPlan, currentUserRole } = useMasterStock();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [planToDelete, setPlanToDelete] = useState<string | null>(null);

  const sortedPlans = useMemo(
    () =>
      productionPlans
        .slice()
        .sort(
          (left, right) =>
            new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
        ),
    [productionPlans],
  );

  function confirmDelete() {
    if (!planToDelete) return;
    deleteProductionPlan(planToDelete);
    setPlanToDelete(null);
  }

  return (
    <MasterStockShell currentPath="dispatch">
      {currentUserRole === "production" ? (
        <section className="space-y-4">
          <Card className="border-white/10">
            <CardContent className="px-5 py-12">
              <h1 className="text-xl font-semibold text-foreground">Batches are internal-only</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Craftsman users work in Production Batch. Dispatch stays with the internal team only.
              </p>
            </CardContent>
          </Card>
        </section>
      ) : (
      <section className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Dispatch</h1>
            <p className="max-w-2xl text-sm text-muted-foreground md:text-base">
              What production sends out, with owner visibility and export-ready outgoing records.
            </p>
          </div>

          <Button onClick={() => setIsCreateOpen(true)} className="min-h-12 w-full sm:w-auto">
            <FilePlus2 className="mr-2 h-4 w-4" />
            Create Dispatch
          </Button>
        </div>

        {sortedPlans.length === 0 ? (
          <Card className="border-white/10">
            <CardContent className="px-5 py-12 text-center">
              <h2 className="text-lg font-semibold text-foreground">No dispatch records yet</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Create a dispatch record to prepare what production is sending out next.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {sortedPlans.map((plan) => {
              const totalQuantity = plan.items.reduce((sum, item) => sum + item.quantity, 0);
              const sourceLabel = titleCase(plan.source) || "-";
              const createdLabel = plan.createdAt ? `Created ${formatDate(plan.createdAt)}` : "Created -";

              return (
                <div
                  key={plan.id}
                  onClick={() => router.push(`/master-stock/batches/${plan.id}`)}
                  className="group rounded-[20px] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      router.push(`/master-stock/batches/${plan.id}`);
                    }
                  }}
                >
                  <Card className="border-white/10 transition-colors group-hover:border-white/20">
                    <CardContent className="space-y-4 p-4 md:p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-2">
                          <p className="text-base font-semibold text-foreground">{plan.name}</p>
                          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                            {sourceLabel}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "rounded-full px-2.5 py-1 text-[11px] uppercase tracking-[0.18em]",
                              getStatusClassName(plan.status),
                            )}
                          >
                            {titleCase(plan.status)}
                          </span>
                        <button
                          type="button"
                          aria-label={`Delete ${plan.name}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            setPlanToDelete(plan.id);
                          }}
                          className="rounded-full p-2.5 text-muted-foreground opacity-100 transition hover:bg-accent hover:text-foreground md:opacity-0 md:group-hover:opacity-100"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                        </div>
                      </div>

                      <div className="space-y-2 text-sm text-muted-foreground">
                        <p>
                          {totalQuantity} pcs • {plan.items.length} item
                          {plan.items.length === 1 ? "" : "s"}
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
      )}

      <CreateProductionPlanDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onCreated={(planId) => router.push(`/master-stock/batches/${planId}`)}
      />

      <Dialog
        open={planToDelete !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPlanToDelete(null);
          }
        }}
        title="Delete dispatch?"
        description="This will permanently remove the selected dispatch record."
        className="border-white/10 bg-[#09090b] md:max-w-md"
        headerClassName="border-b-0 px-4 pb-2 pt-5 md:px-6 md:pt-6"
        bodyClassName="hidden"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              onClick={() => setPlanToDelete(null)}
              className="min-h-11 w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={confirmDelete}
              className="min-h-11 w-full sm:w-auto"
            >
              Delete Dispatch
            </Button>
          </div>
        }
      >
        {null}
      </Dialog>
    </MasterStockShell>
  );
}
