"use client";

import { CheckCircle2, CircleAlert, Info, TriangleAlert, X } from "lucide-react";

import { useMasterStock } from "@/lib/master-stock-context";
import { cn } from "@/lib/utils";

const variantStyles = {
  default: "border-border bg-card text-foreground",
  success: "border-success/30 bg-success/10 text-foreground",
  warning: "border-warning/30 bg-warning/10 text-foreground",
  danger: "border-danger/30 bg-danger/10 text-foreground",
};

const iconMap = {
  default: Info,
  success: CheckCircle2,
  warning: TriangleAlert,
  danger: CircleAlert,
};

export function ToastViewport() {
  const { dismissToast, toasts } = useMasterStock();

  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[60] flex w-full max-w-sm flex-col gap-3">
      {toasts.map((toast) => {
        const Icon = iconMap[toast.variant ?? "default"];
        return (
          <div
            key={toast.id}
            className={cn(
              "pointer-events-auto rounded-2xl border p-4 shadow-panel backdrop-blur",
              variantStyles[toast.variant ?? "default"],
            )}
          >
            <div className="flex items-start gap-3">
              <Icon className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium">{toast.title}</p>
                {toast.description ? (
                  <p className="text-sm text-muted-foreground">{toast.description}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
