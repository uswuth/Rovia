import * as React from "react"
import { cn } from "@/lib/utils"
import { ChevronDown } from "lucide-react"

import {
  MessageScrollerContext,
  type MessageScrollerContextValue,
} from "@/context/MessageScrollerContext"

export type { MessageScrollerContextValue }

export interface MessageScrollerProviderProps {
  children: React.ReactNode
  autoScroll?: boolean
  defaultScrollPosition?: "start" | "end" | "last-anchor"
  scrollEdgeThreshold?: number
  scrollMargin?: number
  scrollPreviousItemPeek?: number
}

function MessageScrollerProvider({
  children,
  autoScroll = true,
  defaultScrollPosition = "end",
  scrollEdgeThreshold = 36,
}: MessageScrollerProviderProps) {
  const viewportRef = React.useRef<HTMLDivElement | null>(null)
  const contentRef = React.useRef<HTMLDivElement | null>(null)
  const [scrollable, setScrollable] = React.useState({ start: false, end: false })
  const [isAutoScrolling, setIsAutoScrolling] = React.useState(false)
  const [isPendingScroll, setIsPendingScroll] = React.useState(true)
  const [currentAnchorId] = React.useState<string | null>(null)
  const [visibleMessageIds] = React.useState<string[]>([])
  const isAtBottomRef = React.useRef(true)

  const updateScrollState = React.useCallback(() => {
    const el = viewportRef.current
    if (!el) return

    const { scrollTop, scrollHeight, clientHeight } = el
    const maxScroll = scrollHeight - clientHeight
    const hasOverflow = maxScroll > 2

    const atStart = !hasOverflow || scrollTop <= scrollEdgeThreshold
    const atEnd = !hasOverflow || maxScroll - scrollTop <= scrollEdgeThreshold

    isAtBottomRef.current = atEnd

    setScrollable((prev) => {
      const nextStart = hasOverflow && !atStart
      const nextEnd = hasOverflow && !atEnd
      if (prev.start === nextStart && prev.end === nextEnd) {
        return prev
      }
      return { start: nextStart, end: nextEnd }
    })
  }, [scrollEdgeThreshold])

  const scrollToEnd = React.useCallback(
    (options?: { behavior?: ScrollBehavior }): boolean => {
      const el = viewportRef.current
      if (!el) return false
      setIsAutoScrolling(true)
      const behavior = options?.behavior ?? "smooth"
      el.scrollTo({
        top: el.scrollHeight,
        behavior,
      })
      setTimeout(() => {
        setIsAutoScrolling(false)
        updateScrollState()
      }, 350)
      return true
    },
    [updateScrollState]
  )

  const scrollToStart = React.useCallback(
    (options?: { behavior?: ScrollBehavior }): boolean => {
      const el = viewportRef.current
      if (!el) return false
      const behavior = options?.behavior ?? "smooth"
      el.scrollTo({
        top: 0,
        behavior,
      })
      setTimeout(() => updateScrollState(), 350)
      return true
    },
    [updateScrollState]
  )

  const scrollToMessage = React.useCallback(
    (
      messageId: string,
      options?: {
        align?: "start" | "center" | "end" | "nearest"
        behavior?: ScrollBehavior
      }
    ): boolean => {
      const el = viewportRef.current
      if (!el) return false
      const target = el.querySelector(`[data-message-id="${messageId}"]`) as HTMLElement | null
      if (!target) return false

      target.scrollIntoView({
        behavior: options?.behavior ?? "smooth",
        block: options?.align === "center" ? "center" : options?.align === "end" ? "end" : "start",
      })
      setTimeout(() => updateScrollState(), 350)
      return true
    },
    [updateScrollState]
  )

  // Initial scroll positioning
  React.useEffect(() => {
    const el = viewportRef.current
    if (!el) return

    const performInitialScroll = () => {
      if (defaultScrollPosition === "end" || defaultScrollPosition === "last-anchor") {
        el.scrollTop = el.scrollHeight
      } else {
        el.scrollTop = 0
      }
      setIsPendingScroll(false)
      updateScrollState()
    }

    const frameId = requestAnimationFrame(performInitialScroll)
    return () => cancelAnimationFrame(frameId)
  }, [defaultScrollPosition, updateScrollState])

  // Observe content mutations to auto-scroll if at bottom
  React.useEffect(() => {
    const content = contentRef.current
    if (!content) return

    const observer = new MutationObserver(() => {
      if (autoScroll && isAtBottomRef.current) {
        const el = viewportRef.current
        if (el) {
          el.scrollTop = el.scrollHeight
        }
      }
      updateScrollState()
    })

    observer.observe(content, { childList: true, subtree: true, characterData: true })
    return () => observer.disconnect()
  }, [autoScroll, updateScrollState])

  const contextValue = React.useMemo<MessageScrollerContextValue>(
    () => ({
      viewportRef,
      contentRef,
      scrollable,
      isAutoScrolling,
      isPendingScroll,
      scrollToEnd,
      scrollToStart,
      scrollToMessage,
      currentAnchorId,
      visibleMessageIds,
      updateScrollState,
    }),
    [
      scrollable,
      isAutoScrolling,
      isPendingScroll,
      scrollToEnd,
      scrollToStart,
      scrollToMessage,
      currentAnchorId,
      visibleMessageIds,
      updateScrollState,
    ]
  )

  return (
    <MessageScrollerContext.Provider value={contextValue}>
      {children}
    </MessageScrollerContext.Provider>
  )
}

