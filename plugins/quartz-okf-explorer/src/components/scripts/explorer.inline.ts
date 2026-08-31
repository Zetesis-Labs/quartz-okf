import { h, render } from "preact"
import { translator } from "../../../lib/i18n.ts"
import { indexGraph } from "../../../lib/model.ts"
import { fill } from "../../../lib/template.ts"
import type { ExplorerEmitConfig, RawGraph } from "../../../lib/types.ts"
import { searchWithState, stateFromSearch } from "../../../lib/url-state.ts"
import { createActions } from "../../hud/actions.ts"
import { createEngine } from "../../hud/canvas/engine.ts"
import { HudContext, type HudApi } from "../../hud/context.ts"
import { createController } from "../../hud/controller.ts"
import { Hud } from "../../hud/Hud.tsx"
import { createState } from "../../hud/state.ts"

/**
 * Boot of the in-page explorer, run on every page load and SPA navigation: wires the
 * widget, opens the explorer when the URL asks for it, and mounts the HUD into a stage
 * appended to <body> — one document, no frame.
 */
const STAGE_ID = "okf-explorer-stage"

let mounted: { stage: HTMLElement; cleanup(): void } | null = null

// How many entries the explorer pushed since it opened travels in the history state itself,
// so a back or forward keeps it right without any counter of ours.
const depthOf = (): number => (history.state && typeof history.state.okfDepth === "number" ? history.state.okfDepth : 0)

function readConfig(): ExplorerEmitConfig | null {
  const host = document.querySelector<HTMLElement>(".okf-explorer[data-cfg]")
  if (!host?.dataset.cfg) return null
  try {
    return JSON.parse(host.dataset.cfg) as ExplorerEmitConfig
  } catch (err) {
    console.error(`[quartz-okf-explorer] data-cfg is not JSON: ${err instanceof Error ? err.message : String(err)}`)
    return null
  }
}

function currentSlug(): string {
  // `location.pathname` arrives percent-encoded and the graph's slugs carry their accents as
  // they are: without decoding, no note with a non-ASCII character would ever match.
  let p: string
  try {
    p = decodeURIComponent(location.pathname)
  } catch {
    p = location.pathname
  }
  p = p.replace(/^\/+|\/+$|\.html$/g, "")
  return p && p !== "index" ? p : ""
}

function writeUrl(graph: string | null, focus: string | null, mode: "push" | "replace"): void {
  const search = searchWithState(location.search, { open: true, graph, focus })
  const url = location.pathname + search + location.hash
  if (mode === "push") history.pushState({ okfExplorer: true, okfDepth: depthOf() + 1 }, "", url)
  else history.replaceState({ okfExplorer: true, okfDepth: depthOf() }, "", url)
}

function unmount(): void {
  if (!mounted) return
  render(null, mounted.stage)
  mounted.cleanup()
  mounted.stage.remove()
  mounted = null
  document.documentElement.classList.remove("okf-explorer-open")
}

// Closing walks back over the entries the explorer pushed, so the page's history is what it
// was before it opened; opened from a link, there is nothing to walk back and the URL is cleaned.
function close(): void {
  if (!mounted) return
  const depth = depthOf()
  if (depth > 0) {
    history.go(-depth)
    return
  }
  history.replaceState(null, "", location.pathname + searchWithState(location.search, { open: false, graph: null, focus: null }) + location.hash)
  unmount()
}

