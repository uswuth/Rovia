import * as React from "react"
import { cn } from "@/lib/utils"
import { type RenderableElementProps } from "@/lib/render"

interface TooltipProviderContextType {
  delayDuration: number
}

const TooltipProviderContext = React.createContext<TooltipProviderContextType>({
  delayDuration: 150,
})

interface TooltipContextType {
  open: boolean
  setOpen: (open: boolean) => void
  show: () => void
  hide: () => void
}

const TooltipContext = React.createContext<TooltipContextType | null>(null)

function TooltipProvider({
  children,
  delayDuration = 150,
}: {
  children: React.ReactNode
  delayDuration?: number
}) {
  return (
    <TooltipProviderContext.Provider value={{ delayDuration }}>
      {children}
    </TooltipProviderContext.Provider>
  )
}

function Tooltip({
  children,
  content,
  side = "top",
  align = "center",
  className,
  delayDuration,
  disabled = false,
  ...props
}: {
  children: React.ReactNode
  content?: React.ReactNode
  side?: "top" | "right" | "bottom" | "left"
  align?: "start" | "center" | "end"
  className?: string
  delayDuration?: number
  disabled?: boolean
} & React.ComponentProps<"div">) {
  const providerDelay = React.useContext(TooltipProviderContext)?.delayDuration ?? 150
  const delay = delayDuration ?? providerDelay
  const [open, setOpen] = React.useState(false)
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const show = React.useCallback(() => {
    if (disabled) return
    if (timerRef.current) clearTimeout(timerRef.current)
    if (delay <= 0) {
      setOpen(true)
    } else {
      timerRef.current = setTimeout(() => setOpen(true), delay)
    }
  }, [delay, disabled])

  const hide = React.useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setOpen(false)
  }, [])

  React.useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const contextValue = React.useMemo(() => ({ open: disabled ? false : open, setOpen, show, hide }), [open, show, hide, disabled])

  if (!disabled && Boolean(content)) {
    return (
      <TooltipContext.Provider value={contextValue}>
        <div className={cn("relative inline-flex items-center justify-center shrink-0", className)} {...props}>
          <TooltipTrigger asChild>{children}</TooltipTrigger>
          <TooltipContent side={side} align={align}>{content}</TooltipContent>
        </div>
      </TooltipContext.Provider>
    )
  }

  return (
    <TooltipContext.Provider value={contextValue}>
      <div className={cn("relative inline-flex items-center justify-center shrink-0", className)} {...props}>{children}</div>
    </TooltipContext.Provider>
  )
}

function TooltipTrigger({
  children,
  className,
  asChild,
  ...props
}: React.ComponentProps<"button"> & { asChild?: boolean }) {
  const ctx = React.useContext(TooltipContext)

  const handleMouseEnter = () => ctx?.show()
  const handleMouseLeave = () => ctx?.hide()
  const handleFocus = () => ctx?.show()
  const handleBlur = () => ctx?.hide()

  if (asChild && React.isValidElement<RenderableElementProps>(children)) {
    const child = children
    return React.cloneElement(child, {
      onMouseEnter: (e: React.MouseEvent<HTMLElement>) => {
        child.props?.onMouseEnter?.(e)
        handleMouseEnter()
      },
      onMouseLeave: (e: React.MouseEvent<HTMLElement>) => {
        child.props?.onMouseLeave?.(e)
        handleMouseLeave()
      },
      onFocus: (e: React.FocusEvent<HTMLElement>) => {
        child.props?.onFocus?.(e)
        handleFocus()
      },
      onBlur: (e: React.FocusEvent<HTMLElement>) => {
        child.props?.onBlur?.(e)
        handleBlur()
      },
      onClick: (e: React.MouseEvent<HTMLElement>) => {
        child.props?.onClick?.(e)
        ctx?.hide()
      },
    })
  }

  return (
    <button
      type="button"
      className={cn("inline-flex items-center justify-center", className)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onClick={(e) => {
        props.onClick?.(e)
        ctx?.hide()
      }}
      {...props}
    >
      {children}
    </button>
  )
}

function TooltipContent({
  className,
  side = "top",
  align = "center",
  hidden = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  side?: "top" | "right" | "bottom" | "left"
  align?: "start" | "center" | "end"
  hidden?: boolean
}) {
  const ctx = React.useContext(TooltipContext)
  if (!ctx?.open || hidden || !children) return null

  const getPositionClass = () => {
    if (side === "top") {
      if (align === "end") return "bottom-full right-0 mb-2"
      if (align === "start") return "bottom-full left-0 mb-2"
      return "bottom-full left-1/2 -translate-x-1/2 mb-2"
    }
    if (side === "bottom") {
      if (align === "end") return "top-full right-0 mt-2"
      if (align === "start") return "top-full left-0 mt-2"
      return "top-full left-1/2 -translate-x-1/2 mt-2"
    }
    if (side === "left") {
      if (align === "start") return "right-full top-0 mr-2"
      if (align === "end") return "right-full bottom-0 mr-2"
      return "right-full top-1/2 -translate-y-1/2 mr-2"
    }
    if (side === "right") {
      if (align === "start") return "left-full top-0 ml-2"
      if (align === "end") return "left-full bottom-0 ml-2"
      return "left-full top-1/2 -translate-y-1/2 ml-2"
    }
    return "bottom-full left-1/2 -translate-x-1/2 mb-2"
  }

  return (
    <div
      data-slot="tooltip-content"
      role="tooltip"
      className={cn(
        "absolute z-[100] whitespace-nowrap rounded-sm bg-zinc-900 border border-zinc-800 px-2.5 py-1 text-[11px] font-medium text-zinc-100 shadow-md animate-in fade-in-0 zoom-in-95 pointer-events-none select-none dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100",
        getPositionClass(),
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
