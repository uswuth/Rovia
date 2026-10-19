import * as React from "react"
import { cn, type VariantProps } from "@/lib/utils"
import { badgeVariants } from "./badge-variants"

// VariantProps omits className/class, which would clash with the span's own className prop.
export interface BadgeProps
  extends React.ComponentProps<"span">,
    VariantProps<typeof badgeVariants> {}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, tone, ...props }, ref) => (
    <span
      ref={ref}
      data-slot="badge"
      className={cn(badgeVariants({ tone }), className)}
      {...props}
    />
  )
)
Badge.displayName = "Badge"

export { Badge }
