# Data model: HUD state, engine state, commands

**Feature**: `004-explorer-preact` · **Date**: 2026-08-31

## Pure modules (new, `plugins/quartz-okf-explorer/lib/`)

| Module | Types | Functions |
|---|---|---|
| `dock.ts` | `DockTab { id, title, type, url, pinned }`, `DockState { tabs, active }` | `openTab`, `pinTab`, `activateTab`, `closeTab`, `dockOpen`, `EMPTY_DOCK` |
| `navigation.ts` | `Level { url, selectedId, title, modeId, id }`, `Levels { stack, currentId }`, `PopAction` | `enterLevel`, `backTo`, `trailFor`, `currentPath`, `currentKey`, `levelOf`, `directEntry`, `withRootContext`, `popAction`, `inSubgraph` |
| `url-state.ts` | `ExplorerUrlState { open, graph, focus }` | `stateFromSearch`, `searchWithState`, `legacyRedirect` |
| `commands.ts` | `CommandEntry { id, label, keywords }`, `MenuItem { id?, label?, danger?, sep? }`, `CommandContext` | `commandList`, `matchCommands`, `isPaletteQuery`, `nodeMenuItems`, `backgroundMenuItems` |
| `spatial-nav.ts` | `NavNode { id, x?, y? }`, `Direction` | `nearestInDirection`, `nextSequential` |
| `canvas-rules.ts` | `FocusContext`, `LabelContext`, `WorldRect` | `nodeAlpha`, `drawnAlone`, `labelVisible`, `labelIsBold`, `linkAlpha`, `labelText`, `viewportOf`, `inViewport` |

The 002/003 modules are unchanged (`model`, `display`, `view`, `style`, `search`,
`focus`, `registry`, `route`, `hud`, `i18n`, `emit-config`, `template`, `viewport`).

## HUD state (`src/hud/state.ts`, signals)

```ts
interface HudState {
  data: Signal<HudModel>            // the graph on screen
  display: Signal<HudDisplay>       // vocabulary resolved for it
  levels: Signal<Levels>            // stack + currentId
  urlCurrent: Signal<string>        // document drawn (a mode may point elsewhere)
  urlLevel: Signal<string>          // document of the level (modes return to it)
  modeId: Signal<string>
  checkedTypes: Signal<Set<string> | null>
  checkedEdges: Signal<Set<string> | null>
  view: Signal<View>                // rebuilt by the engine on restart
  query: Signal<string>             // raw omnibar text ("> …" = palette)
  scope: Signal<"graph" | "all">
  hits: Signal<SearchRow[]>; unavailable: Signal<string[]>; highlight: Signal<number>
  loadingGraphs: Signal<boolean>
  selected: Signal<ViewNode | null>
  keyboardFocus: Signal<ViewNode | null>
  sideMenu: Signal<"types" | "edges" | null>
  aboutOpen: Signal<boolean>
  dock: Signal<DockState>
  dockContent: Signal<Map<string, TabContent>>   // loading | { html } | { error }
  contextMenu: Signal<{ x, y, items: MenuItem[], node: ViewNode | null } | null>
  status: Signal<string>            // the stats line, or the named load error
  toast: Signal<string | null>      // "Link copied"
}
```

Derived (computed): `trail`, `scopes`, `palette` (`isPaletteQuery(query)`),
`commands` (`commandList(ctx, t)`), `viewsIsland`, `filtersIsland`, `selectionView`.

## Engine state (`src/hud/canvas/engine.ts`, plain)

`view` (nodes with `x, y, vx, vy, fx, fy`), `transform`, `hover`, `dragging`,
`dragMoved`, `cameraTouched`, `searchCamera`, `firstFit`, `W`, `H`, `sim`.

Engine API: `mount(canvas)`, `setView(view, { refit })`, `fit(nodes?, scale?, { enter,
instant })`, `frame(node)`, `resetCamera()`, `restoreCamera(t)`, `nodeAt(px, py)`,
`positions()` (for portal buttons), `draw()`, `destroy()`. Events out: `onHover(node,
px, py)`, `onClick(node, ev)`, `onDblClick(node)`, `onContextMenu(node | null, x, y)`,
`onCameraTouched()`.

## Commands and menu ids

`fit`, `clear`, `mode:<id>`, `enter:<portalId>`, `back`, `open-selected`,
`pin-selected`, `explore-selected`, `close-dock`, `copy-link` (palette);
`open`, `open-new`, `pin`, `frame`, `explore`, `copy-link` (node menu, run against the
menu's node); `fit`, `clear` (background menu). One dispatcher in the shell.

## URL

`?explorer` · `graph=<id>` · `focus=<slug>`; other parameters of the page preserved.
Legacy: `/static/explorer?graph=&focus=` → `/?explorer&graph=&focus=`.

## Wording keys added

`dock.error`, `dock.missing`, `menu.open`, `menu.open.new`, `menu.pin`, `menu.frame`,
`menu.copy`, `menu.copied`, `cmd.mode`, `cmd.enter`, `cmd.open`, `cmd.pin`,
`cmd.explore`, `cmd.close.dock`, `cmd.copy`, `palette.label`, `palette.none`,
`keyboard.hint`; `access.close` reworded; `access.expand`/`access.reduce` removed.
