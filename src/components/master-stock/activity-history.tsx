"use client";

import {
  Check,
  ChevronDown,
  FilePlus2,
  Minus,
  PencilLine,
  Plus,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { ActivityEntry } from "@/lib/types";
import { cn, formatDate, formatDateTime } from "@/lib/utils";

interface ActivityHistoryProps {
  entries?: ActivityEntry[];
  emptyText?: string;
  description?: string;
}

function getEntryPresentation(kind: ActivityEntry["kind"]): {
  icon: LucideIcon;
  iconClassName: string;
} {
  switch (kind) {
    case "added":
      return {
        icon: Plus,
        iconClassName: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
      };
    case "removed":
      return {
        icon: Minus,
        iconClassName: "border-rose-500/30 bg-rose-500/10 text-rose-400",
      };
    case "created":
      return {
        icon: FilePlus2,
        iconClassName: "border-white/10 bg-white/[0.04] text-muted-foreground",
      };
    case "completed":
      return {
        icon: Check,
        iconClassName: "border-white/10 bg-white/[0.04] text-foreground",
      };
    default:
      return {
        icon: PencilLine,
        iconClassName: "border-white/10 bg-white/[0.04] text-muted-foreground",
      };
  }
}

export function ActivityHistory({
  entries = [],
  emptyText = "No activity recorded yet.",
  description = "Lightweight record of what happened here.",
}: ActivityHistoryProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const groupedEntries = useMemo(
    () =>
      entries
        .slice()
        .sort(
          (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
        )
        .reduce<Array<{ dateLabel: string; items: ActivityEntry[] }>>((groups, entry) => {
          const dateLabel = formatDate(entry.createdAt);
          const currentGroup = groups[groups.length - 1];

          if (currentGroup?.dateLabel === dateLabel) {
            currentGroup.items.push(entry);
            return groups;
          }

          groups.push({ dateLabel, items: [entry] });
          return groups;
        }, []),
    [entries],
  );
  const totalEntries = entries.length;

  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-sm font-medium text-foreground">Activity History</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => setIsExpanded((current) => !current)}
          className="min-h-11 w-full justify-between sm:w-auto"
          aria-expanded={isExpanded}
        >
          {isExpanded ? "Hide Activity" : "Show Activity"}
          <span className="ml-3 inline-flex items-center gap-2 text-xs text-muted-foreground">
            {totalEntries}
            <ChevronDown
              className={cn("h-4 w-4 transition-transform", isExpanded ? "rotate-180" : "")}
            />
          </span>
        </Button>
      </div>

      {!isExpanded ? null : groupedEntries.length === 0 ? (
        <Card className="border-white/10">
          <CardContent className="px-4 py-4 text-sm text-muted-foreground md:px-5">
            {emptyText}
          </CardContent>
        </Card>
      ) : (
        <Card className="border-white/10">
          <CardContent className="space-y-6 p-4 md:p-5">
            {groupedEntries.map((group) => (
              <div key={group.dateLabel} className="space-y-4">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  {group.dateLabel}
                </p>

                <div className="space-y-0">
                  {group.items.map((entry, index) => {
                    const { icon: Icon, iconClassName } = getEntryPresentation(entry.kind);

                    return (
                      <div
                        key={entry.id}
                        className={cn(
                          "grid grid-cols-[2rem_minmax(0,1fr)] gap-3 pb-4",
                          index !== group.items.length - 1 ? "border-b border-white/5" : "",
                        )}
                      >
                        <div className="relative flex justify-center">
                          <span
                            className={cn(
                              "relative z-10 flex h-8 w-8 items-center justify-center rounded-full border",
                              iconClassName,
                            )}
                          >
                            <Icon className="h-4 w-4" />
                          </span>
                          {index !== group.items.length - 1 ? (
                            <span className="absolute top-8 h-[calc(100%+0.25rem)] w-px bg-white/10" />
                          ) : null}
                        </div>

                        <div className="space-y-1 pb-4">
                          <p className="text-sm font-medium text-foreground">{entry.title}</p>
                          {entry.detail ? (
                            <p className="text-sm text-muted-foreground">{entry.detail}</p>
                          ) : null}
                          <p className="text-xs text-muted-foreground">
                            {entry.actor || "Unknown"} • {formatDateTime(entry.createdAt)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </section>
  );
}
