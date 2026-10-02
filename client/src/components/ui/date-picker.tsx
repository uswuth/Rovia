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
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"))

interface InfiniteScrollColumnProps {
  items: string[]
  selected: string
  onSelect: (value: string) => void
  label: string
}

const ITEM_HEIGHT = 32 // h-8 = 32px

const InfiniteScrollColumn: React.FC<InfiniteScrollColumnProps> = ({
  items,
  selected,
  onSelect,
  label,
}) => {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const isSelfScrolling = React.useRef(false)

  const setHeight = items.length * ITEM_HEIGHT
  const tripledItems = React.useMemo(() => [...items, ...items, ...items], [items])

  // Scroll to selected item in middle set when value changes or popover opens
  React.useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const index = items.indexOf(selected)
    if (index === -1) return

    const targetTop = setHeight + index * ITEM_HEIGHT - (144 / 2 - ITEM_HEIGHT / 2)
    container.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' })
  }, [selected, items, setHeight])

  const handleScroll = () => {
    const container = containerRef.current
    if (!container || isSelfScrolling.current) return

    const top = container.scrollTop
    if (top < setHeight * 0.4) {
      isSelfScrolling.current = true
      container.scrollTop = top + setHeight
      setTimeout(() => {
        isSelfScrolling.current = false
      }, 50)
    } else if (top > setHeight * 1.6) {
      isSelfScrolling.current = true
      container.scrollTop = top - setHeight
      setTimeout(() => {
        isSelfScrolling.current = false
      }, 50)
    }
  }

  return (
    <div className="space-y-1 flex-1 min-w-0">
      <span className="text-[10px] font-bold text-muted-foreground block text-center uppercase tracking-wider">
        {label}
      </span>
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="h-36 overflow-y-auto space-y-1 pr-1 border-r border-border snap-y snap-mandatory scroll-smooth relative no-scrollbar"
        style={{ scrollbarWidth: 'none' }}
      >
        {tripledItems.map((item, idx) => {
          const isSelected = item === selected
          return (
            <button
              key={`${item}-${idx}`}
              type="button"
              onClick={() => {
                onSelect(item)
                const container = containerRef.current
                if (container) {
                  const targetTop = setHeight + (idx % items.length) * ITEM_HEIGHT - (144 / 2 - ITEM_HEIGHT / 2)
                  container.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' })
                }
              }}
              className={cn(
                "w-full h-8 flex items-center justify-center rounded text-xs font-medium transition-all duration-150 snap-center shrink-0 cursor-pointer select-none",
                isSelected
                  ? "bg-emerald-500 text-white font-bold shadow-xs scale-105 z-10"
                  : "text-foreground hover:bg-secondary hover:text-emerald-500 opacity-80"
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

    // Parse incoming ISO value into Date, Hour (1-12), Minute (00-59), Period (AM/PM)
    const dateObj = React.useMemo(() => {
      if (!value) return new Date()
      const d = new Date(value)
      return isNaN(d.getTime()) ? new Date() : d
    }, [value])

    const parsedTime = React.useMemo(() => {
      if (!value) return { hour: "10", minute: "30", period: "AM" as const }
      const d = new Date(value)
      if (isNaN(d.getTime())) return { hour: "10", minute: "30", period: "AM" as const }
      let h = d.getHours()
      const period = h >= 12 ? ("PM" as const) : ("AM" as const)
      h = h % 12 || 12
      const pad = (n: number) => String(n).padStart(2, "0")
      return {
        hour: pad(h),
        minute: pad(d.getMinutes()),
        period,
      }
    }, [value])

    const [selectedHour, setSelectedHour] = React.useState(parsedTime.hour)
    const [selectedMinute, setSelectedMinute] = React.useState(parsedTime.minute)
    const [selectedPeriod, setSelectedPeriod] = React.useState<"AM" | "PM">(parsedTime.period)

    React.useEffect(() => {
      setSelectedHour(parsedTime.hour)
      setSelectedMinute(parsedTime.minute)
      setSelectedPeriod(parsedTime.period)
    }, [parsedTime])

    const handleDateSelect = (selectedDate?: Date) => {
      if (!selectedDate) return
      setDateOpen(false)
      const pad = (n: number) => String(n).padStart(2, "0")
      const datePart = `${selectedDate.getFullYear()}-${pad(selectedDate.getMonth() + 1)}-${pad(selectedDate.getDate())}`

      let h24 = parseInt(selectedHour, 10) % 12
      if (selectedPeriod === "PM") h24 += 12
      const timePart = `${pad(h24)}:${selectedMinute}`

      onChange?.(`${datePart}T${timePart}`)
    }

    const updateTime = (hStr: string, mStr: string, pStr: "AM" | "PM") => {
      setSelectedHour(hStr)
      setSelectedMinute(mStr)
      setSelectedPeriod(pStr)

      const pad = (n: number) => String(n).padStart(2, "0")
      const datePart = `${dateObj.getFullYear()}-${pad(dateObj.getMonth() + 1)}-${pad(dateObj.getDate())}`

      let h24 = parseInt(hStr, 10) % 12
      if (pStr === "PM") h24 += 12
      const timePart = `${pad(h24)}:${mStr}`

      onChange?.(`${datePart}T${timePart}`)
    }

    const formattedTimeDisplay = `${selectedHour}:${selectedMinute} ${selectedPeriod}`

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
                  className="w-full justify-between text-xs font-normal h-10 border-border bg-card text-foreground"
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
                  className="w-full justify-between text-xs font-normal h-10 border-border bg-card text-foreground"
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
                <div className="grid grid-cols-3 gap-2 h-44 items-center">
                  <InfiniteScrollColumn
                    label="Hour"
                    items={HOURS}
                    selected={selectedHour}
                    onSelect={(h) => updateTime(h, selectedMinute, selectedPeriod)}
                  />

                  <InfiniteScrollColumn
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
