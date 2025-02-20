"use client";

import { createWithEqualityFn } from "zustand/traditional";
import { persist } from "zustand/middleware";

type DateRangeStore = {
  dateRanges: { end: string; start: string } | null | undefined;
  changeDateRanges: (
    dateRanges: { end: string; start: string } | null | undefined
  ) => void;

  clearStore: () => void;
};

export const useDateRangeStore = createWithEqualityFn<DateRangeStore>()(
  persist(
    (set, get): DateRangeStore => ({
      dateRanges: { start: "24h", end: "now" },
      changeDateRanges: (dateRanges) => set({ dateRanges }),

      clearStore: () =>
        set({
          dateRanges: null,
        }),
    }),
    {
      name: "date-range-storage",
    }
  )
);
