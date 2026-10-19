import type * as React from "react"

/** Props a `render` element must support: ui components clone it and merge classNames, children, handlers. */
export type RenderableElementProps = {
  className?: string
  children?: React.ReactNode
  onClick?: React.MouseEventHandler<HTMLElement>
  onMouseEnter?: React.MouseEventHandler<HTMLElement>
  onMouseLeave?: React.MouseEventHandler<HTMLElement>
  onFocus?: React.FocusEventHandler<HTMLElement>
  onBlur?: React.FocusEventHandler<HTMLElement>
  [dataAttribute: `data-${string}`]: unknown
  [ariaAttribute: `aria-${string}`]: unknown
}

export type RenderableElement = React.ReactElement<RenderableElementProps>
