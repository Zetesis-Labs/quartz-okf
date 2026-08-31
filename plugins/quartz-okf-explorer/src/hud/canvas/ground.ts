/**
 * The optional ground under the graph (graphacker's): a dot grid that moves at half the
 * pan speed, and a soft vignette. Both are cached — the tile per colour and pixel ratio,
 * the gradient per size — because they are painted on every frame.
 */
const DOT_SPACING = 26

let tile: CanvasPattern | null = null
let tileKey = ""

export function drawDots(ctx: CanvasRenderingContext2D, tf: { x: number; y: number }, w: number, h: number, dpr: number, color: string): void {
  const key = `${color}|${dpr}`
  if (!tile || tileKey !== key) {
    const c = document.createElement("canvas")
    c.width = Math.round(DOT_SPACING * dpr)
    c.height = Math.round(DOT_SPACING * dpr)
    const g = c.getContext("2d")
    if (!g) return
    g.scale(dpr, dpr)
    g.fillStyle = color
    g.beginPath()
    g.arc(DOT_SPACING / 2, DOT_SPACING / 2, 1.1, 0, Math.PI * 2)
    g.fill()
    tile = ctx.createPattern(c, "repeat")
    tile?.setTransform(new DOMMatrix().scale(1 / dpr))
    tileKey = key
  }
  if (!tile) return
  ctx.save()
  ctx.translate(((tf.x * 0.5) % DOT_SPACING) - DOT_SPACING, ((tf.y * 0.5) % DOT_SPACING) - DOT_SPACING)
  ctx.globalAlpha = 0.55
  ctx.fillStyle = tile
  ctx.fillRect(0, 0, w + DOT_SPACING * 2, h + DOT_SPACING * 2)
  ctx.restore()
  ctx.globalAlpha = 1
}

let vignette: CanvasGradient | null = null
let vignetteKey = ""

export function drawVignette(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const key = `${w}x${h}`
  if (!vignette || vignetteKey !== key) {
    vignette = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.45, w / 2, h / 2, Math.hypot(w, h) / 2)
    vignette.addColorStop(0, "rgba(0,0,0,0)")
    vignette.addColorStop(1, "rgba(0,0,0,0.09)")
    vignetteKey = key
  }
  ctx.fillStyle = vignette
  ctx.fillRect(0, 0, w, h)
}
