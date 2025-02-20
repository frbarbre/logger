"use client";

import * as React from "react";
import { format, isSameDay, isToday } from "date-fns";
import { CalendarIcon } from "lucide-react";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SelectRangeEventHandler } from "react-day-picker";

dayjs.extend(utc);
dayjs.extend(timezone);

interface DateTimeRangePickerProps {
  onRangeSelect: (range: string) => void;
  use24HourTime?: boolean;
}

export function DateTimeRangePicker({
  onRangeSelect,
  use24HourTime = true,
}: DateTimeRangePickerProps) {
  const [dateRange, setDateRange] = React.useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({
    from: undefined,
    to: undefined,
  });
  const [startTime, setStartTime] = React.useState<string>("00:00");
  const [endTime, setEndTime] = React.useState<string>("00:15");

  const handleDateRangeChange = (
    range: { from: Date | undefined; to: Date | undefined } | undefined
  ) => {
    if (!range) {
      setDateRange({ from: undefined, to: undefined });
      setStartTime("00:00");
      setEndTime("00:15");
      return;
    }

    const { from, to } = range;
    if (from && !to) {
      setDateRange({ from, to: from });
    } else {
      setDateRange(range);
    }
    setStartTime("00:00");
    setEndTime("00:15");
  };

  const formatOutput = () => {
    if (!dateRange.from || !dateRange.to) return "Please select a date range";

    const startDateTime = dayjs(dateRange.from)
      .set("hour", Number.parseInt(startTime.split(":")[0]))
      .set("minute", Number.parseInt(startTime.split(":")[1]))
      .set("second", 0);

    const utcStart = startDateTime.utc().format("YYYY-MM-DDTHH:mm:ssZ");
    const utcEnd =
      endTime === "now"
        ? "now"
        : dayjs(dateRange.to)
            .set("hour", Number.parseInt(endTime.split(":")[0]))
            .set("minute", Number.parseInt(endTime.split(":")[1]))
            .set("second", 0)
            .utc()
            .format("YYYY-MM-DDTHH:mm:ssZ");

    return `Start: ${utcStart}\nEnd: ${utcEnd}`;
  };

  const isDateInPast = (date: Date) => {
    return date > new Date();
  };

  const getAvailableTimes = (isStart: boolean) => {
    const times: string[] = [];
    const now = new Date();
    const selectedDate = isStart ? dateRange.from : dateRange.to;

    if (!selectedDate) return times;

    for (let i = 0; i < 24 * 4; i++) {
      const hours = Math.floor(i / 4);
      const minutes = (i % 4) * 15;
      const time = `${hours.toString().padStart(2, "0")}:${minutes
        .toString()
        .padStart(2, "0")}`;

      if (isToday(selectedDate)) {
        if (isStart) {
          if (
            hours < now.getHours() ||
            (hours === now.getHours() && minutes <= now.getMinutes())
          ) {
            times.push(time);
          }
        } else {
          // For end time on today, limit to current time
          if (
            hours < now.getHours() ||
            (hours === now.getHours() && minutes <= now.getMinutes())
          ) {
            // Only add times after the start time
            if (time > startTime) {
              times.push(time);
            }
          }
        }
      } else {
        // For non-today dates, add all times after start time
        if (!isStart) {
          if (time > startTime) {
            times.push(time);
          }
        } else {
          times.push(time);
        }
      }
    }

    // Add "Now" option for end time if the date is today
    if (!isStart && isToday(selectedDate)) {
      times.push("now");
    }

    return times;
  };

  const handleStartTimeChange = (newTime: string) => {
    setStartTime(newTime);
    const availableEndTimes = getAvailableTimes(false);
    if (availableEndTimes.length > 0) {
      if (endTime <= newTime || !availableEndTimes.includes(endTime)) {
        const nextAvailableTime =
          availableEndTimes.find((time) => time > newTime) ||
          availableEndTimes[0];
        setEndTime(nextAvailableTime);
      }
    } else if (isToday(dateRange.to!)) {
      setEndTime("now");
    }
  };

  const handleEndTimeChange = (newTime: string) => {
    setEndTime(newTime);
  };

  const handleApply = () => {
    const formattedRange = formatOutput();
    onRangeSelect(formattedRange);
  };

  const formatTimeForDisplay = (time: string) => {
    if (time === "now") return "Now";
    if (use24HourTime) return time;

    const [hours, minutes] = time.split(":").map(Number);
    const period = hours >= 12 ? "PM" : "AM";
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, "0")} ${period}`;
  };

  return (
    <div className="grid gap-4">
      <Popover modal>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            className={cn(
              "w-full justify-start text-left font-normal",
              !dateRange.from && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {dateRange.from ? (
              dateRange.to && !isSameDay(dateRange.from, dateRange.to) ? (
                <>
                  {format(dateRange.from, "LLL dd, y")} -{" "}
                  {format(dateRange.to, "LLL dd, y")}
                </>
              ) : (
                format(dateRange.from, "LLL dd, y")
              )
            ) : (
              <span>Pick a date range</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={dateRange.from}
            selected={dateRange}
            onSelect={handleDateRangeChange as SelectRangeEventHandler}
            numberOfMonths={2}
            disabled={isDateInPast}
          />
        </PopoverContent>
      </Popover>

      <div className="flex space-x-4">
        <div className="flex-1">
          <TimePicker
            label="Start Time"
            value={startTime}
            onChange={handleStartTimeChange}
            disabled={!dateRange.from}
            availableTimes={dateRange.from ? getAvailableTimes(true) : []}
            formatTimeForDisplay={formatTimeForDisplay}
          />
        </div>
        <div className="flex-1">
          <TimePicker
            label="End Time"
            value={endTime}
            onChange={handleEndTimeChange}
            disabled={!dateRange.to}
            availableTimes={dateRange.to ? getAvailableTimes(false) : []}
            formatTimeForDisplay={formatTimeForDisplay}
          />
        </div>
      </div>

      <Button onClick={handleApply}>Apply</Button>
    </div>
  );
}

interface TimePickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  availableTimes: string[];
  formatTimeForDisplay: (time: string) => string;
}

function TimePicker({
  label,
  value,
  onChange,
  disabled,
  availableTimes,
  formatTimeForDisplay,
}: TimePickerProps) {
  return (
    <div className="grid gap-2">
      <label htmlFor={label} className="text-sm font-medium text-gray-700">
        {label}
      </label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger id={label} className="w-full">
          <SelectValue placeholder="Select time">
            {formatTimeForDisplay(value)}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {availableTimes.map((time) => (
            <SelectItem key={time} value={time}>
              {formatTimeForDisplay(time)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
