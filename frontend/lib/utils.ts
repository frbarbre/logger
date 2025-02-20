import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string | null) {
  if (!date) return null;

  try {
    if (date === "now") {
      return new Date().toISOString().replace("T", " ");
    }

    if (typeof date === "string" && /^\d+[hm]$/.test(date)) {
      const now = new Date();
      const value = parseInt(date);
      const unit = date.slice(-1);

      const pastDate = new Date(now);
      if (unit === "h") {
        pastDate.setHours(now.getHours() - value);
      } else if (unit === "m") {
        pastDate.setMinutes(now.getMinutes() - value);
      }

      return pastDate.toISOString().replace("T", " ");
    }

    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) {
      return null;
    }

    return parsedDate.toISOString().replace("T", " ");
  } catch (error) {
    return null;
  }
}
