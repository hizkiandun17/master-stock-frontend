"use client";

import { createPortal } from "react-dom";
import { useEffect, useId, useState, type ReactNode } from "react";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  headerClassName?: string;
  bodyClassName?: string;
  titleClassName?: string;
  descriptionClassName?: string;
}

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
  headerClassName,
  bodyClassName,
  titleClassName,
  descriptionClassName,
}: DialogProps) {
  const [mounted, setMounted] = useState(false);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    setMounted(true);

    return () => {
      setMounted(false);
    };
  }, []);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth =
      window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onOpenChange(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onOpenChange, open]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-black/50 p-0 md:items-center md:p-6 animate-[dialog-overlay-in_160ms_ease-out]"
      onClick={() => onOpenChange(false)}
      data-testid="dialog-overlay"
    >
      <div
        className={cn(
          "relative flex h-full w-full flex-col overflow-hidden rounded-none border-0 border-border bg-card shadow-[0_24px_90px_rgba(0,0,0,0.5)] animate-[dialog-content-in_180ms_ease-out] md:h-auto md:max-h-[90vh] md:max-w-[560px] md:rounded-[24px] md:border",
          className,
        )}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
      >
        <div
          className={cn(
            "flex items-start justify-between border-b border-border px-4 py-4 md:px-6 md:py-5",
            headerClassName,
          )}
        >
          <div className="space-y-1">
            <h2
              id={titleId}
              className={cn("text-lg font-semibold text-foreground", titleClassName)}
            >
              {title}
            </h2>
            {description ? (
              <p
                id={descriptionId}
                className={cn("text-sm text-muted-foreground", descriptionClassName)}
              >
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-md p-2.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div
          className={cn(
            "min-h-0 flex-1 overflow-y-auto px-4 py-4 md:max-h-[calc(90vh-180px)] md:px-6 md:py-5",
            bodyClassName,
          )}
        >
          {children}
        </div>
        {footer ? (
          <div className="border-t border-border px-4 py-4 md:px-6">{footer}</div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
