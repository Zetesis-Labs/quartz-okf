import { fill } from "./template.ts"
import type { Translator } from "./types.ts"

const en: Record<string, string> = {
  "access.title": "Knowledge graph",
  "access.open": "Open the graph",
  "access.expand": "Expand",
  "access.reduce": "Reduce",
  "access.close": "Close",
  "access.loading": "Loading the graph…",
  "access.stats": "{notes|note|notes} · {edges|typed relation|typed relations}",
  "access.stats.loading": "loading…",
  "title.default": "Graph explorer",
  "graph.default": "Graph",
  "back.default": "home",
  "search.placeholder": "Search notes…",
  "search.placeholder.all": "Search every graph…",
  "search.hint": "/ to search · ⇥ scope · ↑↓ ⏎",
  "search.clear": "Clear the search",
  "scope.this": "this graph",
  "scope.all": "all graphs",
  "scope.toggle": "Search scope (⇥)",
  "results.none": "No note matches",
  "results.unavailable": "Not searched: {graph}",
  "results.loading": "Loading graphs…",
  "views.title": "Views",
  "views.back": "‹ {graph}",
  "views.about": "About this view",
  "mode.full": "Full graph",
  "mode.full.desc": "The whole graph with its typed relations.",
  "filters.title": "Filters",
  "filters.types": "Types",
  "filters.edges": "Relations",
  "filters.all": "All",
  "filters.none": "None",
  "filters.legend": "Legend",
  "filters.close": "Close menu",
  stats: "{nodes|node|nodes} · {links|link|links}",
  "stats.loading": "loading…",
  fit: "Fit",
  "fit.title": "Fit the graph in view",
  clear: "Clear",
  "clear.title": "Clear selection, search and open notes",
  "trail.back": "Back to {graph}",
  "trail.subgraph": "subgraph",
  "trail.hint": "Back: the level above, or the browser's back button",
  "tooltip.incoming": "{indeg|incoming link|incoming links}",
  "tooltip.portal": "{subgraph.notes|note|notes} · {subgraph.previewed|previewed|previewed}",
  "tooltip.portal.hint": "Double-click to enter its graph",
  "selection.incoming": "← {label}",
  "selection.explore": "Explore subgraph ↘",
  "selection.close": "Deselect",
  "portal.enter": "↘ {graph}",
  "portal.explore": "Explore ↘",
  "portal.title": "Enter {graph} — {notes|note|notes}",
  "dock.open": "Open",
  "dock.close": "Close panel",
  "dock.tab.pin": "Pin",
  "dock.tab.unpin": "Unpin",
  "dock.tab.close": "Close",
  "dock.tab.temp": "{title} — temporary tab, double-click to pin",
  "focus.missing": "focus \"{focus}\" is not in any published graph",
  "error.load": "could not load {url}: {message}",
  "route.missing": "no portal to \"{graph}\" in this graph",
}

const es: Record<string, string> = {
  "access.title": "Grafo de conocimiento",
  "access.open": "Abrir el grafo",
  "access.expand": "Ampliar",
  "access.reduce": "Reducir",
  "access.close": "Cerrar",
  "access.loading": "Cargando el grafo…",
  "access.stats": "{notes|nota|notas} · {edges|relación tipada|relaciones tipadas}",
  "access.stats.loading": "cargando…",
  "title.default": "Explorador del grafo",
  "graph.default": "Grafo",
  "back.default": "inicio",
  "search.placeholder": "Buscar nota…",
  "search.placeholder.all": "Buscar en todos los grafos…",
  "search.hint": "/ para buscar · ⇥ ámbito · ↑↓ ⏎",
  "search.clear": "Limpiar la búsqueda",
  "scope.this": "este grafo",
  "scope.all": "todos los grafos",
  "scope.toggle": "Ámbito de búsqueda (⇥)",
  "results.none": "Ninguna nota coincide",
  "results.unavailable": "Sin buscar: {graph}",
  "results.loading": "Cargando grafos…",
  "views.title": "Vistas",
  "views.back": "‹ {graph}",
  "views.about": "Sobre esta vista",
  "mode.full": "Grafo completo",
  "mode.full.desc": "El grafo entero, con sus relaciones tipadas.",
  "filters.title": "Filtros",
  "filters.types": "Tipos",
  "filters.edges": "Relaciones",
  "filters.all": "Todos",
  "filters.none": "Ninguno",
  "filters.legend": "Leyenda",
  "filters.close": "Cerrar menú",
  stats: "{nodes|nodo|nodos} · {links|enlace|enlaces}",
  "stats.loading": "cargando…",
  fit: "Encajar",
  "fit.title": "Encajar el grafo en pantalla",
  clear: "Limpiar",
  "clear.title": "Quitar selección, búsqueda y notas abiertas",
  "trail.back": "Volver a {graph}",
  "trail.subgraph": "subgrafo",
  "trail.hint": "Volver: el nivel anterior o el botón atrás del navegador",
  "tooltip.incoming": "{indeg|entrante|entrantes}",
  "tooltip.portal": "{subgraph.notes|nota|notas} · {subgraph.previewed|abierta|abiertas}",
  "tooltip.portal.hint": "Doble clic para entrar en su grafo",
  "selection.incoming": "← {label}",
  "selection.explore": "Explorar subgrafo ↘",
  "selection.close": "Quitar selección",
  "portal.enter": "↘ {graph}",
  "portal.explore": "Explorar ↘",
  "portal.title": "Entrar en {graph} — {notes|nota|notas}",
  "dock.open": "Abrir",
  "dock.close": "Cerrar panel",
  "dock.tab.pin": "Anclar",
  "dock.tab.unpin": "Desanclar",
  "dock.tab.close": "Cerrar",
  "dock.tab.temp": "{title} — pestaña temporal, doble clic para anclar",
  "focus.missing": "focus \"{focus}\" no está en ningún grafo publicado",
  "error.load": "no se pudo cargar {url}: {message}",
  "route.missing": "no hay portal a \"{graph}\" en este grafo",
}

export const CATALOGUES: Record<string, Record<string, string>> = { en, es }

export interface ResolvedLocale {
  locale: string
  problem: string | null
}

export function resolveLocale(requested: string | undefined, available: string[] = Object.keys(CATALOGUES)): ResolvedLocale {
  const language = String(requested || "")
    .toLowerCase()
    .split(/[-_]/)[0]
  if (available.includes(language)) return { locale: language, problem: null }
  return {
    locale: "en",
    problem: requested ? `locale "${requested}" has no wording catalogue; using "en"` : null,
  }
}

export function translator(catalogue: Record<string, string>): Translator {
  return (key, vars) => {
    if (!(key in catalogue)) throw new Error(`quartz-okf-explorer: unknown wording key "${key}"`)
    return vars ? fill(catalogue[key], vars) : catalogue[key]
  }
}

export interface Wording {
  t: Translator
  catalogue: Record<string, string>
  problems: string[]
}

export function makeT(locale: string, overrides: Record<string, string> = {}): Wording {
  const base = CATALOGUES[locale]
  if (!base) throw new Error(`quartz-okf-explorer: no wording catalogue for locale "${locale}"`)
  const problems: string[] = []
  const catalogue = { ...base }
  for (const [key, text] of Object.entries(overrides)) {
    if (key in base) catalogue[key] = text
    else problems.push(`wording key "${key}" is not an engine key`)
  }
  return { t: translator(catalogue), catalogue, problems }
}
