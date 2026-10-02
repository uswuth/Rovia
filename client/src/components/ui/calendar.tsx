import * as React from "react"
import { DayPicker } from "react-day-picker"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3 bg-card border-border text-foreground", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        caption: "flex justify-center pt-1 relative items-center h-8",
        caption_label: "text-xs font-bold text-foreground text-center",
        nav: "space-x-1 flex items-center",
        nav_button: cn(
          "h-7 w-7 bg-transparent p-0 opacity-70 hover:opacity-100 flex items-center justify-center rounded-md border border-border hover:bg-secondary text-foreground"
        ),
        nav_button_previous: "absolute left-1 top-1",
        nav_button_next: "absolute right-1 top-1",
        table: "w-full border-collapse space-y-1",
        head_row: "flex",
        head_cell: "text-muted-foreground rounded-md w-8 font-normal text-[0.8rem]",
        row: "flex w-full mt-2",
        cell: cn(
          "relative p-0 text-center text-xs focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-accent"
        ),
        day: cn(
          "h-8 w-8 p-0 font-normal aria-selected:opacity-100 rounded-md hover:bg-secondary hover:text-foreground flex items-center justify-center text-xs text-foreground"
        ),
        day_selected:
          "bg-emerald-500 text-white hover:bg-emerald-600 hover:text-white font-bold focus:bg-emerald-500 focus:text-white",
        day_today: "bg-secondary text-emerald-500 font-bold",
        day_outside: "text-muted-foreground opacity-40",
        day_disabled: "text-muted-foreground opacity-30 cursor-not-allowed",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: () => <ChevronLeft className="h-4 w-4 text-foreground" />,
        IconRight: () => <ChevronRight className="h-4 w-4 text-foreground" />,
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
