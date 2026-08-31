import { baseDisplay, displayFor, modeById, modeGraphUrl } from "../../lib/display.js"
import { findNode, focusKeys, resolveFocus } from "../../lib/focus.js"
import { dismissOrder, filterRows, filtersIsland, selectionView, trailView, viewsIsland } from "../../lib/hud.js"
import { translator } from "../../lib/i18n.js"
import { indexGraph } from "../../lib/model.js"
import { expandRegistry, loadGraphs, registryFrom } from "../../lib/registry.js"
import { routeTo } from "../../lib/route.js"
import { nextScope, scopesFor, searchAcross } from "../../lib/search.js"
import { fillOf, sizeOf } from "../../lib/style.js"
import { fill } from "../../lib/template.js"
import { buildView } from "../../lib/view.js"

// Configuración del consumidor, incrustada por el emitter en el mismo script que este
// código. El motor no conoce ningún dominio; todo el vocabulario visible viene de aquí o
// del catálogo de idioma que el emitter resolvió.
const CFG = globalThis.OKF_EXPLORER_CONFIG
const t = translator(CFG.wording)
const BASE = baseDisplay(CFG, t)
const GRAFO_BASE = CFG.graphUrl || "/static/okf-graph.json"
const RADIUS = CFG.radius || null
const LAYOUT = Object.assign({ charge: -70, gravity: 0.05 }, CFG.layout || {})
const LINKS = LAYOUT.link || {}
const LINK_DEF = Object.assign({ distance: 34, strength: 0.5 }, LINKS["*"] || {})
const RING = LAYOUT.radial && LAYOUT.radial.byType ? Object.assign({ strength: 0.7 }, LAYOUT.radial) : null
const REDUCED_MOTION = matchMedia("(prefers-reduced-motion: reduce)").matches

const $ = (id) => document.getElementById(id)
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c])
const urlDeSubgrafo = (id) => `/static/okf-subgraphs/${encodeURIComponent(id)}.json`
const urlDeNivel = (id) => (id ? `?graph=${encodeURIComponent(id)}` : location.pathname)

const CACHE_GRAFOS = new Map()
async function fetchGraph(url) {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.json()
}
function cargarGrafo(url) {
  if (!CACHE_GRAFOS.has(url)) CACHE_GRAFOS.set(url, fetchGraph(url).then(indexGraph))
  return CACHE_GRAFOS.get(url)
}

document.documentElement.lang = CFG.locale
document.title = CFG.title || t("title.default")
document.body.dataset.surfaces = (CFG.hud && CFG.hud.surfaces) || "flat"
for (const [k, v] of Object.entries((CFG.hud && CFG.hud.tokens) || {})) document.documentElement.style.setProperty(k, v)
// Dentro del modal de las notas la miga se pinta en la barra del modal, que tiene el ancho
// entero: el explorador se la manda y recibe de vuelta a qué nivel volver.
const FRAMED = window.self !== window.top
if (FRAMED) document.body.classList.add("framed")

