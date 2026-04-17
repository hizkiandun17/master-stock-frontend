import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

export function formatRelativeTime(isoString: string) {
  const diffMinutes = Math.max(
    0,
    Math.round((Date.now() - new Date(isoString).getTime()) / 60000),
  );

  if (diffMinutes < 60) {
    return `${diffMinutes} mins ago`;
  }

  const hours = Math.round(diffMinutes / 60);
  return `${hours} hours ago`;
}

export function formatDate(isoString?: string) {
  if (!isoString) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(isoString));
}

export function formatDateTime(isoString?: string) {
  if (!isoString) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(isoString));
}

export function titleCase(value?: string) {
  return (value ?? "")
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
