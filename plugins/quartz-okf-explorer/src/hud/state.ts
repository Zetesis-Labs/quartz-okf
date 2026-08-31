import { computed, signal, type ReadonlySignal, type Signal } from "@preact/signals"
import { isPaletteQuery, type MenuItem } from "../../lib/commands.ts"
import { baseDisplay, displayFor } from "../../lib/display.ts"
import { EMPTY_DOCK, type DockState } from "../../lib/dock.ts"
import { inSubgraph, ROOT_LEVELS, trailFor, type Levels, type TrailEntry } from "../../lib/navigation.ts"
import type { ExplorerEmitConfig, HudDisplay, HudModel, SearchRow, Translator, View, ViewNode } from "../../lib/types.ts"

/**
 * The HUD's application state, as signals: a component reads a field and re-renders when
 * that field changes. What the draw loop touches sixty times a second — positions, the
 * camera, hover, drag — is NOT here: it lives in the canvas engine as plain fields, so a
 * simulation tick never renders a component.
 */
export type TabContent = { kind: "loading" } | { kind: "html"; html: string } | { kind: "error"; message: string }

export interface Tip {
  node: ViewNode
  px: number
  py: number
}

export interface ContextMenuState {
  x: number
  y: number
  items: MenuItem[]
  node: ViewNode | null
}

export interface HudState {
  data: Signal<HudModel>
  display: Signal<HudDisplay>
  levels: Signal<Levels>
  urlCurrent: Signal<string>
  urlLevel: Signal<string>
  modeId: Signal<string>
  checkedTypes: Signal<Set<string> | null>
  checkedEdges: Signal<Set<string> | null>
  view: Signal<View | null>
  query: Signal<string>
  scope: Signal<"graph" | "all">
  hits: Signal<SearchRow[]>
  unavailable: Signal<string[]>
  highlight: Signal<number>
  loadingGraphs: Signal<boolean>
  resultsOpen: Signal<boolean>
  selected: Signal<ViewNode | null>
  keyboardFocus: Signal<ViewNode | null>
  sideMenu: Signal<"types" | "edges" | null>
  aboutOpen: Signal<boolean>
  dock: Signal<DockState>
  dockContent: Signal<Map<string, TabContent>>
  contextMenu: Signal<ContextMenuState | null>
  tip: Signal<Tip | null>
  status: Signal<string>
  toast: Signal<string | null>
  rootTitle: string
  inSubgraph: ReadonlySignal<boolean>
  trail: ReadonlySignal<TrailEntry[]>
  palette: ReadonlySignal<boolean>
  /** The lowercased text the canvas matches against — empty while the palette is open. */
  searchQuery: ReadonlySignal<string>
}

export function createState(cfg: ExplorerEmitConfig, t: Translator, initial: HudModel): HudState {
  const base = baseDisplay(cfg, t)
  const display = displayFor(base, initial, { inSubgraph: false, t })
  const levels = signal<Levels>(ROOT_LEVELS)
  const data = signal(initial)
  const query = signal("")
  const palette = computed(() => isPaletteQuery(query.value))
  return {
    data,
    display: signal(display),
    levels,
    urlCurrent: signal(cfg.graphUrl),
    urlLevel: signal(cfg.graphUrl),
    modeId: signal(display.modes[0].id),
    checkedTypes: signal<Set<string> | null>(null),
    checkedEdges: signal<Set<string> | null>(null),
    view: signal<View | null>(null),
    query,
    scope: signal<"graph" | "all">("graph"),
    hits: signal<SearchRow[]>([]),
    unavailable: signal<string[]>([]),
    highlight: signal(0),
    loadingGraphs: signal(false),
    resultsOpen: signal(false),
    selected: signal<ViewNode | null>(null),
    keyboardFocus: signal<ViewNode | null>(null),
    sideMenu: signal<"types" | "edges" | null>(null),
    aboutOpen: signal(false),
    dock: signal<DockState>(EMPTY_DOCK),
    dockContent: signal(new Map<string, TabContent>()),
    contextMenu: signal<ContextMenuState | null>(null),
    tip: signal<Tip | null>(null),
    status: signal(""),
    toast: signal<string | null>(null),
    rootTitle: cfg.title || t("graph.default"),
    inSubgraph: computed(() => inSubgraph(levels.value)),
    trail: computed(() => trailFor(levels.value, data.value.title)),
    palette,
    searchQuery: computed(() => (palette.value ? "" : query.value.trim().toLowerCase())),
  }
}
