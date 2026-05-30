import * as React from "react";
import { CalendarIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { fmtDate } from "@/lib/format";

type DatePickerProps = {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
};

function parseDateValue(value: string) {
  if (!value) return undefined;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function formatDateValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function DatePicker({ value, onValueChange, placeholder = "YYYY/MM/DD", className, disabled }: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const selectedDate = parseDateValue(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn("w-full justify-start text-start font-normal", !value && "text-muted-foreground", className)}
        >
          <CalendarIcon className="me-2 h-4 w-4" />
          <span>{selectedDate ? fmtDate(selectedDate) : placeholder}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2" align="start">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={(date) => {
            if (!date) return;
            onValueChange(formatDateValue(date));
            setOpen(false);
          }}
          initialFocus
        />
        <div className="flex items-center justify-end gap-2 border-t pt-2">
          {value ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                onValueChange("");
                setOpen(false);
              }}
            >
              Clear
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              const today = new Date();
              onValueChange(formatDateValue(today));
              setOpen(false);
            }}
          >
            Today
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export { DatePicker };