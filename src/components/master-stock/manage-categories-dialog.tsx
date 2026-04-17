"use client";

import {
  ArrowDown,
  ArrowUp,
  GripVertical,
  MoreHorizontal,
  PencilLine,
  Plus,
  Trash2,
} from "lucide-react";
import { useMemo, useState, type DragEvent } from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMasterStock } from "@/lib/master-stock-context";
import type { Category } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ManageCategoriesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ManageCategoriesDialog({
  open,
  onOpenChange,
}: ManageCategoriesDialogProps) {
  const {
    categories,
    createCategory,
    renameCategory,
    reorderCategory,
    moveCategory,
    removeCategory,
  } = useMasterStock();
  const [isAdding, setIsAdding] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [error, setError] = useState("");
  const [draggingCategoryId, setDraggingCategoryId] = useState<string | null>(null);
  const [dragOverCategoryId, setDragOverCategoryId] = useState<string | null>(null);
  const [dragPosition, setDragPosition] = useState<"before" | "after" | null>(null);

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.order - b.order),
    [categories],
  );

  function resetTransientState() {
    setIsAdding(false);
    setNewCategoryName("");
    setEditingCategoryId(null);
    setEditingName("");
    setError("");
    setDraggingCategoryId(null);
    setDragOverCategoryId(null);
    setDragPosition(null);
  }

  function handleCreateCategory() {
    const result = createCategory(newCategoryName);

    if (!result.ok) {
      setError(result.error ?? "Unable to create category.");
      return;
    }

    setIsAdding(false);
    setNewCategoryName("");
    setError("");
  }

  function handleRenameCategory() {
    if (!editingCategoryId) return;

    const result = renameCategory(editingCategoryId, editingName);

    if (!result.ok) {
      setError(result.error ?? "Unable to rename category.");
      return;
    }

    setEditingCategoryId(null);
    setEditingName("");
    setError("");
  }

  function startRename(category: Category) {
    setEditingCategoryId(category.id);
    setEditingName(category.name);
    setError("");
  }

  function handleDeleteCategory(categoryId: string) {
    const result = removeCategory(categoryId);
    if (!result.ok) {
      setError(result.error ?? "Unable to delete category.");
    } else {
      setError("");
    }
  }

  function handleDragStart(categoryId: string) {
    setDraggingCategoryId(categoryId);
    setDragOverCategoryId(null);
    setDragPosition(null);
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>, categoryId: string) {
    if (!draggingCategoryId || draggingCategoryId === categoryId) return;

    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const nextPosition = event.clientY < rect.top + rect.height / 2 ? "before" : "after";

    setDragOverCategoryId(categoryId);
    setDragPosition(nextPosition);
  }

  function handleDrop(categoryId: string) {
    if (!draggingCategoryId || draggingCategoryId === categoryId || !dragPosition) {
      setDraggingCategoryId(null);
      setDragOverCategoryId(null);
      setDragPosition(null);
      return;
    }

    reorderCategory(draggingCategoryId, categoryId, dragPosition);
    setDraggingCategoryId(null);
    setDragOverCategoryId(null);
    setDragPosition(null);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) {
          resetTransientState();
        }
      }}
      title="Manage Categories"
      description="Organize and manage your product collections"
      className="border-white/10 bg-[#09090b] md:max-w-3xl"
      headerClassName="border-b-0 px-4 pb-2 pt-5 md:px-6 md:pt-6"
      bodyClassName="px-4 pb-5 pt-1 md:px-6 md:pb-6"
      titleClassName="text-[24px] font-semibold leading-tight tracking-tight md:text-[30px]"
      descriptionClassName="text-sm text-muted-foreground"
      footer={
        <div className="flex justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="min-h-11 w-full sm:w-auto">
            Close
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setIsAdding(true);
              setEditingCategoryId(null);
              setError("");
            }}
            className="min-h-11 w-full sm:w-auto"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add New Category
          </Button>
          <p className="text-sm text-muted-foreground">
            Reordering is only available in this modal.
          </p>
        </div>

        {isAdding ? (
          <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
            <Input
              value={newCategoryName}
              onChange={(event) => {
                setNewCategoryName(event.target.value);
                if (error) setError("");
              }}
              placeholder="Enter category name"
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleCreateCategory();
                }
              }}
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setIsAdding(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleCreateCategory}>
                Create
              </Button>
            </div>
          </div>
        ) : null}

        {error ? <p className="text-sm text-danger">{error}</p> : null}

        <div className="space-y-2">
          {sortedCategories.map((category, index) => {
            const isEditing = editingCategoryId === category.id;
            const showBeforeIndicator =
              dragOverCategoryId === category.id && dragPosition === "before";
            const showAfterIndicator =
              dragOverCategoryId === category.id && dragPosition === "after";

            return (
              <div
                key={category.id}
                className={cn(
                  "rounded-2xl border border-white/10 bg-white/[0.02] p-3 transition-all",
                  draggingCategoryId === category.id && "opacity-60 shadow-[0_16px_50px_rgba(0,0,0,0.35)]",
                  showBeforeIndicator && "border-t-2 border-t-white",
                  showAfterIndicator && "border-b-2 border-b-white",
                )}
                onDragOver={(event) => handleDragOver(event, category.id)}
                onDrop={() => handleDrop(category.id)}
                onDragEnd={() => {
                  setDraggingCategoryId(null);
                  setDragOverCategoryId(null);
                  setDragPosition(null);
                }}
              >
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    draggable
                    aria-label={`Drag ${category.name}`}
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-muted-foreground transition-colors hover:text-foreground"
                    onDragStart={() => handleDragStart(category.id)}
                  >
                    <GripVertical className="h-4 w-4" />
                  </button>

                  <div className="min-w-0 flex-1">
                    {isEditing ? (
                      <div className="space-y-2">
                        <Input
                          value={editingName}
                          onChange={(event) => {
                            setEditingName(event.target.value);
                            if (error) setError("");
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              handleRenameCategory();
                            }
                          }}
                        />
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingCategoryId(null);
                              setEditingName("");
                              setError("");
                            }}
                          >
                            Cancel
                          </Button>
                          <Button size="sm" onClick={handleRenameCategory}>
                            Save
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <p className="font-medium text-foreground">{category.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Position {index + 1}
                        </p>
                      </div>
                    )}
                  </div>

                  {!isEditing ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        aria-label={`Open actions for ${category.name}`}
                        className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-muted-foreground transition-colors hover:text-foreground"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => startRename(category)}>
                          <PencilLine className="h-4 w-4 text-muted-foreground" />
                          Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDeleteCategory(category.id)}>
                          <Trash2 className="h-4 w-4 text-danger" />
                          <span className="text-danger">Delete</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => moveCategory(category.id, "up")}
                          disabled={index === 0}
                        >
                          <ArrowUp className="h-4 w-4 text-muted-foreground" />
                          Move Up
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => moveCategory(category.id, "down")}
                          disabled={index === sortedCategories.length - 1}
                        >
                          <ArrowDown className="h-4 w-4 text-muted-foreground" />
                          Move Down
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Dialog>
  );
}
