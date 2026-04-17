"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useMasterStock } from "@/lib/master-stock-context";
import type { ProductionPlanSource } from "@/lib/types";

interface CreateProductionPlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (planId: string) => void;
}

export function CreateProductionPlanDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateProductionPlanDialogProps) {
  const { createProductionPlan } = useMasterStock();
  const [name, setName] = useState("");
  const [source, setSource] = useState<ProductionPlanSource | "">("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) {
      setName("");
      setSource("");
      setNotes("");
    }
  }, [open]);

  function handleSave() {
    if (!name.trim() || !source) return;

    const plan = createProductionPlan({
      name,
      source,
      notes,
      items: [],
    });

    onOpenChange(false);
    onCreated?.(plan.id);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Create New Plan"
      description="Plan incoming stock without affecting real inventory."
      className="border-white/10 bg-[#09090b] md:max-w-xl"
      headerClassName="border-b-0 px-4 pb-2 pt-5 md:px-6 md:pt-6"
      bodyClassName="px-4 pb-5 pt-1 md:px-6 md:pb-6"
      titleClassName="text-[24px] font-semibold leading-tight tracking-tight md:text-[30px]"
      descriptionClassName="text-sm text-muted-foreground"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="min-h-11 w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!name.trim() || !source}
            className="min-h-11 w-full sm:w-auto"
          >
            Create Plan
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        <label className="space-y-2 text-sm">
          <span className="text-foreground">Plan Name</span>
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Indira Restock Week 3"
            className="h-11"
          />
        </label>

        <label className="space-y-2 text-sm">
          <span className="text-foreground">Source</span>
          <Select
            value={source}
            onChange={(event) => setSource(event.target.value as ProductionPlanSource)}
            className="h-11"
          >
            <option value="">Select source</option>
            <option value="indira">Indira</option>
            <option value="mita">Mita</option>
          </Select>
        </label>

        <label className="space-y-2 text-sm">
          <span className="text-foreground">Notes</span>
          <Textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Optional notes for the production team"
            className="min-h-[120px]"
          />
        </label>
      </div>
    </Dialog>
  );
}
