import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Utility function to merge tailwind classes safely without style conflicts.
 * Combines the capabilities of `clsx` (conditional classes) and `tailwind-merge` (resolving conflicts).
 * 
 * @param {...(string | Record<string, boolean> | undefined | null | false)} inputs
 * @returns {string}
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
