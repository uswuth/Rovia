import * as React from "react"
import { cn } from "@/lib/utils"
import type { RenderableElement } from "@/lib/render"

interface PopoverContextType {
  open: boolean
  setOpen: (open: boolean | ((prev: boolean) => boolean)) => void
}

const PopoverContext = React.createContext<PopoverContextType>({
  open: false,
  setOpen: () => {},
})

export function Popover({
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  children,
}: {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen)
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : uncontrolledOpen

  const setOpen = React.useCallback(
    (next: boolean | ((prev: boolean) => boolean)) => {
      const nextVal = typeof next === "function" ? next(open) : next
      if (!isControlled) {
        setUncontrolledOpen(nextVal)
      }
      onOpenChange?.(nextVal)
    },
    [isControlled, open, onOpenChange]
  )

  return (
    <PopoverContext.Provider value={{ open, setOpen }}>
      <div className="relative inline-block text-left w-full">{children}</div>
    </PopoverContext.Provider>
  )
}

export function PopoverTrigger({
  children,
  className,
  render,
  ...props
}: React.ComponentProps<"button"> & { render?: RenderableElement }) {
  const { open, setOpen } = React.useContext(PopoverContext)

  const toggleOpen = React.useCallback(() => {
    setOpen((prev) => !prev)
  }, [setOpen])

  if (render) {
    return React.cloneElement(render, {
      ...props,
      onClick: (e: React.MouseEvent<any>) => {
        e.stopPropagation()
        props.onClick?.(e)
        render.props?.onClick?.(e)
        toggleOpen()
      },
      onMouseEnter: (e: React.MouseEvent<any>) => {
        props.onMouseEnter?.(e)
        render.props?.onMouseEnter?.(e)
      },
      onMouseLeave: (e: React.MouseEvent<any>) => {
        props.onMouseLeave?.(e)
        render.props?.onMouseLeave?.(e)
      },
      onFocus: (e: React.FocusEvent<any>) => {
        props.onFocus?.(e)
        render.props?.onFocus?.(e)
      },
      onBlur: (e: React.FocusEvent<any>) => {
        props.onBlur?.(e)
        render.props?.onBlur?.(e)
      },
      "aria-expanded": open,
      className: cn(render.props?.className, className),
    })
  }

  return (
    <button
      type="button"
      data-slot="popover-trigger"
      aria-expanded={open}
      className={cn("outline-none", className)}
      onClick={toggleOpen}
      {...props}
    >
      {children}
    </button>
  )
}

export function PopoverContent({
  className,
  children,
  align = "start",
  side = "bottom",
  sideOffset = 4,
  closeOnClickOutside = true,
  ...props
}: React.ComponentProps<"div"> & {
  align?: "start" | "center" | "end"
  side?: "top" | "bottom" | "left" | "right"
  sideOffset?: number
  closeOnClickOutside?: boolean
}) {
  const { open, setOpen } = React.useContext(PopoverContext)
  const contentRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!closeOnClickOutside) return
      if (contentRef.current && !contentRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }

    if (open) {
      document.addEventListener("mousedown", handleClickOutside)
      document.addEventListener("keydown", handleKeyDown)
      return () => {
        document.removeEventListener("mousedown", handleClickOutside)
        document.removeEventListener("keydown", handleKeyDown)
      }
    }
  }, [open, setOpen, closeOnClickOutside])

  if (!open) return null

  const alignClasses = {
    start: "left-0",
    center: "left-1/2 -translate-x-1/2",
    end: "right-0",
  }

  const sideClasses = {
    top: "bottom-full mb-2",
    bottom: "top-full mt-2",
    left: "right-full mr-2",
    right: "left-full ml-2",
  }

  return (
    <div
      ref={contentRef}
      data-slot="popover-content"
      style={
        side === "top"
          ? { marginBottom: `${sideOffset}px` }
          : side === "bottom"
          ? { marginTop: `${sideOffset}px` }
          : undefined
      }
      className={cn(
        "absolute z-50 rounded-lg border border-border bg-card p-3 text-card-foreground shadow-xl outline-none animate-in fade-in-0 zoom-in-95",
        sideClasses[side] || sideClasses.bottom,
        alignClasses[align],
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}