export type MessageScrollerRootProps = React.ComponentProps<"div">

function MessageScrollerRoot({ className, children, ...props }: MessageScrollerRootProps) {
  const ctx = React.useContext(MessageScrollerContext)
  const scrollable = ctx?.scrollable
  const scrollableAttr = scrollable
    ? scrollable.start && scrollable.end
      ? "start end"
      : scrollable.start
      ? "start"
      : scrollable.end
      ? "end"
      : undefined
    : undefined

  return (
    <div
      data-slot="message-scroller-root"
      data-scrollable={scrollableAttr}
      data-autoscrolling={ctx?.isAutoScrolling ? "" : undefined}
      data-pending-scroll={ctx?.isPendingScroll ? "" : undefined}
      className={cn("relative flex flex-1 flex-col overflow-hidden min-h-0 w-full", className)}
      {...props}
    >
      {children}
    </div>
  )
}

export interface MessageScrollerViewportProps extends React.ComponentProps<"div"> {
  preserveScrollOnPrepend?: boolean
}

function MessageScrollerViewport({
  className,
  children,
  role = "region",
  "aria-label": ariaLabel = "Messages",
  tabIndex = 0,
  ...props
}: MessageScrollerViewportProps) {
  const ctx = React.useContext(MessageScrollerContext)

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    props.onScroll?.(e)
    ctx?.updateScrollState()
  }

  return (
    <div
      ref={ctx?.viewportRef}
      role={role}
      aria-label={ariaLabel}
      tabIndex={tabIndex}
      data-slot="message-scroller-viewport"
      data-scrollable={
        ctx
          ? ctx.scrollable.start && ctx.scrollable.end
            ? "start end"
            : ctx.scrollable.start
            ? "start"
            : ctx.scrollable.end
            ? "end"
            : undefined
          : undefined
      }
      data-pending-scroll={ctx?.isPendingScroll ? "" : undefined}
      onScroll={handleScroll}
      className={cn(
        "flex flex-1 flex-col overflow-y-auto overscroll-contain select-text outline-none no-scrollbar",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export type MessageScrollerContentProps = React.ComponentProps<"div">

function MessageScrollerContent({
  className,
  children,
  role = "log",
  "aria-relevant": ariaRelevant = "additions",
  ...props
}: MessageScrollerContentProps) {
  const ctx = React.useContext(MessageScrollerContext)

  return (
    <div
      ref={ctx?.contentRef}
      role={role}
      aria-relevant={ariaRelevant}
      data-slot="message-scroller-content"
      className={cn("flex flex-col gap-3 p-1 min-h-full", className)}
      {...props}
    >
      {children}
    </div>
  )
}

export interface MessageScrollerItemProps extends React.ComponentProps<"div"> {
  messageId?: string
  scrollAnchor?: boolean
}

function MessageScrollerItem({
  messageId,
  scrollAnchor = false,
  className,
  children,
  ...props
}: MessageScrollerItemProps) {
  return (
    <div
      data-slot="message-scroller-item"
      data-message-id={messageId}
      data-scroll-anchor={scrollAnchor ? "true" : "false"}
      className={cn("w-full transition-all", className)}
      {...props}
    >
      {children}
    </div>
  )
}

export interface MessageScrollerButtonProps extends React.ComponentProps<"button"> {
  behavior?: ScrollBehavior
  direction?: "start" | "end"
  render?: React.ReactElement
}

function MessageScrollerButton({
  behavior = "smooth",
  direction = "end",
  className,
  children,
  ...props
}: MessageScrollerButtonProps) {
  const ctx = React.useContext(MessageScrollerContext)
  const isEnd = direction === "end"
  const canScroll = ctx ? (isEnd ? ctx.scrollable.end : ctx.scrollable.start) : false

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    props.onClick?.(e)
    if (!ctx) return
    if (isEnd) {
      ctx.scrollToEnd({ behavior })
    } else {
      ctx.scrollToStart({ behavior })
    }
  }

  const defaultChild = (
    <span className="inline-flex items-center gap-1.5 shadow-md">
      <ChevronDown size={14} className="shrink-0" />
      <span>Jump to latest</span>
    </span>
  )

  const content = children || defaultChild

  return (
    <button
      type="button"
      data-slot="message-scroller-button"
      data-direction={direction}
      data-active={canScroll ? "true" : "false"}
      disabled={!canScroll}
      onClick={handleClick}
      aria-hidden={!canScroll}
      className={cn(
        "absolute bottom-2 left-1/2 z-20 -translate-x-1/2 rounded-full border border-border bg-card/95 hover:bg-secondary text-foreground px-3 py-1.5 text-xs font-semibold shadow-lg backdrop-blur-xs transition-all duration-200 cursor-pointer select-none",
        canScroll
          ? "opacity-100 translate-y-0 pointer-events-auto visible"
          : "opacity-0 translate-y-2 pointer-events-none invisible pointer-events-none",
        className
      )}
      {...props}
    >
      {content}
    </button>
  )
}

export const MessageScroller = {
  Provider: MessageScrollerProvider,
  Root: MessageScrollerRoot,
  Viewport: MessageScrollerViewport,
  Content: MessageScrollerContent,
  Item: MessageScrollerItem,
  Button: MessageScrollerButton,
}
