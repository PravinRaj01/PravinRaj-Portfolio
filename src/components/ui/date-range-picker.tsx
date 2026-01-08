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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type DateFormatType = "full" | "month-year";

interface DateRangePickerProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  allowPresent?: boolean;
  dateFormat?: DateFormatType;
  onDateFormatChange?: (format: DateFormatType) => void;
  showFormatSelector?: boolean;
}

// Detect format from string
function detectDateFormat(dateStr: string): DateFormatType {
  if (!dateStr) return "month-year";
  // Check if it has a day component (e.g., "15 Aug 2021" or "Aug 15, 2021")
  const fullDatePattern = /\d{1,2}\s+\w+\s+\d{4}|\w+\s+\d{1,2},?\s+\d{4}|\d{4}-\d{2}-\d{2}/;
  return fullDatePattern.test(dateStr) ? "full" : "month-year";
}

// Parse period string like "Aug 2021 - Dec 2025" or "15 Aug 2021 - 20 Dec 2025"
function parsePeriodString(period: string): { startDate?: Date; endDate?: Date; isPresent: boolean; format: DateFormatType } {
  if (!period) return { startDate: undefined, endDate: undefined, isPresent: false, format: "month-year" };
  
  const parts = period.split(" - ");
  const isPresent = parts[1]?.toLowerCase() === "present";
  const detectedFormat = detectDateFormat(parts[0]);
  
  let startDate: Date | undefined;
  let endDate: Date | undefined;
  
  try {
    if (parts[0]) {
      if (detectedFormat === "full") {
        startDate = parse(parts[0], "d MMM yyyy", new Date());
        if (isNaN(startDate.getTime())) {
          startDate = parse(parts[0], "MMM d, yyyy", new Date());
        }
      } else {
        startDate = parse(parts[0], "MMM yyyy", new Date());
      }
    }
    if (parts[1] && !isPresent) {
      if (detectedFormat === "full") {
        endDate = parse(parts[1], "d MMM yyyy", new Date());
        if (isNaN(endDate.getTime())) {
          endDate = parse(parts[1], "MMM d, yyyy", new Date());
        }
      } else {
        endDate = parse(parts[1], "MMM yyyy", new Date());
      }
    }
  } catch {
    // Invalid format, return undefined
  }
  
  return { startDate, endDate, isPresent, format: detectedFormat };
}

// Format dates back to string
function formatPeriodString(startDate?: Date, endDate?: Date, isPresent?: boolean, dateFormat: DateFormatType = "month-year"): string {
  if (!startDate) return "";
  
  const formatStr = dateFormat === "full" ? "d MMM yyyy" : "MMM yyyy";
  const start = format(startDate, formatStr);
  
  if (isPresent) {
    return `${start} - Present`;
  }
  
  if (!endDate) return start;
  
  return `${start} - ${format(endDate, formatStr)}`;
}