async function open(cfg: ExplorerEmitConfig, initial: { graph: string | null; focus: string | null }): Promise<void> {
  if (mounted) return
  const pagePath = location.pathname
  const t = translator(cfg.wording)
  const stage = document.createElement("div")
  stage.id = STAGE_ID
  stage.className = "okf-explorer-stage"
  stage.dataset.surfaces = cfg.hud.surfaces
  for (const [k, v] of Object.entries(cfg.hud.tokens)) stage.style.setProperty(k, v)
  stage.setAttribute("role", "dialog")
  stage.setAttribute("aria-modal", "true")
  stage.setAttribute("aria-label", cfg.title || t("title.default"))
  document.body.appendChild(stage)
  document.documentElement.classList.add("okf-explorer-open")

  let raw: RawGraph
  try {
    const r = await fetch(cfg.graphUrl)
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    raw = (await r.json()) as RawGraph
  } catch (err) {
    // Without the starting graph there is no explorer: the stage says which file was missing.
    const msg = t("error.load", { url: cfg.graphUrl, message: err instanceof Error ? err.message : String(err) })
    console.error(`[quartz-okf-explorer] ${msg}`)
    stage.textContent = msg
    mounted = { stage, cleanup: () => {} }
    return
  }

  const state = createState(cfg, t, indexGraph(raw))
  const engine = createEngine(cfg, { selected: state.selected, searchQuery: state.searchQuery, keyboardFocus: state.keyboardFocus })
  const ctl = createController({
    cfg,
    t,
    state,
    engine,
    history: {
      push: (graph) => writeUrl(graph, null, "push"),
      replace: (graph) => writeUrl(graph, null, "replace"),
    },
    onClose: unmount,
  })
  const actions = createActions({
    cfg,
    t,
    state,
    ctl,
    engine,
    close,
    navigate: (url) => {
      close()
      const target = new URL(url, location.href)
      if (window.spaNavigate) void window.spaNavigate(target)
      else location.href = target.href
    },
    omnibar: () => stage.querySelector<HTMLInputElement>("#q"),
    canvasRect: () => stage.querySelector("canvas")?.getBoundingClientRect() ?? null,
  })
  const api: HudApi = { cfg, t, state, ctl, engine, actions }

  // Quartz's router re-fetches the page on every popstate, whatever changed. A step of the
  // explorer's own history changes only the search of the same page: it is taken here, in
  // the capture phase, before the router sees it — the page stays, the HUD moves.
  const onPop = (ev: PopStateEvent) => {
    if (location.pathname !== pagePath) return
    ev.stopImmediatePropagation()
    void ctl.popstate(stateFromSearch(location.search))
  }
  window.addEventListener("popstate", onPop, true)
  mounted = { stage, cleanup: () => window.removeEventListener("popstate", onPop, true) }
  render(h(HudContext.Provider, { value: api }, h(Hud, { initial })), stage)
}

function wireWidget(cfg: ExplorerEmitConfig): void {
  const host = document.querySelector<HTMLElement>(".okf-explorer")
  if (!host || host.dataset.okfWired === "1") return
  host.dataset.okfWired = "1"
  const openHere = () => {
    const focus = currentSlug() || null
    writeUrl(null, focus, "push")
    void open(cfg, { graph: null, focus })
  }
  host.querySelector(".okf-explorer-preview")?.addEventListener("click", openHere)
  host.querySelector(".okf-explorer-open")?.addEventListener("click", openHere)
  // The count comes from the graph itself: it is not written into the plugin.
  const stats = host.querySelector<HTMLElement>("[data-okf-stats]")
  if (stats) {
    fetch(cfg.graphUrl)
      .then((r) => (r.ok ? (r.json() as Promise<RawGraph>) : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((g) => {
        const notes = (g.stats && g.stats.notes) || (g.nodes || []).length
        const edges = (g.stats && g.stats.edges) || (g.edges || []).length
        stats.textContent = fill(cfg.wording["access.stats"], { notes, edges })
      })
      .catch(() => stats.remove())
  }
}

function boot(): void {
  const cfg = readConfig()
  if (!cfg) return
  wireWidget(cfg)
  const url = stateFromSearch(location.search)
  if (url.open && !mounted) void open(cfg, { graph: url.graph, focus: url.focus })
}

boot()
document.addEventListener("nav", boot)
// The SPA router swaps the page: an open explorer is unmounted first, its listeners with it.
document.addEventListener("prenav", unmount)
