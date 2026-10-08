import * as React from "react"
import { cn } from "@/lib/utils"
import { getAvatarColorByName } from "@/components/ui/avatar-colors"

interface AvatarContextType {
  imageLoaded: boolean
  setImageLoaded: (loaded: boolean) => void
}

const AvatarContext = React.createContext<AvatarContextType>({
  imageLoaded: false,
  setImageLoaded: () => {},
})

function Avatar({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  const [imageLoaded, setImageLoaded] = React.useState(false)

  return (
    <AvatarContext.Provider value={{ imageLoaded, setImageLoaded }}>
      <div
        data-slot="avatar"
        className={cn(
          "relative flex size-8 shrink-0 overflow-hidden rounded-full",
          className
        )}
        {...props}
      >
        {children}
      </div>
    </AvatarContext.Provider>
  )
}

function AvatarImage({
  className,
  src,
  alt = "",
  ...props
}: React.ComponentProps<"img">) {
  const { setImageLoaded } = React.useContext(AvatarContext)

  if (!src) return null

  return (
    <img
      data-slot="avatar-image"
      src={src}
      alt={alt}
      onLoad={() => setImageLoaded(true)}
      onError={() => setImageLoaded(false)}
      className={cn("aspect-square size-full object-cover", className)}
      {...props}
    />
  )
}

interface AvatarFallbackProps extends React.ComponentProps<"div"> {
  name?: string
}

function AvatarFallback({
  className,
  children,
  name,
  ...props
}: AvatarFallbackProps) {
  const { imageLoaded } = React.useContext(AvatarContext)

  if (imageLoaded) return null

  const nameToUse = name || (typeof children === "string" ? children : "") || ""
  const defaultColorClass = getAvatarColorByName(nameToUse)
  const fallbackText = children !== undefined ? children : (nameToUse ? nameToUse.trim().charAt(0).toUpperCase() : "U")

  return (
    <div
      data-slot="avatar-fallback"
      className={cn(
        "flex size-full items-center justify-center rounded-full font-bold select-none text-xs",
        defaultColorClass,
        className
      )}
      {...props}
    >
      {fallbackText}
    </div>
  )
}

function AvatarGroup({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="avatar-group"
      className={cn(
        "flex items-center -space-x-2 *:ring-2 *:ring-background *:rounded-full",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

function AvatarGroupCount({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="avatar-group-count"
      className={cn(
        "relative flex size-8 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-xs font-semibold text-zinc-200 ring-2 ring-background font-mono",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export { Avatar, AvatarImage, AvatarFallback, AvatarGroup, AvatarGroupCount }
