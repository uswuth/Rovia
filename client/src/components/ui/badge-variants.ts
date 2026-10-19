import { cva, type VariantProps } from "@/lib/utils"

/** Status tones describe data states, never brand colors; the app's single accent stays emerald. */
export const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-[11px] font-medium capitalize whitespace-nowrap",
  {
    variants: {
      tone: {
        neutral: "border-border/80 bg-secondary/80 text-foreground/80 dark:text-muted-foreground",
        success: "border-primary/30 bg-primary/15 text-primary dark:text-primary font-medium",
        warning: "border-amber-500/30 bg-amber-500/15 text-amber-700 dark:text-amber-400 font-medium",
        info: "border-blue-500/30 bg-blue-500/15 text-blue-700 dark:text-blue-400 font-medium",
        accent: "border-purple-500/30 bg-purple-500/15 text-purple-700 dark:text-purple-300 font-medium",
        danger: "border-red-500/30 bg-red-500/15 text-red-700 dark:text-red-400 font-medium",
      },
    },
    defaultVariants: {
      tone: "neutral",
    },
  }
)

export type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>["tone"]>
