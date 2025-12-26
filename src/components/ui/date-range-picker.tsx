import * as React from "react";
import { format, parse } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface DateRangePickerProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  allowPresent?: boolean;
}

// Parse period string like "Aug 2021 - Dec 2025" or "Aug 2021 - Present"
function parsePeriodString(period: string): { startDate?: Date; endDate?: Date; isPresent: boolean } {
  if (!period) return { startDate: undefined, endDate: undefined, isPresent: false };
  
  const parts = period.split(" - ");
  const isPresent = parts[1]?.toLowerCase() === "present";
  
  let startDate: Date | undefined;
  let endDate: Date | undefined;
  
  try {
    if (parts[0]) {
      startDate = parse(parts[0], "MMM yyyy", new Date());
    }
    if (parts[1] && !isPresent) {
      endDate = parse(parts[1], "MMM yyyy", new Date());
    }
  } catch {
    // Invalid format, return undefined
  }
  
  return { startDate, endDate, isPresent };
}

// Format dates back to string like "Aug 2021 - Dec 2025"
function formatPeriodString(startDate?: Date, endDate?: Date, isPresent?: boolean): string {
  if (!startDate) return "";
  
  const start = format(startDate, "MMM yyyy");
  
  if (isPresent) {
    return `${start} - Present`;
  }
  
  if (!endDate) return start;
  
  return `${start} - ${format(endDate, "MMM yyyy")}`;
}

export function DateRangePicker({
  value = "",
  onChange,
  placeholder = "Select date range",
  className,
  allowPresent = true,
}: DateRangePickerProps) {
  const parsed = parsePeriodString(value);
  const [startDate, setStartDate] = React.useState<Date | undefined>(parsed.startDate);
  const [endDate, setEndDate] = React.useState<Date | undefined>(parsed.endDate);
  const [isPresent, setIsPresent] = React.useState(parsed.isPresent);
  const [startOpen, setStartOpen] = React.useState(false);
  const [endOpen, setEndOpen] = React.useState(false);

  // Update internal state when value changes
  React.useEffect(() => {
    const parsed = parsePeriodString(value);
    setStartDate(parsed.startDate);
    setEndDate(parsed.endDate);
    setIsPresent(parsed.isPresent);
  }, [value]);

  const handleStartDateChange = (date: Date | undefined) => {
    setStartDate(date);
    setStartOpen(false);
    const newValue = formatPeriodString(date, endDate, isPresent);
    onChange(newValue);
  };

  const handleEndDateChange = (date: Date | undefined) => {
    setEndDate(date);
    setEndOpen(false);
    setIsPresent(false);
    const newValue = formatPeriodString(startDate, date, false);
    onChange(newValue);
  };

  const handlePresentChange = (checked: boolean) => {
    setIsPresent(checked);
    if (checked) {
      setEndDate(undefined);
    }
    const newValue = formatPeriodString(startDate, checked ? undefined : endDate, checked);
    onChange(newValue);
  };

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Start Date Picker */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Start Date</Label>
          <Popover open={startOpen} onOpenChange={setStartOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !startDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {startDate ? format(startDate, "MMM yyyy") : <span>Pick start date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={startDate}
                onSelect={handleStartDateChange}
                initialFocus
                defaultMonth={startDate}
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* End Date Picker */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">End Date</Label>
          <Popover open={endOpen} onOpenChange={setEndOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !endDate && !isPresent && "text-muted-foreground",
                  isPresent && "bg-primary/10 border-primary"
                )}
                disabled={isPresent}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {isPresent ? (
                  <span className="text-primary font-medium">Present</span>
                ) : endDate ? (
                  format(endDate, "MMM yyyy")
                ) : (
                  <span>Pick end date</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={endDate}
                onSelect={handleEndDateChange}
                initialFocus
                defaultMonth={endDate || startDate}
                disabled={(date) => startDate ? date < startDate : false}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Present checkbox */}
      {allowPresent && (
        <div className="flex items-center space-x-2">
          <Checkbox
            id="present"
            checked={isPresent}
            onCheckedChange={handlePresentChange}
          />
          <Label
            htmlFor="present"
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            Currently ongoing (Present)
          </Label>
        </div>
      )}
    </div>
  );
}

// Single date picker for certifications
interface SingleDatePickerProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function SingleDatePicker({
  value = "",
  onChange,
  placeholder = "Select date",
  className,
}: SingleDatePickerProps) {
  const [open, setOpen] = React.useState(false);
  
  let date: Date | undefined;
  try {
    if (value) {
      // Try parsing different formats
      date = parse(value, "MMM yyyy", new Date());
      if (isNaN(date.getTime())) {
        date = parse(value, "yyyy", new Date());
      }
    }
  } catch {
    // Invalid format
  }

  const handleDateChange = (newDate: Date | undefined) => {
    setOpen(false);
    if (newDate) {
      onChange(format(newDate, "MMM yyyy"));
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal",
            !date && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date && !isNaN(date.getTime()) ? format(date, "MMM yyyy") : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={handleDateChange}
          initialFocus
          defaultMonth={date}
        />
      </PopoverContent>
    </Popover>
  );
}