cargarGrafo(GRAFO_BASE).then((inicial) => {
  let data = inicial
  let display = displayFor(BASE, data, { inSubgraph: false, t })
  let urlActual = GRAFO_BASE
  // El documento del nivel en pantalla: a él vuelve un modo que no declara el suyo.
  let urlNivel = GRAFO_BASE
  // Pila de grafos: cada entrada es el grafo del que se entró a un subgrafo y el nodo que
  // se estaba mirando, para volver exactamente ahí. `idActual` es null en el de partida.
  const pila = []
  const enSubgrafo = () => pila.length > 0
  let idActual = null
  const registry = registryFrom(data, { title: CFG.title || t("graph.default"), url: GRAFO_BASE })

  const canvas = $("c"), tip = $("tip"), ctx = canvas.getContext("2d")
  const q = $("q"), qClear = $("q-clear"), resultsEl = $("results"), selEl = $("sel"), sideEl = $("side")
  const statsEl = $("stats"), stackEl = $("stack"), northEl = $("north"), dockEl = $("dock")

  let graph, sim = null, W, H
  let transform = d3.zoomIdentity, hover = null, selected = null
  let curMode = display.modes[0].id, modoActual = modeById(display, curMode)
  let checkedTypes = null, checkedEdges = null
  let query = "", scope = "graph", hits = [], hi = 0, unavailable = [], cargandoGrafos = false
  let camaraBusqueda = null, movidaDesdeBusqueda = false
  let menu = null
  // Tras cambiar de grafo la cámara se reencuadra sola en cuanto el layout toma forma,
  // sin esperar a que la simulación termine: con cientos de nodos tarda segundos.
  let fitPendiente = false, ticksDesdeCambio = 0
  // Si el lector mueve la cámara, nada vuelve a moverla por él.
  let camaraTocada = false
  let firstFit = true

  const sizeOfNode = (n) => sizeOf(n, { radius: RADIUS, mode: modoActual })
  const fillOfNode = (n) => fillOf(n, { mode: modoActual, colors: display.colors, knowledgeTypes: display.knowledgeTypes })
  const isDark = () => matchMedia("(prefers-color-scheme: dark)").matches
  const matches = (n) => query && (n.title.toLowerCase().includes(query) || n.label.toLowerCase().includes(query) || n.id.toLowerCase().includes(query))

  // ---- lienzo ----------------------------------------------------------------------------
  function resize() {
    const ancho = canvas.clientWidth, alto = canvas.clientHeight
    const dx = W == null ? 0 : (ancho - W) / 2, dy = H == null ? 0 : (alto - H) / 2
    W = ancho; H = alto
    // devicePixelRatio se lee en cada redimensión, no una sola vez al cargar: cambia al
    // usar el zoom del navegador y al arrastrar la ventana a una pantalla con otra escala.
    const dpr = window.devicePixelRatio || 1
    canvas.width = W * dpr; canvas.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    if (dx || dy) recentrar(dx, dy)
  }
  // Las fuerzas de centrado guardan W/2 y H/2 como números fijos al construirse. No se
  // recalienta la simulación al redimensionar: se traslada lo ya colocado por la mitad de
  // lo que creció el lienzo, que es instantáneo y deja el dibujo donde el lector lo tenía.
  function recentrar(dx, dy) {
    if (!sim) return
    const fx = sim.force("x"), fy = sim.force("y"), fr = sim.force("radial")
    if (fx) fx.x(W / 2)
    if (fy) fy.y(H / 2)
    if (fr) fr.x(W / 2).y(H / 2)
    if (!graph) return
    for (const n of graph.nodes) {
      n.x += dx; n.y += dy
      if (n.fx != null) n.fx += dx
      if (n.fy != null) n.fy += dy
    }
  }
  window.addEventListener("resize", () => { resize(); tick() })
  new ResizeObserver(() => { resize(); tick() }).observe(canvas)

  function linkForce(l) {
    return LINKS[l.kind] ? Object.assign({}, LINK_DEF, LINKS[l.kind]) : LINK_DEF
  }
  function ringOf(n) {
    if (!RING) return null
    const f = RING.byType[n.type]
    return f == null ? null : f * Math.min(W, H) * 0.5 * (RING.scale ?? 0.94)
  }

  function restart(refit = true) {
    modoActual = modeById(display, curMode)
    graph = buildView(data, display, modoActual, { types: checkedTypes, edges: checkedEdges })
    if (selected) selected = graph.idx.get(selected.id) || null
    renderViews(); renderFilters(); renderSel(); renderSide(); renderPortalButtons()
    if (sim) sim.stop()
    sim = d3.forceSimulation(graph.nodes)
      .force("link", d3.forceLink(graph.links).id((d) => d.id)
        .distance((l) => linkForce(l).distance)
        .strength((l) => linkForce(l).strength))
      .force("charge", d3.forceManyBody().strength(LAYOUT.charge))
      .force("x", d3.forceX(W / 2).strength(LAYOUT.gravity))
      .force("y", d3.forceY(H / 2).strength(LAYOUT.gravity))
      .force("collide", d3.forceCollide((d) => sizeOfNode(d) + 2.5))
      // Reparto radial: cada tipo se asienta en su propio anillo; el ojo lee de dentro afuera.
      .force("radial", RING
        ? d3.forceRadial((n) => ringOf(n), W / 2, H / 2).strength((n) => (ringOf(n) == null ? 0 : RING.strength))
        : null)
      .on("tick", tick)
      // Solo al abrir: después, cada cambio de modo o de filtro respeta el encuadre del lector.
      .on("end", () => { if (refit && firstFit) { firstFit = false; fit() } })
  }

  function drawLabel(n, dark, k, bold) {
    const r = sizeOfNode(n)
    ctx.font = `${bold ? "600 " : ""}${11 / k}px -apple-system, sans-serif`
    ctx.lineWidth = 3.2 / k; ctx.lineJoin = "round"
    ctx.strokeStyle = dark ? "rgba(22,22,24,.85)" : "rgba(250,248,248,.85)"
    const label = n.label.length > 42 ? n.label.slice(0, 41) + "…" : n.label
    const x = n.x + r + 4 / k, y = n.y + 3.5 / k
    ctx.strokeText(label, x, y)
    ctx.fillStyle = dark ? "#e8e8e8" : "#222"
    ctx.fillText(label, x, y)
  }

  // La puerta a otro grafo va pegada a su portal en el lienzo, siempre visible: es la acción
  // más importante del explorador y no puede depender de un hover ni de una selección.
  const portalsEl = $("portals")
  let portalButtons = []
  function renderPortalButtons() {
    portalsEl.innerHTML = ""
    portalButtons = graph.nodes.filter((n) => n.subgraph).map((n) => {
      const b = document.createElement("button")
      b.type = "button"
      b.className = "portal-btn"
      b.textContent = t("portal.explore")
      b.title = t("portal.title", { graph: n.subgraph.title || n.subgraph.id, notes: n.subgraph.notes ?? 0 })
      b.addEventListener("click", () => entrarEnSubgrafo(n))
      portalsEl.appendChild(b)
      return { node: n, el: b }
    })
  }
  function placePortalButtons() {
    for (const { node: n, el } of portalButtons) {
      const [sx, sy] = transform.apply([n.x, n.y])
      const r = sizeOfNode(n) * transform.k
      const fuera = sx < -40 || sy < -40 || sx > W + 40 || sy > H + 40
      el.hidden = fuera
      if (fuera) continue
      el.style.left = `${sx + r + 6}px`
      el.style.top = `${sy + r + 6}px`
    }
  }

  function tick() {
    if (!graph) return
    if (fitPendiente && ++ticksDesdeCambio >= 40) {
      fitPendiente = false
      if (!camaraTocada) fit()
    }
    placePortalButtons()
    ctx.clearRect(0, 0, W, H)
    ctx.save(); ctx.translate(transform.x, transform.y); ctx.scale(transform.k, transform.k)
    const dark = isDark(), k = transform.k
    const focus = hover || selected
    const near = focus ? graph.adj.get(focus.id) : null
    const dimming = !!focus || !!query

    // Los enlaces sin foco comparten alfa y grosor y solo cambian de color por tipo: se
    // agrupan en un camino por color y se trazan de una vez (Firefox penaliza cada stroke).
    const lotes = new Map()
    const enfocados = []
    for (const l of graph.links) {
      if (focus && (l.source === focus || l.target === focus)) { enfocados.push(l); continue }
      const color = display.edgeColors[l.kind] || (dark ? "#4a4a4a" : "#c0c0c0")
      let camino = lotes.get(color)
      if (!camino) lotes.set(color, (camino = new Path2D()))
      camino.moveTo(l.source.x, l.source.y)
      camino.lineTo(l.target.x, l.target.y)
    }
    ctx.globalAlpha = focus ? 0.05 : query ? 0.1 : 0.34
    ctx.lineWidth = 0.7 / k
    for (const [color, camino] of lotes) { ctx.strokeStyle = color; ctx.stroke(camino) }

    for (const l of enfocados) {
      ctx.globalAlpha = 0.85
      ctx.lineWidth = 1.5 / k
      ctx.strokeStyle = dark ? "#ccc" : "#555"
      ctx.beginPath(); ctx.moveTo(l.source.x, l.source.y); ctx.lineTo(l.target.x, l.target.y); ctx.stroke()
      const dx = l.target.x - l.source.x, dy = l.target.y - l.source.y
      const len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len
      const tipX = l.target.x - ux * (sizeOfNode(l.target) + 2.5 / k)
      const tipY = l.target.y - uy * (sizeOfNode(l.target) + 2.5 / k)
      const sz = 5.5 / k
      ctx.fillStyle = ctx.strokeStyle; ctx.beginPath(); ctx.moveTo(tipX, tipY)
      ctx.lineTo(tipX - ux * sz - uy * sz * 0.55, tipY - uy * sz + ux * sz * 0.55)
      ctx.lineTo(tipX - ux * sz + uy * sz * 0.55, tipY - uy * sz - ux * sz * 0.55)
      ctx.closePath(); ctx.fill()
    }
    ctx.globalAlpha = 1

    // Mismo criterio con los nodos: los corrientes se agrupan por relleno y se pintan de
    // una vez; los que llevan estado propio siguen dibujándose uno a uno.
    const rellenos = new Map()
    const bordes = new Path2D()
    const sueltos = []
    for (const n of graph.nodes) {
      const hit = matches(n), isFocus = n === focus
      const isNear = near && near.has(n.id), isSel = n === selected
      const alfa = focus ? (isFocus || isNear ? 1 : 0.12) : query ? (hit ? 1 : 0.12) : 1
      if (isFocus || hit || isSel || alfa !== 1 || n.subgraph || n.federated) { sueltos.push(n); continue }
      const r = sizeOfNode(n), color = fillOfNode(n)
      let camino = rellenos.get(color)
      if (!camino) rellenos.set(color, (camino = new Path2D()))
      camino.moveTo(n.x + r, n.y); camino.arc(n.x, n.y, r, 0, 7)
      bordes.moveTo(n.x + r, n.y); bordes.arc(n.x, n.y, r, 0, 7)
    }
    ctx.globalAlpha = 1
    for (const [color, camino] of rellenos) { ctx.fillStyle = color; ctx.fill(camino) }
    ctx.lineWidth = 1.2 / k
    ctx.strokeStyle = dark ? "rgba(22,22,24,.9)" : "rgba(255,255,255,.9)"
    ctx.stroke(bordes)

    for (const n of sueltos) {
      const r = sizeOfNode(n), hit = matches(n)
      const isFocus = n === focus, isNear = near && near.has(n.id)
      const isSel = n === selected
      ctx.globalAlpha = focus ? (isFocus || isNear ? 1 : 0.12) : query ? (hit ? 1 : 0.12) : 1
      ctx.beginPath(); ctx.arc(n.x, n.y, isFocus || hit ? r * 1.45 : r, 0, 7)
      ctx.fillStyle = fillOfNode(n); ctx.fill()
      ctx.lineWidth = (isFocus ? 2.2 : 1.2) / k
      ctx.strokeStyle = isFocus ? (dark ? "#f0f0f0" : "#333") : dark ? "rgba(22,22,24,.9)" : "rgba(255,255,255,.9)"
      ctx.stroke()
      const rBase = isFocus || hit ? r * 1.45 : r
      // Un portal lleva un segundo anillo del color de su tipo: es la puerta a otro grafo.
      // Un nodo federado lleva un anillo discontinuo: está aquí prestado de otro corpus.
      if (n.subgraph) {
        ctx.beginPath(); ctx.arc(n.x, n.y, rBase + 3.2 / k, 0, 7)
        ctx.lineWidth = 1.5 / k; ctx.strokeStyle = fillOfNode(n); ctx.stroke()
      } else if (n.federated) {
        ctx.beginPath(); ctx.arc(n.x, n.y, rBase + 2.6 / k, 0, 7)
        ctx.setLineDash([2.5 / k, 2 / k])
        ctx.lineWidth = 1 / k; ctx.strokeStyle = fillOfNode(n); ctx.stroke()
        ctx.setLineDash([])
      }
      // La nota seleccionada lleva un anillo propio, visible aunque el puntero esté en otra parte.
      if (isSel) {
        const rr = rBase + 4.5 / k
        ctx.globalAlpha = 1
        ctx.beginPath(); ctx.arc(n.x, n.y, rr, 0, 7)
        ctx.lineWidth = 2.4 / k
        ctx.strokeStyle = dark ? "#f2c14e" : "#c98a00"
        ctx.stroke()
        ctx.beginPath(); ctx.arc(n.x, n.y, rr + 2.6 / k, 0, 7)
        ctx.lineWidth = 1 / k
        ctx.strokeStyle = dark ? "rgba(242,193,78,.35)" : "rgba(201,138,0,.3)"
        ctx.stroke()
      }
    }
    ctx.globalAlpha = 1

    for (const n of graph.nodes) {
      const hit = matches(n), isFocus = n === focus, isNear = near && near.has(n.id)
      if (dimming && !(isFocus || isNear || hit || n === selected)) continue
      const always = isFocus || hit || n === selected || sizeOfNode(n) > 8 || Boolean(n.subgraph)
      const big = sizeOfNode(n) > 7
      if (always || (isNear && k > 0.6) || k > 2.2 || (big && k > 0.9)) drawLabel(n, dark, k, always)
    }
    ctx.restore()
  }

  const nodeAt = (px, py) => {
    const [x, y] = transform.invert([px, py])
    return sim.find(x, y, 14 / transform.k)
  }

  // ---- tooltip -----------------------------------------------------------------------------
  function showTip(n, px, py) {
    const tpl = display.tooltip[n.type] || display.tooltip["*"]
    const cuenta = n.subgraph && !display.tooltip[n.type]
      ? t("tooltip.portal", n)
      : tpl ? fill(tpl, n) : t("tooltip.incoming", n)
    const origen = n.federated ? ` <span class="badge">${esc(n.federated)}</span>` : ""
    const pista = n.subgraph ? `<br><small>${t("tooltip.portal.hint")}</small>` : ""
    tip.innerHTML = `<b>${esc(n.title)}</b> <small>· ${esc(display.labels[n.type] || n.type)}</small>${origen}<br><small>${esc(cuenta)}</small>${pista}` +
      (n.desc ? `<div class="pv">${n.desc}</div>` : "")
    tip.style.display = "block"
    const r = tip.getBoundingClientRect()
    tip.style.left = Math.max(8, Math.min(px + 14, W - r.width - 8)) + "px"
    tip.style.top = Math.max(8, Math.min(py + 12, H - r.height - 8)) + "px"
  }

  canvas.addEventListener("mousemove", (ev) => {
    if (dragging) { tick(); return }
    const px = ev.offsetX, py = ev.offsetY
    const n = nodeAt(px, py)
    canvas.classList.toggle("on-node", !!n)
    if (n !== hover) { hover = n; tick() }
    if (n) showTip(n, px, py); else tip.style.display = "none"
  })
  canvas.addEventListener("mouseleave", () => { hover = null; tip.style.display = "none"; tick() })

  // ---- dock de lectura: pestañas temporal/ancladas sobre iframes -------------------------
  const peekTabs = dockEl.querySelector(".tabs")
  const peekFrames = dockEl.querySelector(".frames")
  const peekOpen = $("peek-open")
  const peekDive = $("peek-dive")
  peekOpen.textContent = t("dock.open")
  peekDive.textContent = t("selection.explore")
  $("peek-close").title = t("dock.close")
  const tabs = []
  let activeTab = null
  const dockOpen = () => !dockEl.hidden

  const frameFor = (id) => peekFrames.querySelector(`iframe[data-id="${CSS.escape(id)}"]`)

  function renderTabs() {
    peekTabs.innerHTML = ""
    for (const tb of tabs) {
      const el = document.createElement("div")
      el.className = "tab" + (tb.id === activeTab ? " active" : "") + (tb.pinned ? " pinned" : " temp")
      el.setAttribute("role", "tab")
      el.title = tb.pinned ? tb.title : t("dock.tab.temp", { title: tb.title })
      el.innerHTML =
        `<span class="tdot" style="background:${display.colors[tb.type] || "#888"}"></span>` +
        `<span class="nm">${esc(tb.title)}</span>` +
        `<span class="pin" aria-label="${tb.pinned ? t("dock.tab.unpin") : t("dock.tab.pin")}">${tb.pinned ? "📌" : "📍"}</span>` +
        `<span class="x" aria-label="${t("dock.tab.close")}">✕</span>`
      el.addEventListener("click", (e) => {
        if (e.target.classList.contains("x")) { closeTab(tb.id); return }
        if (e.target.classList.contains("pin")) { tb.pinned = !tb.pinned; renderTabs(); return }
        activate(tb.id)
      })
      el.addEventListener("dblclick", () => { tb.pinned = true; renderTabs() })
      peekTabs.appendChild(el)
    }
    const cur = tabs.find((x) => x.id === activeTab)
    peekOpen.href = cur ? cur.url : "#"
  }

  function activate(id) {
    activeTab = id
    peekFrames.querySelectorAll("iframe").forEach((f) => f.classList.toggle("active", f.dataset.id === id))
    renderTabs()
    const n = graph.idx.get(id)
    if (n) { selected = n; renderSel(); tick() }
    peekDive.hidden = !(n && n.subgraph)
  }
  peekDive.addEventListener("click", () => {
    const n = graph.idx.get(activeTab)
    if (n && n.subgraph) entrarEnSubgrafo(n)
  })

  function trimQuartz(f) {
    // Mismo origen: se recorta el layout para que el dock muestre solo el contenido.
    try {
      const d = f.contentDocument
      if (!d) return
      const css = d.createElement("style")
      css.textContent = `
        .left.sidebar, .right.sidebar, .page-footer, .mobile-only { display: none !important; }
        .center { margin: 0 !important; padding: 1rem 1.4rem 3rem !important; max-width: none !important; }`
      d.head.appendChild(css)
    } catch (_) { /* si el navegador lo impide, se ve la página completa */ }
  }

  function addFrame(n) {
    const f = document.createElement("iframe")
    f.dataset.id = n.id
    f.setAttribute("title", n.title)
    f.src = n.url
    f.addEventListener("load", () => trimQuartz(f))
    peekFrames.appendChild(f)
  }

  function showPeek(n) {
    const existing = tabs.find((tb) => tb.id === n.id)
    if (!existing) {
      // La temporal anterior se descarta: solo puede haber una a la vez.
      const tmpIdx = tabs.findIndex((tb) => !tb.pinned)
      const tab = { id: n.id, title: n.title, type: n.type, url: n.url, pinned: false }
      if (tmpIdx >= 0) {
        const f = frameFor(tabs[tmpIdx].id)
        if (f) f.remove()
        tabs.splice(tmpIdx, 1, tab)
      } else {
        tabs.push(tab)
      }
      addFrame(n)
    }
    dockEl.hidden = false
    document.body.classList.add("dock-open")
    activate(n.id)
  }

  function closeTab(id) {
    const i = tabs.findIndex((tb) => tb.id === id)
    if (i < 0) return
    tabs.splice(i, 1)
    const f = frameFor(id)
    if (f) f.remove()
    if (!tabs.length) { closePeek(); return }
    activate(tabs[Math.min(i, tabs.length - 1)].id)
  }

  function closePeek() {
    dockEl.hidden = true
    document.body.classList.remove("dock-open")
    tabs.length = 0; activeTab = null
    peekFrames.innerHTML = ""
    peekDive.hidden = true
    renderTabs()
  }
  $("peek-close").addEventListener("click", closePeek)

  // ---- subgrafos: entrar en el grafo que representa un portal, y volver -------------------
  const trailFor = () =>
    enSubgrafo() ? [...pila.slice(1).map((p) => ({ id: p.id, title: p.title })), { id: idActual, title: data.title }] : []
  const currentPath = () => trailFor().map((g) => g.id)
  const currentKey = () => idActual || ""

  async function cambiarGrafo(url, modeId) {
    statsEl.textContent = t("stats.loading")
    data = await cargarGrafo(url)
    urlActual = url
    urlNivel = url
    if (idActual) {
      if (!registry.has(idActual)) registry.set(idActual, { key: idActual, title: data.title, url, path: [idActual], model: null, error: null })
      expandRegistry(registry, idActual, data)
    }
    display = displayFor(BASE, data, { inSubgraph: enSubgrafo(), t })
    curMode = (modeId && display.modes.some((m) => m.id === modeId)) ? modeId : display.modes[0].id
    checkedTypes = null; checkedEdges = null
    selected = null; hover = null
    closeMenu(); hideResults()
    if (tabs.length) closePeek()
    renderTrail()
    // Cámara a cero: el encuadre del grafo anterior no significa nada en este.
    camaraTocada = false
    d3.select(canvas).call(zoomBehavior.transform, d3.zoomIdentity)
    firstFit = true; fitPendiente = true; ticksDesdeCambio = 0
    restart()
  }

  async function entrarEnSubgrafo(n, { push = true } = {}) {
    pila.push({ url: urlActual, selectedId: n.id, title: data.title, modeId: curMode, id: idActual })
    idActual = n.subgraph.id
    if (push) history.pushState({ graph: idActual }, "", urlDeNivel(idActual))
    await cambiarGrafo(n.subgraph.graph)
  }

  // Volver a un nivel del rastro: 0 es el grafo de partida.
  async function volverA(nivel, { push = true } = {}) {
    if (nivel < 0 || nivel >= pila.length) return
    const destino = pila[nivel]
    pila.length = nivel
    idActual = destino.id || null
    if (push) history.pushState(idActual ? { graph: idActual } : {}, "", urlDeNivel(idActual))
    await cambiarGrafo(destino.url, destino.modeId)
    const n = destino.selectedId ? graph.idx.get(destino.selectedId) : null
    if (n) select(n)
  }

  // Abierto directamente sobre un subgrafo (?graph=<id>): el camino de vuelta lo dice el
  // propio fichero, que sabe desde qué grafo y qué portal se publicó.
  async function entrarDirecto(id) {
    pila.push({ url: GRAFO_BASE, selectedId: null, title: null, modeId: BASE.modes[0].id, id: null })
    idActual = id
    history.replaceState({ graph: id }, "", location.href)
    await cambiarGrafo(registry.has(id) ? registry.get(id).url : urlDeSubgrafo(id))
    const desde = data.federatedFrom || {}
    pila[0].selectedId = desde.node || null
    pila[0].title = desde.title || null
    renderTrail()
  }

  // Ir a cualquier grafo del registro: atrás hasta el ancestro común, y una inmersión por portal.
  async function irAGrafo(key) {
    const target = registry.get(key)
    if (!target) return false
    for (const step of routeTo(currentPath(), target.path)) {
      if ("back" in step) { await volverA(step.back); continue }
      const portal = [...data.nodes.values()].find((n) => n.subgraph && n.subgraph.id === step.dive)
      if (!portal) return false
      await entrarEnSubgrafo(portal)
    }
    return true
  }

  // El botón atrás del navegador deshace la entrada al subgrafo, y adelante la rehace.
  window.addEventListener("popstate", (ev) => {
    const id = (ev.state && ev.state.graph) || new URLSearchParams(location.search).get("graph")
    if (id === idActual) return
    const nivel = pila.findIndex((p) => (p.id || null) === (id || null))
    if (nivel >= 0) { volverA(nivel, { push: false }); return }
    if (id) {
      const portal = data && [...data.nodes.values()].find((n) => n.subgraph && n.subgraph.id === id)
      if (portal) entrarEnSubgrafo(portal, { push: false }); else entrarDirecto(id)
    }
  })

  // ---- omnibar: rastro como ámbito, búsqueda en este grafo o en todos -------------------
  const scopes = () => scopesFor(registry.size, t)

  function renderTrail() {
    const v = trailView({ rootTitle: CFG.title || t("graph.default"), trail: trailFor(), graphCount: registry.size, scope }, t)
    const trailEl = $("trail")
    trailEl.innerHTML = v.levels.map((l, i) => {
      const sep = i < v.levels.length - 1 ? `<span class="sep">›</span>` : ""
      return l.current
        ? `<b class="cur" title="${esc(l.text)}">${esc(l.text)}</b>`
        : `<button class="lvl" type="button" data-nivel="${l.index}" title="${esc(t("trail.back", { graph: l.text }))}">${esc(l.text)}</button>${sep}`
    }).join("")
    trailEl.querySelectorAll(".lvl").forEach((b) => b.addEventListener("click", () => volverA(+b.dataset.nivel)))
    $("scope").innerHTML = v.scopeKey
      ? `<button class="scope${v.scopeKey.active ? " active" : ""}" type="button" title="${esc(t("scope.toggle"))}">⇥ ${esc(v.scopeKey.text)}</button>`
      : ""
    const sc = $("scope").querySelector(".scope")
    if (sc) sc.addEventListener("click", () => { cambiarAmbito(); q.focus() })
    q.placeholder = scope === "all" ? t("search.placeholder.all") : t("search.placeholder")
    q.title = t("search.hint")
    if (FRAMED) {
      window.parent.postMessage({
        type: "okf-explorer:trail",
        levels: v.levels.map((l) => ({ text: l.text, index: l.index, current: l.current, back: t("trail.back", { graph: l.text }) })),
      }, location.origin)
    }
  }
  // La miga propia solo se esconde cuando el host confirma que la ha pintado: un host
  // antiguo, o ajeno, no la conoce y el lector se quedaría sin camino de vuelta.
  window.addEventListener("message", (ev) => {
    if (ev.origin !== location.origin || ev.source !== window.parent) return
    const d = ev.data
    if (!d) return
    if (d.type === "okf-explorer:trail-shown") document.body.classList.add("hosted")
    if (d.type === "okf-explorer:go" && Number.isInteger(d.level)) volverA(d.level)
  })

  function cambiarAmbito() {
    scope = nextScope(scope, scopes())
    renderTrail()
    if (query) buscar()
  }

  function grafosParaBuscar() {
    const actual = { key: currentKey(), title: data.title, model: { nodes: graph.idx }, current: true, kindOrder: display.kindOrder }
    if (scope !== "all") return [actual]
    const otros = [...registry.values()].filter((e) => e.key !== currentKey()).map((e) => ({
      key: e.key, title: e.title, model: e.model, error: e.error, current: false,
      kindOrder: (e.model && e.model.display && (e.model.display.typeOrder || e.model.display.knowledgeTypes)) || BASE.kindOrder,
    }))
    return [actual, ...otros]
  }

  async function asegurarGrafos() {
    const faltan = [...registry.values()].filter((e) => !e.model && !e.error).map((e) => e.key)
    if (!faltan.length) return
    cargandoGrafos = true; renderResults()
    await loadGraphs(registry, faltan, fetchGraph)
    cargandoGrafos = false
  }

  function buscar() {
    query = q.value.trim().toLowerCase()
    qClear.hidden = !q.value
    if (!query) { hits = []; unavailable = []; hideResults(); tick(); return }
    if (camaraBusqueda == null) { camaraBusqueda = transform; movidaDesdeBusqueda = false }
    const listar = () => {
      const r = searchAcross(grafosParaBuscar(), query, { limit: 20 })
      hits = r.rows; unavailable = r.unavailable; hi = 0
      renderResults(); tick()
    }
    if (scope === "all") asegurarGrafos().then(listar); else listar()
  }

  function renderResults() {
    if (!query) { hideResults(); return }
    const cab = cargandoGrafos
      ? `<div class="hd">${esc(t("results.loading"))}</div>`
      : unavailable.map((u) => `<div class="hd warn">${esc(t("results.unavailable", { graph: u }))}</div>`).join("")
    const filas = hits.map((h, i) =>
      `<button class="row${i === hi ? " hi" : ""}" type="button" data-i="${i}">` +
      `<span class="dot" style="background:${colorDe(h)}"></span>` +
      `<span class="nm">${esc(h.node.title)}</span>` +
      (h.badge ? `<span class="badge">${esc(h.badge)}</span>` : h.node.federated ? `<span class="badge">${esc(h.node.federated)}</span>` : "") +
      `<span class="kind">${esc(labelDe(h))}</span></button>`).join("")
    resultsEl.innerHTML = cab + (filas || (cargandoGrafos ? "" : `<div class="hd">${esc(t("results.none"))}</div>`))
    resultsEl.hidden = false
  }
  const displayDe = (h) => (h.key === currentKey() ? display : displayFor(BASE, registry.get(h.key).model, { inSubgraph: h.key !== "", t }))
  const colorDe = (h) => displayDe(h).colors[h.node.type] || "#888"
  const labelDe = (h) => displayDe(h).labels[h.node.type] || h.node.type
  function hideResults() { resultsEl.hidden = true }
  const resultsOpen = () => !resultsEl.hidden

  // Delegado: repintar la lista dentro de un `mouseenter` desconecta la fila justo antes
  // de que llegue el `mousedown`, y el resultado nunca se activa.
  resultsEl.addEventListener("mousedown", (e) => {
    const row = e.target.closest("[data-i]")
    if (!row) return
    e.preventDefault()
    activar(hits[+row.dataset.i])
  })
  resultsEl.addEventListener("mouseover", (e) => {
    const row = e.target.closest("[data-i]")
    if (!row || +row.dataset.i === hi) return
    hi = +row.dataset.i
    resultsEl.querySelectorAll(".row").forEach((r, i) => r.classList.toggle("hi", i === hi))
  })

  function limpiarBusqueda({ restaurar = false } = {}) {
    q.value = ""; query = ""; hits = []; unavailable = []
    qClear.hidden = true
    hideResults()
    if (restaurar && camaraBusqueda && !movidaDesdeBusqueda) {
      d3.select(canvas).transition().duration(REDUCED_MOTION ? 0 : 300).call(zoomBehavior.transform, camaraBusqueda)
    }
    camaraBusqueda = null
    tick()
  }

  async function activar(hit) {
    if (!hit) return
    limpiarBusqueda()
    camaraBusqueda = null
    if (hit.key === currentKey()) {
      const n = graph.idx.get(hit.node.id)
      if (n) select(n, true)
      return
    }
    if (!(await irAGrafo(hit.key))) return
    const n = await enfocarEnGrafoActual([hit.node.id.toLowerCase()])
    if (n) marcarYEncuadrar(n)
  }

  q.addEventListener("input", buscar)
  q.addEventListener("focus", () => { if (query) renderResults() })
  q.addEventListener("keydown", (ev) => {
    if (ev.key === "Tab" && scopes().length) { ev.preventDefault(); cambiarAmbito(); return }
    if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
      if (!hits.length) return
      ev.preventDefault()
      hi = (hi + (ev.key === "ArrowDown" ? 1 : hits.length - 1)) % hits.length
      resultsEl.querySelectorAll(".row").forEach((r, i) => r.classList.toggle("hi", i === hi))
      const row = resultsEl.querySelector(".row.hi")
      if (row) row.scrollIntoView({ block: "nearest" })
      return
    }
    if (ev.key === "Enter") {
      ev.preventDefault()
      if (hits.length) activar(hits[hi])
      else if (query) fit(graph.nodes.filter(matches), 2.6)
      return
    }
    if (ev.key === "Escape") {
      ev.preventDefault()
      if (q.value) limpiarBusqueda({ restaurar: true }); else q.blur()
    }
  })
  qClear.addEventListener("click", () => { limpiarBusqueda({ restaurar: true }); q.focus() })
  qClear.title = t("search.clear")

  // ---- islas: vistas y filtros ------------------------------------------------------------
  let descAbierta = false
  function renderViews() {
    const v = viewsIsland({
      trail: trailFor(), rootTitle: CFG.title || t("graph.default"), modes: display.modes, modeId: curMode,
      portals: data.nodes.values(),
    }, t)
    const box = $("views"), chips = $("mode"), desc = $("desc"), doors = $("doors")
    box.hidden = v.hidden
    if (v.hidden) return
    chips.innerHTML =
      (v.back ? `<button class="chip" type="button" data-back="${v.back.level}"><span class="tx">${esc(v.back.text)}</span></button>` : "") +
      v.chips.map((c) => `<button class="chip" type="button" data-mode="${esc(c.id)}" aria-pressed="${c.active}"><span class="tx">${esc(c.text)}</span></button>`).join("") +
      (v.chips.some((c) => c.desc) ? `<button class="icon" type="button" id="about" title="${esc(t("views.about"))}" aria-pressed="${descAbierta}">?</button>` : "")
    doors.hidden = !v.portals.length
    doors.innerHTML = v.portals.map((p) =>
      `<button class="chip door" type="button" data-portal="${esc(p.id)}" title="${esc(p.title)}"><span class="tx">${esc(p.text)}</span></button>`).join("")
    doors.querySelectorAll("[data-portal]").forEach((b) => b.addEventListener("click", () => {
      const n = data.nodes.get(b.dataset.portal)
      if (n) entrarEnSubgrafo(n)
    }))
    chips.querySelectorAll("[data-back]").forEach((b) => b.addEventListener("click", () => volverA(+b.dataset.back)))
    chips.querySelectorAll("[data-mode]").forEach((b) => b.addEventListener("click", () => cambiarModo(b.dataset.mode)))
    const about = chips.querySelector("#about")
    if (about) about.addEventListener("click", () => { descAbierta = !descAbierta; renderViews() })
    const activo = v.chips.find((c) => c.active)
    desc.innerHTML = activo ? activo.desc : ""
    desc.hidden = !(descAbierta && activo && activo.desc)
  }

  function renderFilters() {
    const v = filtersIsland({
      groups: graph.groups, checkedTypes, edgeCounts: graph.edgeCounts, edgesFilterable: graph.edgesFilterable,
      checkedEdges, nodeCount: graph.nodes.length, linkCount: graph.links.length,
    }, t)
    $("filters").hidden = v.hidden
    const chip = (el, c) => {
      el.querySelector(".tx").textContent = c.text
      el.querySelector(".sub").textContent = c.sub
      el.classList.toggle("warn", c.warn)
      el.setAttribute("aria-pressed", String(menu === el.dataset.menu))
    }
    chip($("f-types"), v.types)
    chip($("f-edges"), v.edges)
    $("f-edges").hidden = v.edges.hidden
    if (v.edges.hidden && menu === "edges") menu = null
    statsEl.textContent = v.stats
  }
  $("f-types").dataset.menu = "types"
  $("f-edges").dataset.menu = "edges"
  $("f-types").addEventListener("click", () => toggleMenu("types"))
  $("f-edges").addEventListener("click", () => toggleMenu("edges"))
  $("fit").textContent = t("fit"); $("fit").title = t("fit.title")
  $("reset").textContent = t("clear"); $("reset").title = t("clear.title")
  $("fit").addEventListener("click", () => fit())
  $("reset").addEventListener("click", clearAll)

  function toggleMenu(which) {
    menu = menu === which ? null : which
    renderFilters(); renderSide()
  }
  function closeMenu() {
    if (!menu) return
    menu = null
    renderFilters(); renderSide()
  }

  function legendRows() {
    const m = modoActual
    const row = (color, label) => `<span><span class="dot" style="background:${color}"></span>${esc(label)}</span>`
    if (m.colorBy && m.colorBy.scale) {
      return `<span class="lt">${esc(m.legendTitle || m.label)}</span>` + m.colorBy.scale.map((s) => row(s.color, s.label)).join("")
    }
    return ""
  }

  function renderSide() {
    sideEl.hidden = !menu
    if (!menu) return
    const esTipos = menu === "types"
    const counts = esTipos ? graph.groups.counts : graph.edgeCounts
    const meta = esTipos ? graph.groups.meta : Object.fromEntries(Object.keys(counts).map((k) => [k, { color: display.edgeColors[k], label: k }]))
    const { rows, allChecked, noneChecked } = filterRows(counts, meta, esTipos ? checkedTypes : checkedEdges)
    const leyenda = (menu === "edges" || !graph.edgesFilterable) ? legendRows() : ""
    sideEl.innerHTML =
      `<div class="hd"><span>${esc(t(esTipos ? "filters.types" : "filters.edges"))}</span><span class="sp"></span>` +
      `<button class="chip mini" type="button" data-all ${allChecked ? "disabled" : ""}>${esc(t("filters.all"))}</button>` +
      `<button class="chip mini" type="button" data-none ${noneChecked ? "disabled" : ""}>${esc(t("filters.none"))}</button>` +
      `<button class="icon" type="button" data-close title="${esc(t("filters.close"))}">✕</button></div>` +
      `<div class="rows">` + rows.map((r) =>
        `<label class="row${r.checked ? "" : " off"}"><input type="checkbox" value="${esc(r.id)}" ${r.checked ? "checked" : ""}>` +
        `<span class="dot" style="background:${r.color}"></span><span class="lb">${esc(r.label)}</span><span class="cnt">${r.count}</span></label>`).join("") +
      `</div>` + (leyenda ? `<div class="lg">${leyenda}</div>` : "")
    const aplicar = (set) => {
      if (esTipos) checkedTypes = set; else checkedEdges = set
      restart(false)
    }
    sideEl.querySelector("[data-all]").addEventListener("click", () => aplicar(null))
    sideEl.querySelector("[data-none]").addEventListener("click", () => aplicar(new Set()))
    sideEl.querySelector("[data-close]").addEventListener("click", closeMenu)
    sideEl.querySelectorAll("input").forEach((i) => i.addEventListener("change", () => {
      const set = new Set(rows.filter((r) => r.checked).map((r) => r.id))
      if (i.checked) set.add(i.value); else set.delete(i.value)
      aplicar(set.size === rows.length ? null : set)
    }))
  }

  // ---- cápsula de selección ----------------------------------------------------------------
  function renderSel() {
    const v = selectionView(selected, graph.links, graph.idx, { edgeLabel: {}, t })
    selEl.hidden = !v
    if (!v) return
    selEl.innerHTML =
      `<div class="hd"><span class="dot" style="background:${display.colors[v.type] || "#888"}"></span>` +
      `<span class="ttl" title="${esc(v.title)}">${esc(v.title)}</span>` +
      (v.explore ? `<button class="chip mini" type="button" data-dive>${esc(t("selection.explore"))}</button>` : "") +
      `<button class="icon" type="button" data-close title="${esc(t("selection.close"))}">✕</button></div>` +
      (v.groups.length ? `<div class="grp">` + v.groups.map((g) =>
        `<b>${esc(g.text)}</b> ` + g.nodes.map((n) => `<a data-id="${esc(n.id)}">${esc(n.title)}</a>`).join(", ") +
        (g.more ? ` +${g.more}` : "")).join(`<span class="sep">·</span>`) + `</div>` : "")
    const dive = selEl.querySelector("[data-dive]")
    if (dive) dive.addEventListener("click", () => entrarEnSubgrafo(selected))
    selEl.querySelector("[data-close]").addEventListener("click", () => { selected = null; renderSel(); tick() })
    selEl.querySelectorAll("a[data-id]").forEach((a) => a.addEventListener("click", () => {
      const n = graph.idx.get(a.dataset.id)
      if (!n) return
      select(n)
      showPeek(n)
    }))
  }

  // ---- gestos sobre el lienzo ---------------------------------------------------------------
  // Clic en un nodo = abrir su nota. El resaltado de vecindad lo hace el hover, y la
  // selección persistente la fija el buscador: así el clic no mueve la cámara por sorpresa.
  canvas.addEventListener("click", (ev) => {
    if (dragMoved) { dragMoved = false; return }
    const n = nodeAt(ev.offsetX, ev.offsetY)
    if (!n) {
      if (selected) { selected = null; renderSel(); tick() }
      return
    }
    if (ev.metaKey || ev.ctrlKey || ev.shiftKey) { window.open(n.url, "_blank"); return }
    showPeek(n)
  })
  // Doble clic: entra en un portal, o abre la nota ya anclada.
  canvas.addEventListener("dblclick", (ev) => {
    const n = nodeAt(ev.offsetX, ev.offsetY)
    if (!n) return
    if (n.subgraph) { entrarEnSubgrafo(n); return }
    showPeek(n)
    const tb = tabs.find((x) => x.id === n.id)
    if (tb) { tb.pinned = true; renderTabs() }
  })

  // d3 hace preventDefault en la rueda que consume, pero si el zoom está en su tope no la
  // consume y el evento se escapa: dentro del modal eso mueve la página de detrás.
  canvas.addEventListener("wheel", (e) => e.preventDefault(), { passive: false })

  const zoomBehavior = d3.zoom().scaleExtent([0.15, 8])
    // Firefox entrega la rueda en LÍNEAS (deltaMode 1) y Chrome en píxeles (0). En modo
    // línea cada evento ES una muesca y vale lo que una muesca en Chrome; el modo píxel
    // —trackpad— sigue siendo proporcional, que es lo que le da su suavidad.
    .wheelDelta((e) => {
      const mult = e.ctrlKey ? 10 : 1
      if (e.deltaMode === 1) return -Math.sign(e.deltaY) * 0.2 * mult
      const px = e.deltaMode === 2 ? e.deltaY * (H || 600) : e.deltaY
      return -Math.max(-120, Math.min(120, px)) * 0.002 * mult
    })
    .filter((e) => e.type === "wheel" || !nodeAt(e.offsetX, e.offsetY))
    .on("zoom", (ev) => {
      transform = ev.transform
      if (ev.sourceEvent) { camaraTocada = true; movidaDesdeBusqueda = true }
      tick()
    })

  let dragging = false
  let dragMoved = false
  // d3.drag rebasa e.x/e.y respecto a las coordenadas del subject. Se devuelve el subject
  // proyectado a pantalla y el nodo dentro: así e.x sigue en pantalla, invertX() da mundo,
  // y el punto de agarre se mantiene bajo el ratón a cualquier zoom.
  const dragBehavior = d3.drag()
    .container(canvas)
    .subject((e) => {
      const n = nodeAt(e.x, e.y)
      return n ? { node: n, x: transform.applyX(n.x), y: transform.applyY(n.y) } : null
    })
    .on("start", (e) => {
      if (!e.subject) return
      const n = e.subject.node
      dragging = true; dragMoved = false; camaraTocada = true; hover = n
      canvas.classList.add("dragging")
      if (!e.active) sim.alphaTarget(0.25).restart()
      n.fx = n.x; n.fy = n.y
    })
    .on("drag", (e) => {
      if (!e.subject) return
      dragMoved = true
      e.subject.node.fx = transform.invertX(e.x)
      e.subject.node.fy = transform.invertY(e.y)
    })
    .on("end", (e) => {
      dragging = false; canvas.classList.remove("dragging")
      if (!e.active) sim.alphaTarget(0)
      if (e.subject) { e.subject.node.fx = null; e.subject.node.fy = null }
    })

  d3.select(canvas).call(dragBehavior).call(zoomBehavior)

  // El hueco que las islas no tapan: ahí se encaja el grafo.
  function rectVisible() {
    const pad = 12
    let x0 = pad, y0 = pad, x1 = W - pad, y1 = H - pad
    const s = stackEl.getBoundingClientRect()
    if (s.width > W * 0.6) y1 = Math.min(y1, s.top - pad); else x0 = Math.max(x0, s.right + pad)
    const north = northEl.getBoundingClientRect()
    y0 = Math.max(y0, north.bottom + pad)
    if (dockOpen()) {
      const d = dockEl.getBoundingClientRect()
      if (d.width < W * 0.9) x1 = Math.min(x1, d.left - pad)
    }
    if (x1 - x0 < 120 || y1 - y0 < 120) return { x0: pad, y0: pad, x1: W - pad, y1: H - pad }
    return { x0, y0, x1, y1 }
  }

  function fit(nodes, scale) {
    const set = nodes && nodes.length ? nodes : graph ? graph.nodes : []
    if (!set.length) return
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
    for (const n of set) {
      x0 = Math.min(x0, n.x); y0 = Math.min(y0, n.y)
      x1 = Math.max(x1, n.x); y1 = Math.max(y1, n.y)
    }
    const v = rectVisible()
    const vw = v.x1 - v.x0, vh = v.y1 - v.y0
    const pad = 40, w = Math.max(x1 - x0, 1), h = Math.max(y1 - y0, 1)
    const k = Math.max(0.15, Math.min(scale || 2.4, (vw - pad) / w, (vh - pad) / h))
    const to = d3.zoomIdentity
      .translate(v.x0 + vw / 2 - k * (x0 + x1) / 2, v.y0 + vh / 2 - k * (y0 + y1) / 2).scale(k)
    // En una pestaña oculta el navegador no despacha requestAnimationFrame y la transición
    // nunca avanza: ahí se aplica de golpe. La animación es solo para quien está mirando.
    if (document.visibilityState === "hidden" || REDUCED_MOTION) {
      d3.select(canvas).call(zoomBehavior.transform, to)
      return
    }
    d3.select(canvas).transition().duration(450).call(zoomBehavior.transform, to)
  }

  // Seleccionar no mueve la cámara. `zoomTo` la mueve solo cuando el lector lo pide.
  function select(n, zoomTo = false) {
    selected = n
    renderSel()
    if (zoomTo) {
      const hood = [n, ...[...(graph.adj.get(n.id) || [])].map((id) => graph.idx.get(id)).filter(Boolean)]
      fit(hood, 2.6)
    }
    tick()
  }

  function clearAll() {
    if (tabs.length) closePeek()
    closeMenu()
    selected = null; hover = null
    limpiarBusqueda()
    tip.style.display = "none"
    renderSel(); tick()
  }

  async function cambiarModo(id) {
    curMode = id
    // Un modo puede vivir sobre otro corpus: se carga la primera vez y queda en caché.
    const url = modeGraphUrl(modeById(display, id), urlNivel)
    if (url !== urlActual) {
      statsEl.textContent = t("stats.loading")
      data = await cargarGrafo(url)
      urlActual = url
    }
    selected = null
    // Los filtros se reconstruyen desde cero: si el modo nuevo agrupa por otra cosa,
    // conservar lo marcado dejaría el grafo vacío.
    checkedTypes = null; checkedEdges = null
    restart()
  }

  // ---- teclado y cadena de cierre ----------------------------------------------------------
  const escribiendo = (el) => el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") {
      if (document.activeElement === q) return
      const paso = dismissOrder({ menu, results: resultsOpen(), selected, dock: dockOpen() })
      if (paso === "menu") closeMenu()
      else if (paso === "results") hideResults()
      else if (paso === "selection") { selected = null; renderSel(); tick() }
      else if (paso === "dock") closePeek()
      return
    }
    if (escribiendo(document.activeElement)) return
    if (ev.metaKey || ev.ctrlKey || ev.altKey) return
    if (ev.key === "/") { ev.preventDefault(); q.focus(); q.select(); return }
    // Una tecla imprimible en cualquier sitio va a la omnibar: se enfoca antes de que el
    // navegador inserte el carácter, y este cae dentro de la caja.
    if (ev.key.length === 1) q.focus()
  })
  document.addEventListener("pointerdown", (ev) => {
    if (menu && !ev.target.closest("#side, #filters")) closeMenu()
    if (resultsOpen() && !ev.target.closest("#omnibar, #results")) hideResults()
  }, true)
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => tick())

  // ---- arranque ------------------------------------------------------------------------------
  const back = $("pback")
  back.href = (CFG.backTo && CFG.backTo.href) || "/"
  back.textContent = "← " + ((CFG.backTo && CFG.backTo.label) || t("back.default"))
  renderTrail()
  resize(); restart()

  // ?focus=<slug> centra el grafo en una nota; ?graph=<id> abre ya dentro de un subgrafo.
  const params = new URLSearchParams(location.search)
  const focus = params.get("focus")
  const subgrafo = params.get("graph")
  ;(async () => {
    if (subgrafo) await entrarDirecto(subgrafo)
    if (focus) await entrarConFoco(focus)
  })()

  // Los modos pueden filtrar lo que dibujan, así que la nota no tiene por qué existir en el
  // modo activo: se recorren en orden y se abre en el primero que la contenga.
  async function enfocarEnGrafoActual(keys) {
    let n = findNode(graph.nodes, keys)
    if (n) return n
    const inicial = curMode
    for (const m of display.modes) {
      if (m.id === inicial) continue
      await activarModo(m.id)
      n = findNode(graph.nodes, keys)
      if (n) return n
    }
    await activarModo(inicial)
    return null
  }

  async function activarModo(id) {
    curMode = id
    const url = modeGraphUrl(modeById(display, id), urlNivel)
    if (url !== urlActual) {
      data = await cargarGrafo(url)
      urlActual = url
    }
    checkedTypes = null; checkedEdges = null
    restart(false)
  }

  // Si la nota no está en este grafo, se busca en todos los publicados y se entra en el suyo.
  async function entrarConFoco(valor) {
    const keys = focusKeys(valor)
    let n = await enfocarEnGrafoActual(keys)
    if (n) return marcarYEncuadrar(n)
    await loadGraphs(registry, [...registry.keys()], fetchGraph)
    const otros = [...registry.values()].filter((e) => e.key !== currentKey())
    const hit = resolveFocus(keys, [{ key: currentKey(), model: data }, ...otros])
    if (!hit) { console.warn(`[quartz-okf-explorer] ${t("focus.missing", { focus: valor })}`); return }
    if (hit.key !== currentKey() && !(await irAGrafo(hit.key))) return
    n = await enfocarEnGrafoActual([hit.node.id.toLowerCase()])
    if (n) marcarYEncuadrar(n)
  }

  // Marcar y encuadrar son dos momentos: se marca ya; el encuadre espera a que la simulación
  // se asiente, y se cancela si para entonces el lector ya movió la cámara él mismo.
  function marcarYEncuadrar(n) {
    select(n)
    sim.on("end.focus", () => {
      sim.on("end.focus", null)
      if (!camaraTocada) select(n, true)
    })
  }
})
