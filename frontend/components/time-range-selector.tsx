"use client";

import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import utc from "dayjs/plugin/utc";
import { ChevronDown } from "lucide-react";

import { DateTimeRangePicker } from "@/components/date-time-range-picker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import useStore from "@/hooks/use-store";
import { useDateRangeStore } from "@/store";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

dayjs.extend(utc);
dayjs.extend(relativeTime);

const predefinedRanges = [
  { label: "Last 30 minutes", value: "30m" },
  { label: "Last hour", value: "1h" },
  { label: "Last 6 hours", value: "6h" },
  { label: "Last 12 hours", value: "12h" },
  { label: "Last 24 hours", value: "24h" },
  { label: "Last 48 hours", value: "48h" },
  { label: "Last 72 hours", value: "72h" },
  { label: "Last 7 days", value: "168h" },
  { label: "Last 14 days", value: "336h" },
  { label: "Last 30 days", value: "720h" },
];

interface TimeRangeSelectorProps {
  use24HourTime?: boolean;
}

interface DateTimeRange {
  start: string;
  end: string | "now";
}

export function TimeRangeSelector({
  use24HourTime = true,
}: TimeRangeSelectorProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const changeDateRange = useDateRangeStore((state) => state.changeDateRanges);

  const dateRange = useStore(useDateRangeStore, (state) => state.dateRanges);
  const router = useRouter();

  function handleRangeSelect(range: string) {
    if (range === "custom") {
      setIsDialogOpen(true);
    } else {
      changeDateRange({ start: range, end: "now" });
    }
  }

  function handleCustomRangeSelect(range: DateTimeRange) {
    setIsDialogOpen(false);

    changeDateRange({ start: range.start, end: range.end });
  }

  useEffect(() => {
    if (!dateRange) {
      router.push(`?start=24h&end=now`);
    } else {
      router.push(
        `?start=${encodeURIComponent(dateRange.start)}&end=${encodeURIComponent(
          dateRange.end
        )}`
      );
    }
  }, [dateRange]);

  return (
    <div className="flex flex-col space-y-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="w-[200px] justify-between">
            {predefinedRanges.find((r) => r.value === dateRange?.start)
              ?.label || "Custom Range"}
            <ChevronDown className="ml-2 h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {predefinedRanges.map((range) => (
            <DropdownMenuItem
              key={range.value}
              onSelect={() => handleRangeSelect(range.value)}
            >
              {range.label}
            </DropdownMenuItem>
          ))}
          <DropdownMenuItem onSelect={() => handleRangeSelect("custom")}>
            Custom Range
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Select Custom Date/Time Range</DialogTitle>
          </DialogHeader>
          <DateTimeRangePicker
            onRangeSelect={handleCustomRangeSelect}
            use24HourTime={use24HourTime}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
