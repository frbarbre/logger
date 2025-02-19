"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import relativeTime from "dayjs/plugin/relativeTime";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DateTimeRangePicker } from "@/components/date-time-range-picker";

dayjs.extend(utc);
dayjs.extend(relativeTime);

const predefinedRanges = [
  { label: "Last 72 hours", value: "72h" },
  { label: "Last 48 hours", value: "48h" },
  { label: "Last 24 hours", value: "24h" },
  { label: "Last 12 hours", value: "12h" },
  { label: "Last 6 hours", value: "6h" },
  { label: "Last hour", value: "1h" },
  { label: "Last 30 minutes", value: "30m" },
];

interface TimeRangeSelectorProps {
  use24HourTime?: boolean;
}

export function TimeRangeSelector({
  use24HourTime = true,
}: TimeRangeSelectorProps) {
  const [selectedRange, setSelectedRange] = React.useState<string>("24h");
  const [customRange, setCustomRange] = React.useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);

  const handleRangeSelect = (range: string) => {
    if (range === "custom") {
      setIsDialogOpen(true);
    } else {
      setSelectedRange(range);
      setCustomRange(null);
    }
  };

  const handleCustomRangeSelect = (range: string) => {
    setCustomRange(range);
    setSelectedRange("custom");
    setIsDialogOpen(false);
  };

  const formatSelectedRange = () => {
    if (customRange) {
      return customRange;
    }

    return `Start: ${selectedRange}\nEnd: now`;
  };

  return (
    <div className="flex flex-col space-y-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="w-[200px] justify-between">
            {selectedRange === "custom"
              ? "Custom Range"
              : predefinedRanges.find((r) => r.value === selectedRange)?.label}
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

      <div className="mt-4">
        <h3 className="font-semibold mb-2">Selected Range:</h3>
        <pre className="bg-muted p-2 rounded whitespace-pre-wrap">
          {formatSelectedRange()}
        </pre>
      </div>
    </div>
  );
}
