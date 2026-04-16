"use client";

import { ChevronDown, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  useDropdownMenuControls,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import type { Category } from "@/lib/types";
import { cn } from "@/lib/utils";

interface CategorySelectFieldProps {
  label: string;
  value: string;
  categories: Category[];
  placeholder?: string;
  helperText?: string;
  onChange: (categoryId: string) => void;
  onCreateCategory: (name: string) => { ok: boolean; category?: Category; error?: string };
  onManageCategories?: () => void;
}

function InlineCreateCategory({
  onCreateCategory,
  onChange,
}: Pick<CategorySelectFieldProps, "onCreateCategory" | "onChange">) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { setOpen } = useDropdownMenuControls();
  const [isCreating, setIsCreating] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (isCreating) {
      inputRef.current?.focus();
    }
  }, [isCreating]);

  function reset() {
    setDraftName("");
    setError("");
    setIsCreating(false);
  }

  function submit() {
    const result = onCreateCategory(draftName);

    if (!result.ok || !result.category) {
      setError(result.error ?? "Unable to create category.");
      return;
    }

    onChange(result.category.id);
    reset();
    setOpen(false);
  }

  if (!isCreating) {
    return (
      <button
        type="button"
        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-accent"
        onClick={() => setIsCreating(true)}
      >
        <Plus className="h-4 w-4 text-muted-foreground" />
        Create new category
      </button>
    );
  }

  return (
    <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.02] p-3">
      <Input
        ref={inputRef}
        value={draftName}
        onChange={(event) => {
          setDraftName(event.target.value);
          if (error) setError("");
        }}
        placeholder="Enter category name"
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            submit();
          }

          if (event.key === "Escape") {
            event.preventDefault();
            reset();
          }
        }}
      />
      {error ? <p className="text-xs text-danger">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={reset}>
          Cancel
        </Button>
        <Button type="button" size="sm" onClick={submit}>
          Create
        </Button>
      </div>
    </div>
  );
}

export function CategorySelectField({
  label,
  value,
  categories,
  placeholder = "Select category",
  helperText,
  onChange,
  onCreateCategory,
  onManageCategories,
}: CategorySelectFieldProps) {
  const selectedCategory =
    categories.find((category) => category.id === value)?.name ?? "";

  return (
    <div className="space-y-2 text-sm">
      <span className="text-foreground">{label}</span>
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            "flex h-10 w-full items-center justify-between rounded-xl border border-input bg-background px-3 py-2 text-left text-sm text-foreground shadow-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            !selectedCategory && "text-muted-foreground",
          )}
        >
          <span>{selectedCategory || placeholder}</span>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-[320px] overflow-y-auto">
          <DropdownMenuLabel>{label}</DropdownMenuLabel>
          {categories.map((category) => (
            <DropdownMenuItem
              key={category.id}
              className={cn(value === category.id && "bg-accent")}
              onClick={() => onChange(category.id)}
            >
              {category.name}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <InlineCreateCategory
            onCreateCategory={onCreateCategory}
            onChange={onChange}
          />
        </DropdownMenuContent>
      </DropdownMenu>
      {helperText || onManageCategories ? (
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="text-muted-foreground">{helperText}</span>
          {onManageCategories ? (
            <button
              type="button"
              className="text-foreground transition-colors hover:text-white"
              onClick={onManageCategories}
            >
              Manage categories →
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
