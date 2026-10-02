import * as React from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export interface SelectOption<T extends string = string> {
  value: T
  label: string
}

/**
 * Universal Select component powered by Shadcn UI DropdownMenu & DropdownMenuRadioGroup.
 * Integrates with React Hook Form while using Shadcn's RadioGroup design.
 */
const Select = React.forwardRef<
  HTMLSelectElement,
  Omit<React.ComponentProps<"select">, "children"> & {
    options: SelectOption[]
    wrapperClassName?: string
  }
>(
  (
    { className, options, wrapperClassName, value: controlledValue, defaultValue, onChange, name, id, disabled, ...props },
    ref
  ) => {
    const [internalValue, setInternalValue] = React.useState<string>(
      String(controlledValue ?? defaultValue ?? options[0]?.value ?? "")
    )

    React.useEffect(() => {
      if (controlledValue !== undefined) {
        setInternalValue(String(controlledValue))
      }
    }, [controlledValue])

    const selectedOption = options.find((opt) => String(opt.value) === String(internalValue)) || options[0]

    const hiddenSelectRef = React.useRef<HTMLSelectElement | null>(null)
    React.useImperativeHandle(ref, () => hiddenSelectRef.current as HTMLSelectElement)

    const handleValueChange = (val: string) => {
      setInternalValue(val)
      const target = hiddenSelectRef.current
      if (target) {
        target.value = val
        const event = new Event("change", { bubbles: true })
        target.dispatchEvent(event)
        if (onChange) {
          const synthEvent = {
            ...event,
            target,
            currentTarget: target,
          } as unknown as React.ChangeEvent<HTMLSelectElement>
          onChange(synthEvent)
        }
      }
    }

    return (
      <div className={cn("relative w-full", wrapperClassName)}>
        <select
          ref={hiddenSelectRef}
          id={id}
          name={name}
          value={internalValue}
          onChange={onChange}
          tabIndex={-1}
          aria-hidden="true"
          className="sr-only"
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                disabled={disabled}
                className={cn(
                  "h-10 w-full flex items-center justify-between rounded-md border border-border bg-card px-3 text-xs font-medium text-foreground shadow-xs transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
                  className
                )}
              >
                <span className="truncate">{selectedOption?.label || "Select..."}</span>
                <ChevronDown size={14} className="text-muted-foreground shrink-0 ml-2" />
              </button>
            }
          />
          <DropdownMenuContent className="w-full min-w-[200px] max-h-60 overflow-y-auto">
            <DropdownMenuGroup>
              <DropdownMenuRadioGroup value={internalValue} onValueChange={handleValueChange}>
                {options.map((option) => (
                  <DropdownMenuRadioItem key={option.value} value={String(option.value)}>
                    {option.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    )
  }
)
Select.displayName = "Select"

export { Select }
