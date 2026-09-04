import { displayFor, modeById, modeGraphUrl } from "../../lib/display.ts"
import { activateTab, closeTab, dockOpen, hideDock, openTab, pinTab } from "../../lib/dock.ts"
import { carriedFocus, findNode, focusKeys, resolveFocus } from "../../lib/focus.ts"
import { indexGraph } from "../../lib/model.ts"
import { cutFragment } from "../../lib/note-cut.ts"
import {
  backTo as backToLevel,
  currentKey,
  currentPath,
  directEntry,
  enterLevel,
  inSubgraph,
  popAction,
  withRootContext,
  type Level,
} from "../../lib/navigation.ts"
import { expandRegistry, loadGraphs, registryFrom } from "../../lib/registry.ts"
import { routeTo } from "../../lib/route.ts"
import { nextScope, scopesFor, searchAcross } from "../../lib/search.ts"
import type { ExplorerEmitConfig, HudDisplay, HudModel, RawGraph, SearchGraph, SearchRow, Translator, ViewNode } from "../../lib/types.ts"
import type { ExplorerUrlState } from "../../lib/url-state.ts"
import { buildView } from "../../lib/view.ts"
import { baseDisplay } from "../../lib/display.ts"
import type { Engine } from "./canvas/engine.ts"
import type { HudState, TabContent } from "./state.ts"

/**
 * The effectful half of the HUD: fetching graph documents and note pages, moving between
 * graphs, writing history, and telling the engine what to draw. Every decision it applies
 * comes from `lib/`; what is left here is sequencing and I/O.
 */
export interface HistoryPort {
  push(graph: string | null): void
  replace(graph: string | null): void
}

export interface ControllerOptions {
  cfg: ExplorerEmitConfig
  t: Translator
  state: HudState
  engine: Engine
  history: HistoryPort
  onClose(): void
}

export interface Controller {
  start(initial: { graph: string | null; focus: string | null }): Promise<void>
  restart(refit?: boolean): void
  changeMode(id: string): Promise<void>
  applyFilter(kind: "types" | "edges", set: Set<string> | null): void
  enterSubgraph(n: ViewNode, opts?: { push?: boolean }): Promise<boolean>
  backTo(level: number, opts?: { push?: boolean }): Promise<boolean>
  enterDirect(id: string): Promise<boolean>
  goToGraph(key: string): Promise<boolean>
  enterWithFocus(value: string): Promise<void>
  search(): void
  toggleScope(): void
  clearSearch(opts?: { restore?: boolean }): void
  hideResults(): void
  showResults(): void
  moveHighlight(delta: number): void
  activateHit(hit: SearchRow | undefined): Promise<void>
  select(n: ViewNode, zoomTo?: boolean, opts?: { instant?: boolean }): void
  deselect(): void
  openNote(n: ViewNode): void
  pinNote(id: string, pinned?: boolean): void
  activateTab(id: string): void
  closeTab(id: string): void
  closeDock(): void
  fit(nodes?: ViewNode[] | null, scale?: number | null): void
  frame(n: ViewNode): void
  clearAll(): void
  popstate(url: ExplorerUrlState): Promise<void>
  toast(message: string): void
  displayOf(key: string): HudDisplay
  graphCount(): number
}

async function fetchGraph(url: string): Promise<RawGraph> {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.json() as Promise<RawGraph>
}

