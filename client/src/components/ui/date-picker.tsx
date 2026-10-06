import * as React from "react"
import { format } from "date-fns"
import { ChevronDown, Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export interface DateTimePickerProps {
  value?: string // ISO string format: YYYY-MM-DDTHH:mm
  onChange?: (value: string) => void
  disabled?: boolean
  id?: string
}

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"))
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"))

interface TimeScrollColumnProps {
  items: string[]
  selected: string
  onSelect: (value: string) => void
  label: string
}

const TimeScrollColumn: React.FC<TimeScrollColumnProps> = ({
  items,
  selected,
  onSelect,
  label,
}) => {
  const containerRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const selectedEl = container.querySelector('[data-selected="true"]') as HTMLElement
    if (selectedEl) {
      container.scrollTo({
        top: selectedEl.offsetTop - container.clientHeight / 2 + selectedEl.clientHeight / 2,
        behavior: 'smooth',
      })
    }
  }, [selected])

  return (
    <div className="space-y-1 flex-1 min-w-0">
      <span className="text-[10px] font-bold text-muted-foreground block text-center uppercase tracking-wider">
        {label}
      </span>
      <div
        ref={containerRef}
        className="h-44 overflow-y-auto space-y-1 pr-1 border-r border-border scroll-smooth relative"
        style={{ scrollbarWidth: 'thin' }}
      >
        {items.map((item) => {
          const isSelected = item === selected
          return (
            <button
              key={item}
              type="button"
              data-selected={isSelected}
              onClick={() => onSelect(item)}
              className={cn(
                "w-full h-8 flex items-center justify-center rounded-md text-xs font-semibold transition-all duration-150 cursor-pointer select-none",
                isSelected
                  ? "bg-emerald-500 text-white font-bold shadow-xs scale-102"
                  : "text-foreground hover:bg-secondary hover:text-emerald-500"
              )}
            >
              {item}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Shadcn UI Date & Dynamic Time Picker component.
 * Provides interactive Popover Calendar for Date & dynamic Hours/Minutes/AM-PM picker for Time.
 */
export const DateTimePicker = React.forwardRef<HTMLInputElement, DateTimePickerProps>(
  ({ value, onChange, disabled, id }, ref) => {
    const [dateOpen, setDateOpen] = React.useState(false)
    const [timeOpen, setTimeOpen] = React.useState(false)

    // Derive active Date object from value (or default to current local user time rounded to next 5 minutes)
    const dateObj = React.useMemo(() => {
      if (!value) {
        const now = new Date();
        const mins = now.getMinutes();
        const roundedMins = Math.ceil(mins / 5) * 5;
        if (roundedMins === 60) {
          now.setHours(now.getHours() + 1, 0, 0, 0);
        } else {
          now.setMinutes(roundedMins, 0, 0);
        }
        return now;
      }
      const d = new Date(value);
      return isNaN(d.getTime()) ? new Date() : d;
    }, [value]);

    const parsedTime = React.useMemo(() => {
      let h = dateObj.getHours();
      const period = h >= 12 ? ("PM" as const) : ("AM" as const);
      h = h % 12 || 12;
      const pad = (n: number) => String(n).padStart(2, "0");
      return {
        hour: pad(h),
        minute: pad(dateObj.getMinutes()),
        period,
      };
    }, [dateObj]);

    const selectedHour = parsedTime.hour;
    const selectedMinute = parsedTime.minute;
    const selectedPeriod = parsedTime.period;

    const handleDateSelect = (selectedDate?: Date) => {
      if (!selectedDate) return;
      setDateOpen(false);

      let h24 = parseInt(selectedHour, 10) % 12;
      if (selectedPeriod === "PM") h24 += 12;
      const mins = parseInt(selectedMinute, 10) || 0;

      const updated = new Date(
        selectedDate.getFullYear(),
        selectedDate.getMonth(),
        selectedDate.getDate(),
        h24,
        mins,
        0,
        0
      );
      onChange?.(updated.toISOString());
    };

    const updateTime = (hStr: string, mStr: string, pStr: "AM" | "PM") => {
      let h24 = parseInt(hStr, 10) % 12;
      if (pStr === "PM") h24 += 12;
      const mins = parseInt(mStr, 10) || 0;

      const updated = new Date(
        dateObj.getFullYear(),
        dateObj.getMonth(),
        dateObj.getDate(),
        h24,
        mins,
        0,
        0
      );
      onChange?.(updated.toISOString());
    };

    const formattedTimeDisplay = `${selectedHour}:${selectedMinute} ${selectedPeriod}`;

    return (
      <div className="grid grid-cols-2 gap-3 w-full">
        {/* Date Selector Field */}
        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Date
          </label>
          <Popover open={dateOpen} onOpenChange={setDateOpen}>
            <PopoverTrigger
              render={
                <Button
                  variant="outline"
                  disabled={disabled}
                  className="w-full justify-between text-xs md:text-sm font-medium h-10 border-border bg-card text-foreground shadow-xs"
                >
                  <span className="truncate">{dateObj ? format(dateObj, "PPP") : "Select date"}</span>
                  <ChevronDown size={14} className="opacity-50 shrink-0 ml-1" />
                </Button>
              }
            />
            <PopoverContent className="w-auto p-0 border-border bg-card shadow-xl" align="start">
              <Calendar
                mode="single"
                selected={dateObj}
                defaultMonth={dateObj}
                disabled={{ before: new Date(new Date().setHours(0, 0, 0, 0)) }}
                onSelect={handleDateSelect}
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Dynamic Time Selector Field */}
        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Time
          </label>
          <Popover open={timeOpen} onOpenChange={setTimeOpen}>
            <PopoverTrigger
              render={
                <Button
                  variant="outline"
                  disabled={disabled}
                  className="w-full justify-between text-xs md:text-sm font-medium h-10 border-border bg-card text-foreground shadow-xs"
                >
                  <span className="truncate font-semibold">{formattedTimeDisplay}</span>
                  <Clock size={14} className="opacity-50 shrink-0 ml-1" />
                </Button>
              }
            />
            <PopoverContent className="w-64 p-3 border-border bg-card shadow-xl" align="start">
              <div className="space-y-3">
                {/* Header readout */}
                <div className="text-center py-1 bg-secondary/50 rounded-md border border-border">
                  <span className="text-sm font-bold text-emerald-500 tracking-wider">
                    {formattedTimeDisplay}
                  </span>
                </div>

                {/* 3 Column Selector: Hours | Minutes | AM/PM */}
                <div className="grid grid-cols-3 gap-2 h-48 items-center">
                  <TimeScrollColumn
                    label="Hour"
                    items={HOURS}
                    selected={selectedHour}
                    onSelect={(h) => updateTime(h, selectedMinute, selectedPeriod)}
                  />

                  <TimeScrollColumn
                    label="Minute"
                    items={MINUTES}
                    selected={selectedMinute}
                    onSelect={(m) => updateTime(selectedHour, m, selectedPeriod)}
                  />

                  {/* AM / PM Segment Column */}
                  <div className="space-y-1 flex flex-col h-full">
                    <span className="text-[10px] font-bold text-muted-foreground block text-center uppercase tracking-wider">
                      Period
                    </span>
                    <div className="flex flex-col gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => updateTime(selectedHour, selectedMinute, "AM")}
                        className={cn(
                          "w-full py-2 text-center rounded-md text-xs font-semibold transition-colors border border-border hover:bg-secondary cursor-pointer",
                          selectedPeriod === "AM" && "bg-emerald-500 text-white border-emerald-500 hover:bg-emerald-600 shadow-xs"
                        )}
                      >
                        AM
                      </button>
                      <button
                        type="button"
                        onClick={() => updateTime(selectedHour, selectedMinute, "PM")}
                        className={cn(
                          "w-full py-2 text-center rounded-md text-xs font-semibold transition-colors border border-border hover:bg-secondary cursor-pointer",
                          selectedPeriod === "PM" && "bg-emerald-500 text-white border-emerald-500 hover:bg-emerald-600 shadow-xs"
                        )}
                      >
                        PM
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <input ref={ref} id={id} type="hidden" value={value || ""} />
      </div>
    )
  }
)

DateTimePicker.displayName = "DateTimePicker"