export function DateRangePicker({
  value = "",
  onChange,
  placeholder = "Select date range",
  className,
  allowPresent = true,
  dateFormat: externalDateFormat,
  onDateFormatChange,
  showFormatSelector = true,
}: DateRangePickerProps) {
  const parsed = parsePeriodString(value);
  const [startDate, setStartDate] = React.useState<Date | undefined>(parsed.startDate);
  const [endDate, setEndDate] = React.useState<Date | undefined>(parsed.endDate);
  const [isPresent, setIsPresent] = React.useState(parsed.isPresent);
  const [internalDateFormat, setInternalDateFormat] = React.useState<DateFormatType>(parsed.format);
  const [startOpen, setStartOpen] = React.useState(false);
  const [endOpen, setEndOpen] = React.useState(false);

  const dateFormat = externalDateFormat ?? internalDateFormat;

  // Update internal state when value changes
  React.useEffect(() => {
    const parsed = parsePeriodString(value);
    setStartDate(parsed.startDate);
    setEndDate(parsed.endDate);
    setIsPresent(parsed.isPresent);
    if (!externalDateFormat) {
      setInternalDateFormat(parsed.format);
    }
  }, [value, externalDateFormat]);

  const handleDateFormatChange = (newFormat: DateFormatType) => {
    setInternalDateFormat(newFormat);
    onDateFormatChange?.(newFormat);
    // Re-format the current dates with the new format
    if (startDate || endDate) {
      const newValue = formatPeriodString(startDate, endDate, isPresent, newFormat);
      onChange(newValue);
    }
  };

  const handleStartDateChange = (date: Date | undefined) => {
    setStartDate(date);
    setStartOpen(false);
    const newValue = formatPeriodString(date, endDate, isPresent, dateFormat);
    onChange(newValue);
  };

  const handleEndDateChange = (date: Date | undefined) => {
    setEndDate(date);
    setEndOpen(false);
    setIsPresent(false);
    const newValue = formatPeriodString(startDate, date, false, dateFormat);
    onChange(newValue);
  };

  const handlePresentChange = (checked: boolean) => {
    setIsPresent(checked);
    if (checked) {
      setEndDate(undefined);
    }
    const newValue = formatPeriodString(startDate, checked ? undefined : endDate, checked, dateFormat);
    onChange(newValue);
  };

  const formatDisplay = dateFormat === "full" ? "d MMM yyyy" : "MMM yyyy";

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {/* Date Format Selector */}
      {showFormatSelector && (
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Date Display Format</Label>
          <Select value={dateFormat} onValueChange={(val: DateFormatType) => handleDateFormatChange(val)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select format" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month-year">Month & Year only (e.g., Aug 2021)</SelectItem>
              <SelectItem value="full">Full Date (e.g., 15 Aug 2021)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

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
                {startDate ? format(startDate, formatDisplay) : <span>Pick start date</span>}
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
                  format(endDate, formatDisplay)
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
  dateFormat?: DateFormatType;
  onDateFormatChange?: (format: DateFormatType) => void;
  showFormatSelector?: boolean;
}

// Detect single date format
function detectSingleDateFormat(dateStr: string): DateFormatType {
  if (!dateStr) return "month-year";
  const fullDatePattern = /\d{1,2}\s+\w+\s+\d{4}|\w+\s+\d{1,2},?\s+\d{4}|\d{4}-\d{2}-\d{2}/;
  return fullDatePattern.test(dateStr) ? "full" : "month-year";
}

export function SingleDatePicker({
  value = "",
  onChange,
  placeholder = "Select date",
  className,
  dateFormat: externalDateFormat,
  onDateFormatChange,
  showFormatSelector = true,
}: SingleDatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [internalDateFormat, setInternalDateFormat] = React.useState<DateFormatType>(
    detectSingleDateFormat(value)
  );
  
  const dateFormat = externalDateFormat ?? internalDateFormat;
  
  let date: Date | undefined;
  try {
    if (value) {
      // Try parsing different formats
      if (dateFormat === "full" || detectSingleDateFormat(value) === "full") {
        date = parse(value, "d MMM yyyy", new Date());
        if (isNaN(date.getTime())) {
          date = parse(value, "MMM d, yyyy", new Date());
        }
      }
      if (!date || isNaN(date.getTime())) {
        date = parse(value, "MMM yyyy", new Date());
      }
      if (isNaN(date.getTime())) {
        date = parse(value, "yyyy", new Date());
      }
    }
  } catch {
    // Invalid format
  }

  const handleDateFormatChange = (newFormat: DateFormatType) => {
    setInternalDateFormat(newFormat);
    onDateFormatChange?.(newFormat);
    // Re-format the current date with the new format
    if (date && !isNaN(date.getTime())) {
      const formatStr = newFormat === "full" ? "d MMM yyyy" : "MMM yyyy";
      onChange(format(date, formatStr));
    }
  };

  const handleDateChange = (newDate: Date | undefined) => {
    setOpen(false);
    if (newDate) {
      const formatStr = dateFormat === "full" ? "d MMM yyyy" : "MMM yyyy";
      onChange(format(newDate, formatStr));
    }
  };

  const formatDisplay = dateFormat === "full" ? "d MMM yyyy" : "MMM yyyy";

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {/* Date Format Selector */}
      {showFormatSelector && (
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Date Display Format</Label>
          <Select value={dateFormat} onValueChange={(val: DateFormatType) => handleDateFormatChange(val)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select format" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month-year">Month & Year only (e.g., Aug 2021)</SelectItem>
              <SelectItem value="full">Full Date (e.g., 15 Aug 2021)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal",
              !date && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date && !isNaN(date.getTime()) ? format(date, formatDisplay) : <span>{placeholder}</span>}
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
    </div>
  );
}
