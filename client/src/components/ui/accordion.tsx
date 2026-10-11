import * as React from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

interface AccordionContextValue {
  value: string[]
  onItemToggle: (itemValue: string) => void
  disabled?: boolean
}

const AccordionContext = React.createContext<AccordionContextValue | null>(null)

interface AccordionSingleProps extends React.ComponentProps<"div"> {
  type: "single"
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  collapsible?: boolean
  disabled?: boolean
}

interface AccordionMultipleProps extends React.ComponentProps<"div"> {
  type: "multiple"
  value?: string[]
  defaultValue?: string[]
  onValueChange?: (value: string[]) => void
  disabled?: boolean
}

type AccordionProps = AccordionSingleProps | AccordionMultipleProps

function Accordion({
  className,
  disabled,
  children,
  ...props
}: AccordionProps) {
  const isMultiple = props.type === "multiple"

  const [uncontrolledValue, setUncontrolledValue] = React.useState<string[]>(() => {
    if (isMultiple) {
      return (props as AccordionMultipleProps).defaultValue ?? []
    }
    const def = (props as AccordionSingleProps).defaultValue
    return def ? [def] : []
  })

  const isControlled = props.value !== undefined
  const activeValues = React.useMemo(() => {
    if (isControlled) {
      if (isMultiple) {
        return (props as AccordionMultipleProps).value ?? []
      }
      const val = (props as AccordionSingleProps).value
      return val ? [val] : []
    }
    return uncontrolledValue
  }, [isControlled, isMultiple, props, uncontrolledValue])

  const onItemToggle = React.useCallback(
    (itemValue: string) => {
      if (disabled) return

      if (isMultiple) {
        const next = activeValues.includes(itemValue)
          ? activeValues.filter((v) => v !== itemValue)
          : [...activeValues, itemValue]

        if (!isControlled) {
          setUncontrolledValue(next)
        }
        ;(props as AccordionMultipleProps).onValueChange?.(next)
      } else {
        const collapsible = (props as AccordionSingleProps).collapsible ?? true
        const isCurrentlyOpen = activeValues.includes(itemValue)

        let nextValue = ""
        if (isCurrentlyOpen) {
          if (collapsible) {
            nextValue = ""
          } else {
            return
          }
        } else {
          nextValue = itemValue
        }

        if (!isControlled) {
          setUncontrolledValue(nextValue ? [nextValue] : [])
        }
        ;(props as AccordionSingleProps).onValueChange?.(nextValue)
      }
    },
    [disabled, isMultiple, activeValues, isControlled, props]
  )

  return (
    <AccordionContext.Provider value={{ value: activeValues, onItemToggle, disabled }}>
      <div data-slot="accordion" className={cn("space-y-1", className)}>
        {children}
      </div>
    </AccordionContext.Provider>
  )
}

interface AccordionItemContextValue {
  value: string
  open: boolean
  disabled?: boolean
}

const AccordionItemContext = React.createContext<AccordionItemContextValue | null>(null)

function AccordionItem({
  value,
  disabled,
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  value: string
  disabled?: boolean
}) {
  const accordion = React.useContext(AccordionContext)
  const isOpen = accordion?.value.includes(value) ?? false
  const isDisabled = disabled || accordion?.disabled

  return (
    <AccordionItemContext.Provider value={{ value, open: isOpen, disabled: isDisabled }}>
      <div
        data-slot="accordion-item"
        data-state={isOpen ? "open" : "closed"}
        className={cn("border-b border-border last:border-b-0", className)}
        {...props}
      >
        {children}
      </div>
    </AccordionItemContext.Provider>
  )
}

function AccordionTrigger({
  className,
  children,
  onClick,
  ...props
}: React.ComponentProps<"button">) {
  const accordion = React.useContext(AccordionContext)
  const item = React.useContext(AccordionItemContext)

  if (!item) {
    throw new Error("AccordionTrigger must be used within an AccordionItem")
  }

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(e)
    if (!item.disabled) {
      accordion?.onItemToggle(item.value)
    }
  }

  return (
    <h3 className="flex">
      <button
        type="button"
        data-slot="accordion-trigger"
        data-state={item.open ? "open" : "closed"}
        aria-expanded={item.open}
        disabled={item.disabled}
        onClick={handleClick}
        className={cn(
          "flex flex-1 items-center justify-between py-3 text-sm font-medium transition-all hover:underline disabled:pointer-events-none disabled:opacity-50 [&[data-state=open]>svg]:rotate-180 cursor-pointer",
          className
        )}
        {...props}
      >
        {children}
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200" />
      </button>
    </h3>
  )
}

function AccordionContent({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  const item = React.useContext(AccordionItemContext)

  if (!item) {
    throw new Error("AccordionContent must be used within an AccordionItem")
  }

  if (!item.open) return null

  return (
    <div
      data-slot="accordion-content"
      data-state={item.open ? "open" : "closed"}
      className={cn("overflow-hidden text-sm transition-all pb-3 pt-0", className)}
      {...props}
    >
      {children}
    </div>
  )
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent }
