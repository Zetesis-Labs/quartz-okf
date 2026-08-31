import { effect, type ReadonlySignal } from "@preact/signals"
import { drag as d3drag, type D3DragEvent } from "d3-drag"
import { easeCubicOut } from "d3-ease"
import { forceCollide, forceLink, forceManyBody, forceRadial, forceSimulation, forceX, forceY, type Simulation } from "d3-force"
import { select } from "d3-selection"
import "d3-transition"
import { zoom as d3zoom, zoomIdentity, type D3ZoomEvent, type ZoomTransform } from "d3-zoom"
import { drawnAlone, inViewport, labelIsBold, labelText, labelVisible, linkAlpha, nodeAlpha, viewportOf } from "../../../lib/canvas-rules.ts"
import { fillOf, sizeOf } from "../../../lib/style.ts"
import type { ExplorerEmitConfig, ExplorerMode, HudDisplay, View, ViewLink, ViewNode } from "../../../lib/types.ts"
import { frameFor, visibleRect, wheelStep, type Rect, type ScreenRect } from "../../../lib/viewport.ts"
import { drawDots, drawVignette } from "./ground.ts"

/**
 * The canvas engine: the force simulation, the camera, hover and drag, the draw loop.
 * Everything here is a plain field mutated at frame rate — d3 writes `x`/`y` on every
 * tick and the loop reads them — so none of it is a signal. The engine reads the few
 * signals it draws from (selection, query, keyboard focus) and reports gestures upward
 * as events; it never renders a component.
 */
export interface EngineReader {
  selected: ReadonlySignal<ViewNode | null>
  searchQuery: ReadonlySignal<string>
  keyboardFocus: ReadonlySignal<ViewNode | null>
}

export interface EngineEvents {
  onHover(node: ViewNode | null, px: number, py: number): void
  onClick(node: ViewNode | null, ev: MouseEvent): void
  onDblClick(node: ViewNode): void
  onContextMenu(node: ViewNode | null, x: number, y: number): void
  onCameraTouched(): void
}

export interface FreeRects {
  stack?: ScreenRect | null
  north?: ScreenRect | null
  dock?: ScreenRect | null
}

export interface ViewContext {
  display: HudDisplay
  mode: ExplorerMode
  refit: boolean
}

export interface FitOptions {
  instant?: boolean
  enter?: boolean
}

export interface Engine {
  mount(canvas: HTMLCanvasElement, events: EngineEvents): void
  destroy(): void
  setView(view: View, ctx: ViewContext): void
  draw(): void
  requestDraw(): void
  fit(nodes?: ViewNode[] | null, scale?: number | null, opts?: FitOptions): void
  resetCamera(): void
  transform(): ZoomTransform
  animateTo(t: ZoomTransform): void
  userMoves(): number
  cameraTouched(): boolean
  forgetCamera(): void
  nodeAt(px: number, py: number): ViewNode | null
  registerPortal(id: string, el: HTMLElement | null): void
  setFreeRects(fn: () => FreeRects): void
  size(): { width: number; height: number }
}

interface DragSubject {
  node: ViewNode
  x: number
  y: number
}

const isDark = (): boolean => document.documentElement.getAttribute("saved-theme") === "dark"

