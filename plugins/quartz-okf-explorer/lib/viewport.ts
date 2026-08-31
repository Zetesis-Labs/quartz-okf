/**
 * Zoom step of one wheel event. Firefox delivers the wheel in LINES (deltaMode 1) and
 * Chrome in pixels (0): in line mode every event is one notch and is worth what a notch is
 * worth in Chrome; pixel mode — the trackpad — stays proportional, which is what makes it
 * smooth. Page mode (2) is measured in canvas heights; `ctrlKey` is a pinch.
 */
export function wheelStep({ deltaMode, deltaY, ctrlKey }, { height = 600 } = {}) {
  const mult = ctrlKey ? 10 : 1
  if (deltaMode === 1) return -Math.sign(deltaY) * 0.2 * mult
  const px = deltaMode === 2 ? deltaY * height : deltaY
  return -Math.max(-120, Math.min(120, px)) * 0.002 * mult
}

/**
 * The hole the islands leave free on the canvas: the graph is fitted there. `stack`, `north`
 * and `dock` are screen rects (`top`, `right`, `bottom`, `left`, `width`) or null. A stack
 * wider than 60% of the canvas runs along the bottom, otherwise along the left; a dock that
 * covers the screen is not subtracted. A hole too small to frame anything yields the canvas.
 */
export function visibleRect({ width, height, stack = null, north = null, dock = null }, pad = 12) {
  let x0 = pad, y0 = pad, x1 = width - pad, y1 = height - pad
  if (stack) {
    if (stack.width > width * 0.6) y1 = Math.min(y1, stack.top - pad)
    else x0 = Math.max(x0, stack.right + pad)
  }
  if (north) y0 = Math.max(y0, north.bottom + pad)
  if (dock && dock.width < width * 0.9) x1 = Math.min(x1, dock.left - pad)
  if (x1 - x0 < 120 || y1 - y0 < 120) return { x0: pad, y0: pad, x1: width - pad, y1: height - pad }
  return { x0, y0, x1, y1 }
}

/**
 * Frame that shows every point inside `rect`: the scale `k` (the largest that fits, kept
 * within `minScale`..`maxScale`), the centre of the points' box (`cx`, `cy`) and the centre
 * of the rect (`vx`, `vy`) it must land on. Null when there is nothing to frame.
 */
export function frameFor(points, rect, { pad = 40, maxScale = 2.4, minScale = 0.15 } = {}) {
  if (!points.length) return null
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const p of points) {
    x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y)
    x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y)
  }
  const vw = rect.x1 - rect.x0, vh = rect.y1 - rect.y0
  const w = Math.max(x1 - x0, 1), h = Math.max(y1 - y0, 1)
  const k = Math.max(minScale, Math.min(maxScale, (vw - pad) / w, (vh - pad) / h))
  return { k, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, vx: rect.x0 + vw / 2, vy: rect.y0 + vh / 2 }
}
