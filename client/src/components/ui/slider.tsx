import * as React from "react"
import { cn } from "@/lib/utils"

export interface SliderProps extends Omit<React.ComponentProps<"div">, "defaultValue" | "onChange"> {
  value?: number[]
  defaultValue?: number[]
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  onValueChange?: (value: number[]) => void
  onValueCommit?: (value: number[]) => void
}

export const Slider = React.forwardRef<HTMLDivElement, SliderProps>(
  (
    {
      className,
      value: controlledValue,
      defaultValue = [0],
      min = 0,
      max = 100,
      step = 1,
      disabled = false,
      onValueChange,
      onValueCommit,
      ...props
    },
    ref
  ) => {
    const [uncontrolledValue, setUncontrolledValue] = React.useState<number[]>(defaultValue)
    const isControlled = controlledValue !== undefined
    const values = isControlled ? controlledValue : uncontrolledValue
    const currentVal = values[0] ?? min

    const clamp = React.useCallback(
      (val: number) => Math.min(Math.max(val, min), max),
      [min, max]
    )
    const percent = Math.max(0, Math.min(100, ((clamp(currentVal) - min) / (max - min)) * 100))

    const trackRef = React.useRef<HTMLDivElement>(null)

    const updateFromPointer = React.useCallback(
      (clientX: number) => {
        if (disabled || !trackRef.current) return
        const rect = trackRef.current.getBoundingClientRect()
        const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
        const raw = min + ratio * (max - min)
        const stepped = Math.round(raw / step) * step
        const clamped = clamp(stepped)
        const next = [clamped]
        if (!isControlled) setUncontrolledValue(next)
        onValueChange?.(next)
      },
      [disabled, min, max, step, isControlled, onValueChange, clamp]
    )

    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
      if (disabled) return
      e.currentTarget.setPointerCapture(e.pointerId)
      updateFromPointer(e.clientX)
    }

    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
      if (disabled || !e.currentTarget.hasPointerCapture(e.pointerId)) return
      updateFromPointer(e.clientX)
    }

    const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
      if (disabled) return
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId)
      }
      onValueCommit?.(values)
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (disabled) return
      let nextVal: number
      if (e.key === "ArrowRight" || e.key === "ArrowUp") {
        nextVal = clamp(currentVal + step)
      } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
        nextVal = clamp(currentVal - step)
      } else if (e.key === "Home") {
        nextVal = min
      } else if (e.key === "End") {
        nextVal = max
      } else {
        return
      }
      e.preventDefault()
      const next = [nextVal]
      if (!isControlled) setUncontrolledValue(next)
      onValueChange?.(next)
      onValueCommit?.(next)
    }

    return (
      <div
        ref={ref}
        data-slot="slider"
        role="group"
        className={cn(
          "relative flex w-full touch-none select-none items-center py-1 cursor-pointer",
          disabled && "opacity-50 cursor-not-allowed pointer-events-none",
          className
        )}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        {...props}
      >
        <div
          ref={trackRef}
          data-slot="slider-track"
          className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-secondary"
        >
          <div
            data-slot="slider-range"
            className="absolute h-full bg-primary rounded-full transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>
        <div
          role="slider"
          tabIndex={disabled ? -1 : 0}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={currentVal}
          onKeyDown={handleKeyDown}
          data-slot="slider-thumb"
          className="absolute block size-3.5 -translate-x-1/2 rounded-full border-2 border-primary bg-background shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          style={{ left: `${percent}%` }}
        />
      </div>
    )
  }
)
Slider.displayName = "Slider"
