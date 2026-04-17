"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Database, LayoutGrid, Package2, Workflow } from "lucide-react";

import { Select } from "@/components/ui/select";
import { useMasterStock } from "@/lib/master-stock-context";
import type { UserRole } from "@/lib/types";
import { titleCase } from "@/lib/utils";

const navItems = [
  { label: "O-FORM", href: "#", icon: LayoutGrid },
  { label: "O-FLOW", href: "#", icon: Workflow },
  { label: "O-SIGNIA", href: "#", icon: Package2 },
  { label: "O-TIME", href: "#", icon: Database },
];

export function MasterStockShell({
  currentPath,
  children,
}: {
  currentPath: "overview" | "plans" | "batches";
  children: ReactNode;
}) {
  const { currentUserRole, setCurrentUserRole } = useMasterStock();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="absolute inset-0 -z-10 bg-grid-dark bg-[size:72px_72px] opacity-[0.035]" />
      <header className="border-b border-border/90 bg-background/94 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-4 px-4 py-4 md:px-6">
          <div className="flex min-w-0 items-center gap-4 md:gap-8">
            <Link href="/master-stock" className="text-base font-semibold tracking-[0.2em] text-white/90">
              O-SHE
            </Link>
            <nav className="hidden items-center gap-1 lg:flex">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <a
                    key={item.label}
                    href={item.href}
                    className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {item.label}
                  </a>
                );
              })}
              <span className="mx-2 h-5 w-px bg-border/80" />
              <Link
                href="/master-stock"
                className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs uppercase tracking-[0.14em] text-foreground"
              >
                Master Data
                <span className="text-[10px] text-muted-foreground">stocks</span>
              </Link>
            </nav>
          </div>
          <div className="flex w-full items-center gap-3 sm:w-auto">
            <Select
              aria-label="Current role"
              value={currentUserRole}
              onChange={(event) => setCurrentUserRole(event.target.value as UserRole)}
              className="h-11 w-full rounded-full border-border bg-secondary text-xs uppercase tracking-[0.14em] sm:w-[170px]"
            >
              <option value="owner">Owner</option>
              <option value="admin">Admin</option>
              <option value="production_lead">Production Lead</option>
              <option value="production">Production</option>
            </Select>
            <div className="hidden rounded-full border border-border bg-secondary px-3 py-2 text-xs uppercase tracking-[0.14em] text-muted-foreground md:block">
              {titleCase(currentUserRole)}
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-sm font-semibold uppercase text-foreground">
              hs
            </div>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1400px] px-4 py-6 md:px-6 md:py-10">
        <div className="sticky top-0 z-30 -mx-4 mb-6 border-b border-white/5 bg-background/95 px-4 pb-3 pt-2 backdrop-blur md:-mx-6 md:px-6">
          <div className="inline-flex w-fit max-w-full gap-2 overflow-x-auto rounded-full border border-border bg-secondary p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <Link
              href="/master-stock"
              className={
                currentPath === "overview"
                  ? "whitespace-nowrap rounded-full bg-accent px-4 py-2.5 text-sm text-foreground"
                  : "whitespace-nowrap rounded-full px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
              }
            >
              Overview
            </Link>
            <Link
              href="/master-stock/plans"
              className={
                currentPath === "plans"
                  ? "whitespace-nowrap rounded-full bg-accent px-4 py-2.5 text-sm text-foreground"
                  : "whitespace-nowrap rounded-full px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
              }
            >
              Production Plans
            </Link>
            <Link
              href="/master-stock/batches"
              className={
                currentPath === "batches"
                  ? "whitespace-nowrap rounded-full bg-accent px-4 py-2.5 text-sm text-foreground"
                  : "whitespace-nowrap rounded-full px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
              }
            >
              Batches
            </Link>
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}