export function createController({ cfg, t, state, engine, history, onClose }: ControllerOptions): Controller {
  const BASE = baseDisplay(cfg, t)
  const GRAPH_BASE = cfg.graphUrl
  const urlOfSubgraph = (id: string) => `/static/okf-subgraphs/${encodeURIComponent(id)}.json`
  const graphs = new Map<string, Promise<HudModel>>()
  const registry = registryFrom(state.data.value, { title: state.rootTitle, url: GRAPH_BASE })
  let searchCamera: { transform: ReturnType<Engine["transform"]>; moves: number } | null = null
  let toastTimer: ReturnType<typeof setTimeout> | undefined

  // Moving between graphs awaits a document and then rewrites the level stack and the
  // history: two moves in flight would interleave those writes. Every move the HUD asks
  // for runs after the previous one has finished; the internal steps of a move call the
  // unqueued functions.
  let chain: Promise<unknown> = Promise.resolve()
  function serial<T>(task: () => Promise<T>): Promise<T> {
    const run = chain.then(task, task)
    chain = run.catch(() => undefined)
    return run
  }

  function loadGraph(url: string): Promise<HudModel> {
    // A failure is not kept: the next attempt asks for the file again.
    if (!graphs.has(url)) {
      graphs.set(
        url,
        fetchGraph(url)
          .then(indexGraph)
          .catch((err: unknown) => {
            graphs.delete(url)
            throw err
          }),
      )
    }
    return graphs.get(url) as Promise<HudModel>
  }

  // A file that does not arrive does not leave the HUD half-done: it is fetched before the
  // state is touched, and where it said "loading…" the reader reads what was missing.
  async function loadOrWarn(url: string): Promise<HudModel | null> {
    state.status.value = t("stats.loading")
    try {
      return await loadGraph(url)
    } catch (err) {
      const msg = t("error.load", { url, message: err instanceof Error ? err.message : String(err) })
      state.status.value = msg
      console.warn(`[quartz-okf-explorer] ${msg}`)
      return null
    }
  }

  const mode = () => modeById(state.display.value, state.modeId.value)

  function restart(refit = true): void {
    const previous = state.view.value
    const m = mode()
    const view = buildView(state.data.value, state.display.value, m, { types: state.checkedTypes.value, edges: state.checkedEdges.value })
    const sel = state.selected.value
    state.selected.value = sel ? (view.idx.get(sel.id) ?? null) : null
    const kf = state.keyboardFocus.value
    state.keyboardFocus.value = kf ? (view.idx.get(kf.id) ?? null) : null
    state.view.value = view
    engine.setView(view, { display: state.display.value, mode: m, refit })
    void previous
    updateStatus()
  }

  function updateStatus(): void {
    const v = state.view.value
    if (v) state.status.value = t("stats", { nodes: v.nodes.length, links: v.links.length })
  }

  async function changeGraph(url: string, modeId?: string): Promise<boolean> {
    const next = await loadOrWarn(url)
    if (!next) return false
    state.data.value = next
    state.urlCurrent.value = url
    state.urlLevel.value = url
    const id = state.levels.value.currentId
    if (id) {
      if (!registry.has(id)) registry.set(id, { key: id, title: next.title, url, path: [id], model: null, error: null })
      expandRegistry(registry, id, next)
    }
    state.display.value = displayFor(BASE, next, { inSubgraph: inSubgraph(state.levels.value), t })
    const modes = state.display.value.modes
    state.modeId.value = modeId && modes.some((m) => m.id === modeId) ? modeId : modes[0].id
    state.checkedTypes.value = null
    state.checkedEdges.value = null
    state.selected.value = null
    state.keyboardFocus.value = null
    state.sideMenu.value = null
    state.contextMenu.value = null
    hideResults()
    if (dockOpen(state.dock.value)) closeDock()
    // Camera to zero and layout from scratch: the previous graph's framing and positions mean nothing here.
    engine.resetCamera()
    state.view.value = null
    restart()
    return true
  }

  const here = (): Level => ({
    url: state.urlCurrent.value,
    selectedId: state.selected.value?.id ?? null,
    title: state.data.value.title,
    modeId: state.modeId.value,
    id: state.levels.value.currentId,
  })

  async function enterSubgraph(n: ViewNode, { push = true } = {}): Promise<boolean> {
    if (!n.subgraph) return false
    if (!(await loadOrWarn(n.subgraph.graph))) return false
    // A selected note on loan from this subgraph is the reader's thread: it stays selected inside.
    const carried = carriedFocus(state.selected.value, n.subgraph.id)
    state.levels.value = enterLevel(state.levels.value, here(), n.subgraph.id)
    if (push) history.push(n.subgraph.id)
    if (!(await changeGraph(n.subgraph.graph))) return false
    if (carried) {
      const inside = await focusInCurrent(carried)
      if (inside) markAndFrame(inside)
    }
    return true
  }

  async function backTo(level: number, { push = true } = {}): Promise<boolean> {
    const move = backToLevel(state.levels.value, level)
    if (!move) return false
    if (!(await loadOrWarn(move.destination.url))) return false
    state.levels.value = move.levels
    if (push) history.push(move.levels.currentId)
    await changeGraph(move.destination.url, move.destination.modeId)
    const n = move.destination.selectedId ? state.view.value?.idx.get(move.destination.selectedId) : null
    if (n) select(n)
    return true
  }

  // Opened straight on a subgraph: the way back is told by the file itself, which knows from
  // which graph and portal it was published.
  async function enterDirect(id: string): Promise<boolean> {
    const url = registry.has(id) ? (registry.get(id)?.url ?? urlOfSubgraph(id)) : urlOfSubgraph(id)
    if (!(await loadOrWarn(url))) return false
    state.levels.value = directEntry(GRAPH_BASE, BASE.modes[0].id, id)
    history.replace(id)
    await changeGraph(url)
    state.levels.value = withRootContext(state.levels.value, state.data.value.federatedFrom)
    return true
  }

  // Go to any graph of the registry: back to the common ancestor, then one dive per portal.
  async function goToGraph(key: string): Promise<boolean> {
    const target = registry.get(key)
    if (!target) return false
    for (const step of routeTo(currentPath(state.levels.value), target.path)) {
      if ("back" in step) {
        if (!(await backTo(step.back))) return false
        continue
      }
      const portal = [...state.data.value.nodes.values()].find((n) => n.subgraph && n.subgraph.id === step.dive)
      if (!portal) {
        console.warn(`[quartz-okf-explorer] ${t("route.missing", { graph: step.dive })}`)
        return false
      }
      const onScreen = state.view.value?.idx.get(portal.id) ?? (portal as ViewNode)
      if (!(await enterSubgraph(onScreen))) return false
    }
    return true
  }

  async function popstate(url: ExplorerUrlState): Promise<void> {
    const action = popAction(state.levels.value, url)
    if ("close" in action) {
      onClose()
      return
    }
    if ("back" in action) {
      await backTo(action.back, { push: false })
      return
    }
    if ("enter" in action) {
      const portal = [...state.data.value.nodes.values()].find((n) => n.subgraph && n.subgraph.id === action.enter)
      if (portal) await enterSubgraph(state.view.value?.idx.get(portal.id) ?? (portal as ViewNode), { push: false })
      else await enterDirect(action.enter)
    }
  }

  // ---- modes and filters ------------------------------------------------------------------------
  async function loadModeDocument(id: string): Promise<boolean> {
    // A mode may live on another corpus: it is loaded the first time and stays cached.
    const url = modeGraphUrl(modeById(state.display.value, id), state.urlLevel.value)
    if (url !== state.urlCurrent.value) {
      const next = await loadOrWarn(url)
      if (!next) return false
      state.data.value = next
      state.urlCurrent.value = url
    }
    state.modeId.value = id
    // Filters are rebuilt from scratch: if the new mode groups by something else, keeping the
    // checked ones would leave the graph empty.
    state.checkedTypes.value = null
    state.checkedEdges.value = null
    return true
  }

  async function changeMode(id: string): Promise<void> {
    if (!(await loadModeDocument(id))) return
    state.selected.value = null
    restart()
  }

  async function activateMode(id: string): Promise<void> {
    if (!(await loadModeDocument(id))) return
    restart(false)
  }

  function applyFilter(kind: "types" | "edges", set: Set<string> | null): void {
    if (kind === "types") state.checkedTypes.value = set
    else state.checkedEdges.value = set
    restart(false)
  }

  // ---- search ---------------------------------------------------------------------------------------
  const scopes = () => scopesFor(registry.size, t)

  function displayOf(key: string): HudDisplay {
    if (key === currentKey(state.levels.value)) return state.display.value
    const model = registry.get(key)?.model
    return model ? displayFor(BASE, model, { inSubgraph: key !== "", t }) : state.display.value
  }

  function graphsToSearch(): SearchGraph[] {
    const view = state.view.value
    const current: SearchGraph = {
      key: currentKey(state.levels.value),
      title: state.data.value.title,
      model: view ? { ...state.data.value, nodes: view.idx } : state.data.value,
      current: true,
      kindOrder: state.display.value.kindOrder,
    }
    if (state.scope.value !== "all") return [current]
    const others = [...registry.values()]
      .filter((e) => e.key !== current.key)
      .map((e) => ({
        key: e.key,
        title: e.title,
        model: e.model,
        error: e.error,
        current: false,
        kindOrder: e.model?.display?.typeOrder || e.model?.display?.knowledgeTypes || BASE.kindOrder,
      }))
    return [current, ...others]
  }

  async function ensureGraphs(): Promise<void> {
    const missing = [...registry.values()].filter((e) => !e.model && !e.error).map((e) => e.key)
    if (!missing.length) return
    state.loadingGraphs.value = true
    await loadGraphs(registry, missing, fetchGraph)
    state.loadingGraphs.value = false
  }

  function search(): void {
    const q = state.searchQuery.value
    if (state.palette.value) {
      state.hits.value = []
      state.unavailable.value = []
      state.highlight.value = 0
      state.resultsOpen.value = true
      return
    }
    if (!q) {
      state.hits.value = []
      state.unavailable.value = []
      hideResults()
      return
    }
    if (!searchCamera) searchCamera = { transform: engine.transform(), moves: engine.userMoves() }
    const list = () => {
      const r = searchAcross(graphsToSearch(), q, { limit: 20 })
      state.hits.value = r.rows
      state.unavailable.value = r.unavailable
      state.highlight.value = 0
      state.resultsOpen.value = true
    }
    if (state.scope.value === "all") void ensureGraphs().then(list)
    else list()
  }

  function toggleScope(): void {
    state.scope.value = nextScope(state.scope.value, scopes()) as "graph" | "all"
    if (state.searchQuery.value) search()
  }

  function hideResults(): void {
    state.resultsOpen.value = false
  }

  function showResults(): void {
    if (state.query.value.trim()) state.resultsOpen.value = true
  }

  function clearSearch({ restore = false } = {}): void {
    state.query.value = ""
    state.hits.value = []
    state.unavailable.value = []
    hideResults()
    if (restore && searchCamera && engine.userMoves() === searchCamera.moves) engine.animateTo(searchCamera.transform)
    searchCamera = null
  }

  function moveHighlight(delta: number): void {
    const n = state.hits.value.length
    if (!n) return
    state.highlight.value = (state.highlight.value + delta + n) % n
  }

  async function activateHit(hit: SearchRow | undefined): Promise<void> {
    if (!hit) return
    clearSearch()
    if (hit.key === currentKey(state.levels.value)) {
      const n = state.view.value?.idx.get(hit.node.id)
      if (n) select(n, true)
      return
    }
    if (!(await goToGraph(hit.key))) return
    const n = await focusInCurrent([hit.node.id.toLowerCase()])
    if (n) markAndFrame(n)
  }

  // ---- focus ------------------------------------------------------------------------------------------
  // Modes may filter what they draw, so the note need not exist in the active mode: they are
  // walked in order and the first one containing it is opened.
  async function focusInCurrent(keys: string[]): Promise<ViewNode | null> {
    let n = findNode(state.view.value?.nodes ?? [], keys)
    if (n) return n
    const initial = state.modeId.value
    for (const m of state.display.value.modes) {
      if (m.id === initial) continue
      await activateMode(m.id)
      n = findNode(state.view.value?.nodes ?? [], keys)
      if (n) return n
    }
    await activateMode(initial)
    return null
  }

  // If the note is not in this graph, every published one is searched and its graph entered.
  async function enterWithFocus(value: string): Promise<void> {
    const keys = focusKeys(value)
    let n = await focusInCurrent(keys)
    if (n) {
      markAndFrame(n)
      return
    }
    await loadGraphs(registry, [...registry.keys()], fetchGraph)
    const key = currentKey(state.levels.value)
    const others = [...registry.values()].filter((e) => e.key !== key)
    const hit = resolveFocus(keys, [{ key, model: state.data.value }, ...others])
    if (!hit) {
      console.warn(`[quartz-okf-explorer] ${t("focus.missing", { focus: value })}`)
      return
    }
    if (hit.key !== key && !(await goToGraph(hit.key))) return
    n = await focusInCurrent([hit.node.id.toLowerCase()])
    if (n) markAndFrame(n)
  }

  // With the simulation already warm the arrival note is marked and framed at once — unless
  // the reader moved the camera meanwhile.
  function markAndFrame(n: ViewNode): void {
    select(n, !engine.cameraTouched(), { instant: true })
  }

  // ---- selection and dock -------------------------------------------------------------------------
  // Selecting does not move the camera; `zoomTo` moves it only when the reader asked for it.
  function select(n: ViewNode, zoomTo = false, { instant = false }: { instant?: boolean } = {}): void {
    state.selected.value = n
    if (zoomTo) frame(n, { instant })
  }

  function frame(n: ViewNode, { instant = false } = {}): void {
    const view = state.view.value
    if (!view) return
    const hood = [n, ...[...(view.adj.get(n.id) || [])].map((id) => view.idx.get(id)).filter((x): x is ViewNode => Boolean(x))]
    engine.fit(hood, 2.6, { instant })
  }

  function deselect(): void {
    state.selected.value = null
  }

  // The note is read, not run: nothing that executes or embeds survives the copy into the
  // explorer's own document — same origin or not, the dock is for reading.
  const INERT_TAGS = "script, iframe, object, embed, link, meta, base, form"
  function disarm(article: Element): void {
    for (const el of article.querySelectorAll(INERT_TAGS)) el.remove()
    for (const el of article.querySelectorAll("*")) {
      for (const attr of [...el.attributes]) {
        const name = attr.name.toLowerCase()
        const value = attr.value.trim().toLowerCase()
        if (name.startsWith("on") || ((name === "href" || name === "src" || name === "xlink:href") && value.startsWith("javascript:"))) {
          el.removeAttribute(attr.name)
        }
      }
    }
  }

  // A page is fetched once however many of its rows are read: a catalog note answers for
  // hundreds of nodes, and each one used to re-download it.
  const pages = new Map<string, Promise<Document>>()
  function pageOf(path: string): Promise<Document> {
    const known = pages.get(path)
    if (known) return known
    const pending = fetch(path).then(async (r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      return new DOMParser().parseFromString(await r.text(), "text/html")
    })
    pending.catch(() => pages.delete(path))
    pages.set(path, pending)
    return pending
  }

  async function fetchNote(url: string): Promise<string> {
    const [path, fragment] = url.split("#")
    const doc = await pageOf(path)
    const article = doc.querySelector("article") ?? doc.querySelector(".center")
    if (!article) throw new Error(t("dock.missing"))
    if (fragment) {
      const cut = cutFragment(doc, decodeURIComponent(fragment))
      if (cut) {
        const holder = doc.createElement("div")
        holder.innerHTML = cut
        disarm(holder)
        return holder.innerHTML
      }
      console.warn(`[quartz-okf-explorer] nothing in ${path} answers to #${fragment}: showing the whole note`)
    }
    disarm(article)
    return article.innerHTML
  }

  function loadNote(n: ViewNode): void {
    if (state.dockContent.value.has(n.id)) return
    const put = (content: TabContent) => {
      const next = new Map(state.dockContent.value)
      next.set(n.id, content)
      state.dockContent.value = next
    }
    put({ kind: "loading" })
    fetchNote(n.url).then(
      (html) => put({ kind: "html", html }),
      (err: unknown) => put({ kind: "error", message: t("dock.error", { url: n.url, message: err instanceof Error ? err.message : String(err) }) }),
    )
  }

  function openNote(n: ViewNode): void {
    state.dock.value = openTab(state.dock.value, n)
    state.selected.value = n
    loadNote(n)
  }

  function pinNote(id: string, pinned?: boolean): void {
    const tab = state.dock.value.tabs.find((x) => x.id === id)
    if (!tab) return
    state.dock.value = pinTab(state.dock.value, id, pinned ?? !tab.pinned)
  }

  function activateDockTab(id: string): void {
    state.dock.value = activateTab(state.dock.value, id)
    const n = state.view.value?.idx.get(id)
    if (n) state.selected.value = n
  }

  function closeDockTab(id: string): void {
    state.dock.value = closeTab(state.dock.value, id)
  }

  function closeDock(): void {
    state.dock.value = hideDock(state.dock.value)
  }

  function clearAll(): void {
    closeDock()
    state.sideMenu.value = null
    state.contextMenu.value = null
    state.selected.value = null
    state.keyboardFocus.value = null
    state.tip.value = null
    clearSearch()
  }

  function toast(message: string): void {
    state.toast.value = message
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => {
      state.toast.value = null
    }, 1800)
  }

  async function start({ graph, focus }: { graph: string | null; focus: string | null }): Promise<void> {
    restart()
    try {
      if (graph) await enterDirect(graph)
      if (focus) await enterWithFocus(focus)
    } catch (err) {
      console.error(`[quartz-okf-explorer] ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return {
    start: (initial) => serial(() => start(initial)),
    restart,
    changeMode: (id) => serial(() => changeMode(id)),
    applyFilter,
    enterSubgraph: (n, opts) => serial(() => enterSubgraph(n, opts)),
    backTo: (level, opts) => serial(() => backTo(level, opts)),
    enterDirect: (id) => serial(() => enterDirect(id)),
    goToGraph: (key) => serial(() => goToGraph(key)),
    enterWithFocus: (value) => serial(() => enterWithFocus(value)),
    search,
    toggleScope,
    clearSearch,
    hideResults,
    showResults,
    moveHighlight,
    activateHit: (hit) => serial(() => activateHit(hit)),
    select,
    deselect,
    openNote,
    pinNote,
    activateTab: activateDockTab,
    closeTab: closeDockTab,
    closeDock,
    fit: (nodes, scale) => engine.fit(nodes ?? null, scale ?? null),
    frame: (n) => frame(n),
    clearAll,
    popstate: (url) => serial(() => popstate(url)),
    toast,
    displayOf,
    graphCount: () => registry.size,
  }
}
