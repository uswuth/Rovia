import * as React from "react"

export interface MessageScrollerContextValue {
  viewportRef: React.RefObject<HTMLDivElement | null>
  contentRef: React.RefObject<HTMLDivElement | null>
  scrollable: { start: boolean; end: boolean }
  isAutoScrolling: boolean
  isPendingScroll: boolean
  scrollToEnd: (options?: { behavior?: ScrollBehavior }) => boolean
  scrollToStart: (options?: { behavior?: ScrollBehavior }) => boolean
  scrollToMessage: (
    messageId: string,
    options?: {
      align?: "start" | "center" | "end" | "nearest"
      behavior?: ScrollBehavior
    }
  ) => boolean
  currentAnchorId: string | null
  visibleMessageIds: string[]
  updateScrollState: () => void
}

export const MessageScrollerContext = React.createContext<MessageScrollerContextValue | null>(null)

export function useMessageScroller(): Pick<
  MessageScrollerContextValue,
  "scrollToEnd" | "scrollToStart" | "scrollToMessage"
> {
  const ctx = React.useContext(MessageScrollerContext)
  if (!ctx) {
    return {
      scrollToEnd: () => false,
      scrollToStart: () => false,
      scrollToMessage: () => false,
    }
  }
  return {
    scrollToEnd: ctx.scrollToEnd,
    scrollToStart: ctx.scrollToStart,
    scrollToMessage: ctx.scrollToMessage,
  }
}

export function useMessageScrollerScrollable(): { start: boolean; end: boolean } {
  const ctx = React.useContext(MessageScrollerContext)
  return ctx?.scrollable ?? { start: false, end: false }
}

export function useMessageScrollerVisibility(): {
  currentAnchorId: string | null
  visibleMessageIds: string[]
} {
  const ctx = React.useContext(MessageScrollerContext)
  return {
    currentAnchorId: ctx?.currentAnchorId ?? null,
    visibleMessageIds: ctx?.visibleMessageIds ?? [],
  }
}
