"use client";

import type { ReactNode } from "react";

import { ToastViewport } from "@/components/ui/toast";
import { MasterStockProvider } from "@/lib/master-stock-context";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <MasterStockProvider>
      {children}
      <ToastViewport />
    </MasterStockProvider>
  );
}
