export interface WheelInput {
  deltaMode: number
  deltaY: number
  ctrlKey: boolean
}

/**
 * Zoom step of one wheel event. Firefox delivers the wheel in LINES (deltaMode 1) and
 * Chrome in pixels (0): in line mode every event is one notch and is worth what a notch is
 * worth in Chrome; pixel mode — the trackpad — stays proportional, which is what makes it
 * smooth. Page mode (2) is measured in canvas heights; `ctrlKey` is a pinch.
 */
export function wheelStep({ deltaMode, deltaY, ctrlKey }: WheelInput, { height = 600 }: { height?: number } = {}): number {
  const mult = ctrlKey ? 10 : 1
  if (deltaMode === 1) return -Math.sign(deltaY) * 0.2 * mult
  const px = deltaMode === 2 ? deltaY * height : deltaY
  return -Math.max(-120, Math.min(120, px)) * 0.002 * mult
}

/** A screen rectangle, as `getBoundingClientRect` reports it. */
export interface ScreenRect {
  top: number
  right: number
  bottom: number
  left: number
  width: number
}

export interface Rect {
  x0: number
  y0: number
  x1: number
  y1: number
}

export interface VisibleInput {
  width: number
  height: number
  stack?: ScreenRect | null
  north?: ScreenRect | null
  dock?: ScreenRect | null
}

/**
 * The hole the islands leave free on the canvas: the graph is fitted there. `stack`, `north`
 * and `dock` are screen rects or null. A stack wider than 60% of the canvas runs along the
 * bottom, otherwise along the left; a dock that covers the screen is not subtracted. A hole
 * too small to frame anything yields the canvas.
 */
export function visibleRect({ width, height, stack = null, north = null, dock = null }: VisibleInput, pad = 12): Rect {
  let x0 = pad
  let y0 = pad
  let x1 = width - pad
  let y1 = height - pad
  if (stack) {
    if (stack.width > width * 0.6) y1 = Math.min(y1, stack.top - pad)
    else x0 = Math.max(x0, stack.right + pad)
  }
  if (north) y0 = Math.max(y0, north.bottom + pad)
  if (dock && dock.width < width * 0.9) x1 = Math.min(x1, dock.left - pad)
  if (x1 - x0 < 120 || y1 - y0 < 120) return { x0: pad, y0: pad, x1: width - pad, y1: height - pad }
  return { x0, y0, x1, y1 }
}

export interface Frame {
  k: number
  cx: number
  cy: number
  vx: number
  vy: number
}

/**
 * Frame that shows every point inside `rect`: the scale `k` (the largest that fits, kept
 * within `minScale`..`maxScale`), the centre of the points' box (`cx`, `cy`) and the centre
 * of the rect (`vx`, `vy`) it must land on. Null when there is nothing to frame.
 */
export function frameFor(points: { x?: number; y?: number }[], rect: Rect, { pad = 40, maxScale = 2.4, minScale = 0.15 }: { pad?: number; maxScale?: number; minScale?: number } = {}): Frame | null {
  if (!points.length) return null
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const p of points) {
    const x = p.x ?? 0
    const y = p.y ?? 0
    x0 = Math.min(x0, x)
    y0 = Math.min(y0, y)
    x1 = Math.max(x1, x)
    y1 = Math.max(y1, y)
  }
  const vw = rect.x1 - rect.x0
  const vh = rect.y1 - rect.y0
  const w = Math.max(x1 - x0, 1)
  const h = Math.max(y1 - y0, 1)
  const k = Math.max(minScale, Math.min(maxScale, (vw - pad) / w, (vh - pad) / h))
  return { k, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, vx: rect.x0 + vw / 2, vy: rect.y0 + vh / 2 }
}
