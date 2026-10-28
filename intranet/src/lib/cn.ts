import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Klassen zusammenführen; bei Tailwind-Konflikten gewinnt die spätere. */
export const cn = (...values: ClassValue[]) => twMerge(clsx(values));
