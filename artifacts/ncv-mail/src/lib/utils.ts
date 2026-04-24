import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function extractEmailAddress(value: string | null | undefined): string {
  if (!value) return "";
  const angle = value.match(/<\s*([^<>\s]+@[^<>\s]+)\s*>/);
  if (angle && angle[1]) return angle[1].trim();
  const trimmed = value.trim().replace(/^[<"']+|[>"']+$/g, "");
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return trimmed;
  const tokenMatch = trimmed.match(/[^\s<>"']+@[^\s<>"']+\.[^\s<>"']+/);
  return tokenMatch ? tokenMatch[0] : "";
}