export function createEngine(cfg: ExplorerEmitConfig, reader: EngineReader): Engine {
  const LAYOUT = { charge: -70, gravity: 0.05, ...(cfg.layout || {}) }
  const LINKS = LAYOUT.link || {}
  const LINK_DEF = { distance: 34, strength: 0.5, ...(LINKS["*"] || {}) }
  const RING = LAYOUT.radial?.byType ? { strength: 0.7, ...LAYOUT.radial } : null
  const REDUCED_MOTION = matchMedia("(prefers-reduced-motion: reduce)").matches
  const GROUND = cfg.hud.ground === "dots"

  let canvas: HTMLCanvasElement | null = null
  let ctx: CanvasRenderingContext2D | null = null
  let events: EngineEvents | null = null
  let graph: View | null = null
  let sim: Simulation<ViewNode, ViewLink> | null = null
  let display: HudDisplay | null = null
  let mode: ExplorerMode | null = null
  let W = 0
  let H = 0
  let transform: ZoomTransform = zoomIdentity
  let hover: ViewNode | null = null
  let dragging = false
  let dragMoved = false
  let touched = false
  let moves = 0
  let firstFit = true
  let drawPending = false
  let freeRects: () => FreeRects = () => ({})
  const portals = new Map<string, HTMLElement>()
  const disposers: (() => void)[] = []

  const sizeOfNode = (n: ViewNode): number => sizeOf(n, { radius: cfg.radius, mode })
  const fillOfNode = (n: ViewNode): string =>
    fillOf(n, { mode, colors: display?.colors ?? {}, knowledgeTypes: display?.knowledgeTypes ?? [] })
  const matches = (n: ViewNode): boolean => {
    const q = reader.searchQuery.value
    return Boolean(q) && (n.title.toLowerCase().includes(q) || n.label.toLowerCase().includes(q) || n.id.toLowerCase().includes(q))
  }

  function requestDraw(): void {
    if (drawPending) return
    drawPending = true
    requestAnimationFrame(() => {
      drawPending = false
      draw()
    })
  }

  // ---- canvas size and camera -----------------------------------------------------------------
  function resize(): void {
    if (!canvas || !ctx) return
    const width = canvas.clientWidth
    const height = canvas.clientHeight
    const dx = W ? (width - W) / 2 : 0
    const dy = H ? (height - H) / 2 : 0
    W = width
    H = height
    // devicePixelRatio is read on every resize, not once: it changes with the browser zoom
    // and when the window moves to a screen with another scale.
    const dpr = window.devicePixelRatio || 1
    canvas.width = W * dpr
    canvas.height = H * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    if (dx || dy) recentre(dx, dy)
  }

  // The centring forces hold W/2 and H/2 as fixed numbers. The simulation is not reheated on
  // a resize: what is placed moves by half of what the canvas grew, which is instant and
  // leaves the drawing where the reader had it.
  function recentre(dx: number, dy: number): void {
    if (!sim) return
    const fx = sim.force("x") as ReturnType<typeof forceX<ViewNode>> | undefined
    const fy = sim.force("y") as ReturnType<typeof forceY<ViewNode>> | undefined
    const fr = sim.force("radial") as ReturnType<typeof forceRadial<ViewNode>> | undefined
    fx?.x(W / 2)
    fy?.y(H / 2)
    fr?.x(W / 2).y(H / 2)
    if (!graph) return
    for (const n of graph.nodes) {
      n.x = (n.x ?? 0) + dx
      n.y = (n.y ?? 0) + dy
      if (n.fx != null) n.fx += dx
      if (n.fy != null) n.fy += dy
    }
  }

  const linkForce = (l: ViewLink) => (LINKS[l.kind] ? { ...LINK_DEF, ...LINKS[l.kind] } : LINK_DEF)
  function ringOf(n: ViewNode): number | null {
    if (!RING) return null
    const f = RING.byType[n.type]
    return f == null ? null : f * Math.min(W, H) * 0.5 * (RING.scale ?? 0.94)
  }

  // New nodes are born around the centre of the canvas (d3's spiral, but here and not at
  // the origin); the ones already placed keep their spot, so a mode change adjusts the
  // drawing instead of flying in again from a corner.
  function seed(nodes: ViewNode[], previous: View | null): number {
    let fresh = 0
    nodes.forEach((n, i) => {
      const p = previous?.idx.get(n.id)
      if (p && p.x != null) {
        n.x = p.x
        n.y = p.y
        n.vx = p.vx || 0
        n.vy = p.vy || 0
        return
      }
      const r = 10 * Math.sqrt(0.5 + i)
      const a = i * Math.PI * (3 - Math.sqrt(5))
      n.x = W / 2 + r * Math.cos(a)
      n.y = H / 2 + r * Math.sin(a)
      fresh++
    })
    return fresh
  }

  // The simulation warms up silently before the first frame, bounded in time, until little
  // energy is left: the graph appears placed and is framed once; the last, gentle settling
  // happens in view so it does not arrive frozen.
  function prewarm(s: Simulation<ViewNode, ViewLink>, { untilAlpha, maxTicks }: { untilAlpha: number; maxTicks: number }): void {
    const limit = performance.now() + 160
    for (let i = 0; i < maxTicks && s.alpha() > untilAlpha && performance.now() < limit; i++) s.tick()
  }

  function setView(view: View, vc: ViewContext): void {
    const previous = graph
    display = vc.display
    mode = vc.mode
    graph = view
    const fresh = seed(view.nodes, previous)
    sim?.stop()
    sim = forceSimulation<ViewNode>(view.nodes)
      .force(
        "link",
        forceLink<ViewNode, ViewLink>(view.links)
          .id((d) => d.id)
          .distance((l) => linkForce(l).distance ?? 34)
          .strength((l) => linkForce(l).strength ?? 0.5),
      )
      .force("charge", forceManyBody<ViewNode>().strength(LAYOUT.charge ?? -70))
      .force("x", forceX<ViewNode>(W / 2).strength(LAYOUT.gravity ?? 0.05))
      .force("y", forceY<ViewNode>(H / 2).strength(LAYOUT.gravity ?? 0.05))
      .force("collide", forceCollide<ViewNode>((d) => sizeOfNode(d) + 2.5))
      .stop()
    // Radial share-out: each type settles on its own ring; the eye reads from the inside out.
    if (RING) {
      sim.force(
        "radial",
        forceRadial<ViewNode>((n) => ringOf(n) ?? 0, W / 2, H / 2).strength((n) => (ringOf(n) == null ? 0 : (RING.strength ?? 0.7))),
      )
    }
    const fromScratch = fresh > view.nodes.length / 2
    // With inherited positions the simulation starts already tempered: it adjusts, it does not reorder.
    if (!fromScratch) sim.alpha(0.3)
    prewarm(sim, fromScratch ? { untilAlpha: 0.12, maxTicks: 300 } : { untilAlpha: 0.2, maxTicks: 30 })
    // Only when a graph opens: afterwards every mode or filter change respects the reader's framing.
    if (vc.refit && firstFit) {
      firstFit = false
      fit(null, null, { enter: true })
    }
    sim.on("tick", requestDraw).restart()
    requestDraw()
  }

  // ---- drawing --------------------------------------------------------------------------------
  function drawLabel(c: CanvasRenderingContext2D, n: ViewNode, dark: boolean, k: number, bold: boolean): void {
    const r = sizeOfNode(n)
    c.font = `${bold ? "600 " : ""}${11 / k}px -apple-system, sans-serif`
    c.lineWidth = 3.2 / k
    c.lineJoin = "round"
    c.strokeStyle = dark ? "rgba(22,22,24,.85)" : "rgba(250,248,248,.85)"
    const label = labelText(n.label)
    const x = (n.x ?? 0) + r + 4 / k
    const y = (n.y ?? 0) + 3.5 / k
    c.strokeText(label, x, y)
    c.fillStyle = dark ? "#e8e8e8" : "#222"
    c.fillText(label, x, y)
  }

  function placePortals(): void {
    if (!graph) return
    for (const [id, el] of portals) {
      const n = graph.idx.get(id)
      if (!n) {
        el.hidden = true
        continue
      }
      const [sx, sy] = transform.apply([n.x ?? 0, n.y ?? 0])
      const r = sizeOfNode(n) * transform.k
      const out = sx < -40 || sy < -40 || sx > W + 40 || sy > H + 40
      el.hidden = out
      if (out) continue
      el.style.left = `${sx + r + 6}px`
      el.style.top = `${sy + r + 6}px`
    }
  }

  function draw(): void {
    if (!ctx || !graph) return
    const c = ctx
    placePortals()
    const dark = isDark()
    const dpr = window.devicePixelRatio || 1
    c.clearRect(0, 0, W, H)
    if (GROUND) {
      drawDots(c, transform, W, H, dpr, dark ? "rgba(255,255,255,.22)" : "rgba(0,0,0,.16)")
    }
    c.save()
    c.translate(transform.x, transform.y)
    c.scale(transform.k, transform.k)
    const k = transform.k
    const selected = reader.selected.value
    const keyFocus = reader.keyboardFocus.value
    const focus = hover || selected
    const near = focus ? graph.adj.get(focus.id) : null
    const hasFocus = Boolean(focus)
    const hasQuery = Boolean(reader.searchQuery.value)
    const dimming = hasFocus || hasQuery
    const vp = viewportOf(transform, W, H)
    const contextOf = (n: ViewNode) => ({
      focused: n === focus,
      near: Boolean(near?.has(n.id)),
      hit: matches(n),
      selected: n === selected,
      hasFocus,
      hasQuery,
    })

    // Unfocused links share alpha and width and only differ in colour by kind: they are
    // grouped into one path per colour and stroked at once (Firefox charges per stroke).
    const batches = new Map<string, Path2D>()
    const focused: ViewLink[] = []
    for (const l of graph.links) {
      const s = l.source as ViewNode
      const t = l.target as ViewNode
      if (focus && (s === focus || t === focus)) {
        focused.push(l)
        continue
      }
      const color = display?.edgeColors[l.kind] || (dark ? "#4a4a4a" : "#c0c0c0")
      let path = batches.get(color)
      if (!path) batches.set(color, (path = new Path2D()))
      path.moveTo(s.x ?? 0, s.y ?? 0)
      path.lineTo(t.x ?? 0, t.y ?? 0)
    }
    c.globalAlpha = linkAlpha({ hasFocus, hasQuery })
    c.lineWidth = 0.7 / k
    for (const [color, path] of batches) {
      c.strokeStyle = color
      c.stroke(path)
    }
    for (const l of focused) {
      const s = l.source as ViewNode
      const t = l.target as ViewNode
      c.globalAlpha = 0.85
      c.lineWidth = 1.5 / k
      c.strokeStyle = dark ? "#ccc" : "#555"
      c.beginPath()
      c.moveTo(s.x ?? 0, s.y ?? 0)
      c.lineTo(t.x ?? 0, t.y ?? 0)
      c.stroke()
      const dx = (t.x ?? 0) - (s.x ?? 0)
      const dy = (t.y ?? 0) - (s.y ?? 0)
      const len = Math.hypot(dx, dy) || 1
      const ux = dx / len
      const uy = dy / len
      const tipX = (t.x ?? 0) - ux * (sizeOfNode(t) + 2.5 / k)
      const tipY = (t.y ?? 0) - uy * (sizeOfNode(t) + 2.5 / k)
      const sz = 5.5 / k
      c.fillStyle = c.strokeStyle
      c.beginPath()
      c.moveTo(tipX, tipY)
      c.lineTo(tipX - ux * sz - uy * sz * 0.55, tipY - uy * sz + ux * sz * 0.55)
      c.lineTo(tipX - ux * sz + uy * sz * 0.55, tipY - uy * sz - ux * sz * 0.55)
      c.closePath()
      c.fill()
    }
    c.globalAlpha = 1

    // Same idea with nodes: the ordinary ones are grouped by fill and painted at once; the
    // ones carrying a state of their own are drawn one by one.
    const fills = new Map<string, Path2D>()
    const rims = new Path2D()
    const alone: ViewNode[] = []
    for (const n of graph.nodes) {
      const r = sizeOfNode(n)
      if (!inViewport(vp, n.x ?? 0, n.y ?? 0, r * 2 + 8)) continue
      const fc = contextOf(n)
      if (drawnAlone(fc, { portal: Boolean(n.subgraph), federated: Boolean(n.federated) })) {
        alone.push(n)
        continue
      }
      const color = fillOfNode(n)
      let path = fills.get(color)
      if (!path) fills.set(color, (path = new Path2D()))
      path.moveTo((n.x ?? 0) + r, n.y ?? 0)
      path.arc(n.x ?? 0, n.y ?? 0, r, 0, 7)
      rims.moveTo((n.x ?? 0) + r, n.y ?? 0)
      rims.arc(n.x ?? 0, n.y ?? 0, r, 0, 7)
    }
    for (const [color, path] of fills) {
      c.fillStyle = color
      c.fill(path)
    }
    c.lineWidth = 1.2 / k
    c.strokeStyle = dark ? "rgba(22,22,24,.9)" : "rgba(255,255,255,.9)"
    c.stroke(rims)

    for (const n of alone) {
      const r = sizeOfNode(n)
      const fc = contextOf(n)
      const x = n.x ?? 0
      const y = n.y ?? 0
      c.globalAlpha = nodeAlpha(fc)
      const rBase = fc.focused || fc.hit ? r * 1.45 : r
      c.beginPath()
      c.arc(x, y, rBase, 0, 7)
      c.fillStyle = fillOfNode(n)
      c.fill()
      c.lineWidth = (fc.focused ? 2.2 : 1.2) / k
      c.strokeStyle = fc.focused ? (dark ? "#f0f0f0" : "#333") : dark ? "rgba(22,22,24,.9)" : "rgba(255,255,255,.9)"
      c.stroke()
      // A portal carries a second ring in its type's colour: it is the door to another graph.
      // A federated node carries a dashed ring: it is here on loan from another corpus.
      if (n.subgraph) {
        c.beginPath()
        c.arc(x, y, rBase + 3.2 / k, 0, 7)
        c.lineWidth = 1.5 / k
        c.strokeStyle = fillOfNode(n)
        c.stroke()
      } else if (n.federated) {
        c.beginPath()
        c.arc(x, y, rBase + 2.6 / k, 0, 7)
        c.setLineDash([2.5 / k, 2 / k])
        c.lineWidth = 1 / k
        c.strokeStyle = fillOfNode(n)
        c.stroke()
        c.setLineDash([])
      }
      // The selected note wears its own ring, visible wherever the pointer is.
      if (fc.selected) {
        const rr = rBase + 4.5 / k
        c.globalAlpha = 1
        c.beginPath()
        c.arc(x, y, rr, 0, 7)
        c.lineWidth = 2.4 / k
        c.strokeStyle = dark ? "#f2c14e" : "#c98a00"
        c.stroke()
        c.beginPath()
        c.arc(x, y, rr + 2.6 / k, 0, 7)
        c.lineWidth = 1 / k
        c.strokeStyle = dark ? "rgba(242,193,78,.35)" : "rgba(201,138,0,.3)"
        c.stroke()
      }
    }
    // The keyboard's focus ring: the node Tab and the arrows landed on.
    if (keyFocus && graph.idx.get(keyFocus.id) === keyFocus) {
      c.globalAlpha = 1
      c.beginPath()
      c.arc(keyFocus.x ?? 0, keyFocus.y ?? 0, sizeOfNode(keyFocus) + 7 / k, 0, 7)
      c.lineWidth = 2 / k
      c.setLineDash([4 / k, 3 / k])
      c.strokeStyle = dark ? "#8db4ec" : "#2f6fb8"
      c.stroke()
      c.setLineDash([])
    }
    c.globalAlpha = 1

    for (const n of graph.nodes) {
      if (!inViewport(vp, n.x ?? 0, n.y ?? 0, 60)) continue
      const lc = { ...contextOf(n), portal: Boolean(n.subgraph), size: sizeOfNode(n), k, dimming }
      const keyed = n === keyFocus
      if (keyed || labelVisible(lc)) drawLabel(c, n, dark, k, keyed || labelIsBold(lc))
    }
    c.restore()
    if (GROUND) drawVignette(c, W, H)
  }

  // ---- camera -----------------------------------------------------------------------------------
  const zoomBehavior = d3zoom<HTMLCanvasElement, unknown>()
    .scaleExtent([0.15, 8])
    .wheelDelta((e: WheelEvent) => wheelStep(e, { height: H || 600 }))
    .filter((e: MouseEvent | WheelEvent) => e.type === "wheel" || ((e as MouseEvent).button ?? 0) === 0 && !nodeAt((e as MouseEvent).offsetX, (e as MouseEvent).offsetY))
    .on("zoom", (ev: D3ZoomEvent<HTMLCanvasElement, unknown>) => {
      transform = ev.transform
      if (ev.sourceEvent) {
        touched = true
        moves++
        events?.onCameraTouched()
      }
      requestDraw()
    })

  function applyTransform(t: ZoomTransform): void {
    if (canvas) zoomBehavior.transform(select(canvas), t)
  }

  function animateTo(t: ZoomTransform, ms = 450, ease?: (x: number) => number): void {
    if (!canvas) return
    if (REDUCED_MOTION || document.visibilityState === "hidden") {
      applyTransform(t)
      return
    }
    const tr = select(canvas).transition().duration(ms)
    if (ease) tr.ease(ease)
    zoomBehavior.transform(tr, t)
  }

  function rectVisible(): Rect {
    const fr = freeRects()
    return visibleRect({ width: W, height: H, stack: fr.stack ?? null, north: fr.north ?? null, dock: fr.dock ?? null })
  }

  function fit(nodes?: ViewNode[] | null, scale?: number | null, { instant = false, enter = false }: FitOptions = {}): void {
    const set = nodes && nodes.length ? nodes : graph ? graph.nodes : []
    // On entering, the layout still opens a little as it settles: it is given room.
    const f = frameFor(set, rectVisible(), { pad: enter ? 72 : 40, maxScale: scale || 2.4 })
    if (!f || !canvas) return
    const framing = (esc: number) => zoomIdentity.translate(f.vx - esc * f.cx, f.vy - esc * f.cy).scale(esc)
    const to = framing(f.k)
    // In a hidden tab the browser does not dispatch requestAnimationFrame and a transition
    // never advances: there it is applied at once. The animation is for whoever is watching.
    if (instant || document.visibilityState === "hidden" || REDUCED_MOTION) {
      applyTransform(to)
      return
    }
    if (enter) {
      // One entrance gesture: a fade and a slight zoom up to the final framing.
      canvas.classList.remove("entra")
      void canvas.offsetWidth
      canvas.classList.add("entra")
      applyTransform(framing(f.k * 0.9))
      animateTo(to, 520, easeCubicOut)
      return
    }
    animateTo(to, 450)
  }

  function nodeAt(px: number, py: number): ViewNode | null {
    if (!sim) return null
    const [x, y] = transform.invert([px, py])
    return sim.find(x, y, 14 / transform.k) ?? null
  }

  // d3.drag rebases e.x/e.y on the subject's coordinates. The subject returned is the node
  // projected to the screen, with the node inside: e.x stays on screen, invertX() gives
  // world coordinates and the grab point stays under the mouse at any zoom.
  const dragBehavior = d3drag<HTMLCanvasElement, unknown, DragSubject | null>()
    .subject((e: D3DragEvent<HTMLCanvasElement, unknown, DragSubject | null>) => {
      const n = nodeAt(e.x, e.y)
      return n ? { node: n, x: transform.applyX(n.x ?? 0), y: transform.applyY(n.y ?? 0) } : null
    })
    .on("start", (e) => {
      if (!e.subject) return
      const n = e.subject.node
      dragging = true
      dragMoved = false
      touched = true
      hover = n
      canvas?.classList.add("dragging")
      if (!e.active) sim?.alphaTarget(0.25).restart()
      n.fx = n.x
      n.fy = n.y
    })
    .on("drag", (e) => {
      if (!e.subject) return
      dragMoved = true
      e.subject.node.fx = transform.invertX(e.x)
      e.subject.node.fy = transform.invertY(e.y)
    })
    .on("end", (e) => {
      dragging = false
      canvas?.classList.remove("dragging")
      if (!e.active) sim?.alphaTarget(0)
      if (e.subject) {
        e.subject.node.fx = null
        e.subject.node.fy = null
      }
    })

  // ---- mount ------------------------------------------------------------------------------------
  function mount(el: HTMLCanvasElement, ev: EngineEvents): void {
    canvas = el
    ctx = el.getContext("2d")
    events = ev
    if (!ctx) throw new Error("quartz-okf-explorer: canvas 2D context unavailable")
    resize()

    const onResize = () => {
      resize()
      requestDraw()
    }
    window.addEventListener("resize", onResize)
    const ro = new ResizeObserver(onResize)
    ro.observe(el)
    disposers.push(() => window.removeEventListener("resize", onResize), () => ro.disconnect())

    const onMove = (e: MouseEvent) => {
      if (dragging) {
        requestDraw()
        return
      }
      const n = nodeAt(e.offsetX, e.offsetY)
      el.classList.toggle("on-node", Boolean(n))
      if (n !== hover) {
        hover = n
        requestDraw()
      }
      events?.onHover(n, e.offsetX, e.offsetY)
    }
    const onLeave = () => {
      hover = null
      requestDraw()
      events?.onHover(null, 0, 0)
    }
    const onClick = (e: MouseEvent) => {
      if (dragMoved) {
        dragMoved = false
        return
      }
      events?.onClick(nodeAt(e.offsetX, e.offsetY), e)
    }
    const onDbl = (e: MouseEvent) => {
      const n = nodeAt(e.offsetX, e.offsetY)
      if (n) events?.onDblClick(n)
    }
    const onContext = (e: MouseEvent) => {
      e.preventDefault()
      events?.onContextMenu(nodeAt(e.offsetX, e.offsetY), e.offsetX, e.offsetY)
    }
    // d3 prevents the wheel it consumes, but at the zoom limit it does not consume it and the
    // event escapes: the page behind the explorer would scroll.
    const onWheel = (e: WheelEvent) => e.preventDefault()
    el.addEventListener("mousemove", onMove)
    el.addEventListener("mouseleave", onLeave)
    el.addEventListener("click", onClick)
    el.addEventListener("dblclick", onDbl)
    el.addEventListener("contextmenu", onContext)
    el.addEventListener("wheel", onWheel, { passive: false })
    disposers.push(() => {
      el.removeEventListener("mousemove", onMove)
      el.removeEventListener("mouseleave", onLeave)
      el.removeEventListener("click", onClick)
      el.removeEventListener("dblclick", onDbl)
      el.removeEventListener("contextmenu", onContext)
      el.removeEventListener("wheel", onWheel)
    })

    select(el).call(dragBehavior).call(zoomBehavior)

    const onTheme = () => requestDraw()
    document.addEventListener("themechange", onTheme)
    disposers.push(() => document.removeEventListener("themechange", onTheme))
    disposers.push(effect(() => {
      reader.selected.value
      reader.searchQuery.value
      reader.keyboardFocus.value
      requestDraw()
    }))
  }

  function destroy(): void {
    sim?.stop()
    sim = null
    for (const d of disposers.splice(0)) d()
    if (canvas) {
      select(canvas).on(".zoom", null).on(".drag", null)
    }
    canvas = null
    ctx = null
    events = null
    graph = null
    portals.clear()
  }

  return {
    mount,
    destroy,
    setView,
    draw,
    requestDraw,
    fit,
    resetCamera() {
      touched = false
      firstFit = true
      applyTransform(zoomIdentity)
    },
    transform: () => transform,
    animateTo: (t) => animateTo(t, 300),
    userMoves: () => moves,
    cameraTouched: () => touched,
    forgetCamera() {
      touched = false
    },
    nodeAt,
    registerPortal(id, el) {
      if (el) portals.set(id, el)
      else portals.delete(id)
    },
    setFreeRects(fn) {
      freeRects = fn
    },
    size: () => ({ width: W, height: H }),
  }
}
