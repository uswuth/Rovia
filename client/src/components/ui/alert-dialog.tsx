import * as React from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface AlertDialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  size?: "sm" | "md" | "lg"
  children: React.ReactNode
}

interface AlertDialogContextType {
  open: boolean
  setOpen: (open: boolean) => void
}

const AlertDialogContext = React.createContext<AlertDialogContextType | null>(null)

export function AlertDialog({
  open: controlledOpen,
  onOpenChange,
  children,
}: AlertDialogProps) {
  const [internalOpen, setInternalOpen] = React.useState(false)
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : internalOpen

  const setOpen = React.useCallback(
    (value: boolean) => {
      if (!isControlled) setInternalOpen(value)
      onOpenChange?.(value)
    },
    [isControlled, onOpenChange]
  )

  return (
    <AlertDialogContext.Provider value={{ open, setOpen }}>
      {children}
    </AlertDialogContext.Provider>
  )
}

export function AlertDialogTrigger({
  children,
  ...props
}: React.ComponentProps<"button"> & { asChild?: boolean }) {
  const ctx = React.useContext(AlertDialogContext)

  return (
    <button
      type="button"
      onClick={() => ctx?.setOpen(true)}
      {...props}
    >
      {children}
    </button>
  )
}

export function AlertDialogContent({
  className,
  overlayClassName,
  children,
  ...props
}: React.ComponentProps<"div"> & { overlayClassName?: string }) {
  const ctx = React.useContext(AlertDialogContext)
  const panelRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!ctx?.open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") ctx.setOpen(false)
    }
    document.addEventListener("keydown", onKeyDown)
    const { overflow } = document.body.style
    document.body.style.overflow = "hidden"
    panelRef.current?.focus()
    return () => {
      document.removeEventListener("keydown", onKeyDown)
      document.body.style.overflow = overflow
    }
  }, [ctx])

  if (!ctx?.open) return null

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center p-4",
        overlayClassName ?? "bg-transparent"
      )}
      onClick={() => ctx.setOpen(false)}
    >
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        className={cn(
          "w-full max-w-sm space-y-4 rounded-xl border border-border bg-card p-5 shadow-2xl outline-none animate-in zoom-in-95",
          className
        )}
        {...props}
      >
        {children}
      </div>
    </div>
  )
}

export function AlertDialogHeader({ className, children, ...props }: React.ComponentProps<"div">) {
  return (
    <div className={cn("space-y-2 text-center sm:text-left", className)} {...props}>
      {children}
    </div>
  )
}

export function AlertDialogMedia({ className, children, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "mx-auto sm:mx-0 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-destructive shrink-0 mb-3",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export function AlertDialogTitle({ className, children, ...props }: React.ComponentProps<"h2">) {
  return (
    <h2 className={cn("text-lg font-bold text-foreground tracking-tight", className)} {...props}>
      {children}
    </h2>
  )
}

export function AlertDialogDescription({ className, children, ...props }: React.ComponentProps<"p">) {
  return (
    <p className={cn("text-xs text-muted-foreground leading-relaxed", className)} {...props}>
      {children}
    </p>
  )
}

export function AlertDialogFooter({ className, children, ...props }: React.ComponentProps<"div">) {
  return (
    <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-3", className)} {...props}>
      {children}
    </div>
  )
}

export function AlertDialogCancel({
  className,
  variant = "outline",
  children,
  onClick,
  ...props
}: React.ComponentProps<typeof Button>) {
  const ctx = React.useContext(AlertDialogContext)
  return (
    <Button
      type="button"
      variant={variant}
      onClick={(e) => {
        onClick?.(e)
        ctx?.setOpen(false)
      }}
      className={className}
      {...props}
    >
      {children}
    </Button>
  )
}

export function AlertDialogAction({
  className,
  variant = "destructive",
  children,
  onClick,
  ...props
}: React.ComponentProps<typeof Button>) {
  const ctx = React.useContext(AlertDialogContext)
  return (
    <Button
      type="button"
      variant={variant}
      onClick={(e) => {
        onClick?.(e)
        ctx?.setOpen(false)
      }}
      className={className}
      {...props}
    >
      {children}
    </Button>
  )
}

export { ConfirmDialog, type ConfirmDialogProps } from "./confirm-dialog"
