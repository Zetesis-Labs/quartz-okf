# Quickstart: the in-page explorer (004)

The pure decisions are covered by `plugins/quartz-okf-explorer/test/*.test.ts` (`npm test`)
and the components type-check in the repo gate (`npm run typecheck`). The shell's gate is
this walk on a real consumer build.

## 1. Build a consumer against the working tree

```bash
TOOLKIT=~/Developer/quartz-okf
CONSUMER=~/Developer/cern-it-governance-graph        # GitHub: Zetesis-Labs/cern-graph
CACHE=${XDG_CACHE_HOME:-$HOME/.cache}/cern-it-governance-okf
rsync -a --delete --exclude node_modules --exclude .git --exclude specs \
  --exclude 'plugins/*/dist' "$TOOLKIT/" "$CACHE/toolkit-local-dev/"
rm -rf "$CACHE"/toolkit-local-dev/plugins/*/dist      # a stale dist is used as-is by Quartz
( cd "$CONSUMER" && cp okf/quartz-okf.ref /tmp/ref.bak && echo local-dev > okf/quartz-okf.ref \
  && ./okf/build-site.sh; cp /tmp/ref.bak okf/quartz-okf.ref )
```

Expected in the build log: `quartz-okf built`, `quartz-okf-explorer built`,
`[okf] federation: … mounted`, `[okf] knowledge graph: 26 typed notes, 72 edges`, and no
`Failed to instantiate plugin` line (that one means a plugin's dist could not import the
contract — usually a stale `dist/`). The plugin's build prints the inline script's size and
the stylesheet's.

The consumer declares the plugin with `layout: { position: right, priority: 15 }`.

Serve it: `cd $CONSUMER && python3 serve.py 8768` (restart it after every rebuild — it
`chdir`s into `public/`, which the build replaces).

## 2. The walk (1440×900, then 390×844)

| Step | Expect |
|---|---|
| Open a mounted note (`/it-governance/compute/batch-service`) | The right sidebar shows *Knowledge graph*, the preview, *Open the graph* and `26 notes · 72 typed relations`. |
| Press *Open the graph* | The explorer covers the page; URL gains `?explorer&focus=…` then `?explorer&graph=it-governance` (the note lives in the child): trail `CERN graph › CERN IT Governance & Identity`, the note selected and framed, its capsule bottom-left, the child's modes, `Types 19 › Relations 33 ›`, `274 nodes · 806 links`. No console error. |
| Hover a node, click it | Tooltip; the note opens in the dock under the bar, right side, with the site's article. The bar keeps the whole width; the omnibar centres on the free canvas. |
| `📍` in the dock, then click another node, then `»` | The first note becomes a chip in the bar; the second replaces the dock's note; `»` hides the dock, the chip stays; clicking the chip brings the note back. |
| Pin several until they overflow | The trail keeps its width; the pins scroll sideways. |
| Type `token`, `⇥`, `⏎` on a result | Results with dot and kind; scope cycles to *all graphs* with badges; activating enters that graph with the note selected. |
| Type `>fi`, `⏎` | The palette lists *Fit the graph in view*; `⏎` fits. |
| Right-click a node / the background | Menu with open, open in a new tab, pin, frame, explore (portals), copy link / fit, clear. |
| `⇥` ×3, `Space` | A dashed ring walks three nodes; `Space` opens the menu at the node. |
| Click `CERN graph` in the trail | Back at the root with the portal selected; the `Explore ↘` pill follows the portal. |
| Select a loaned note (dashed ring) and press its `Explore` | The child opens with that note selected. |
| Browser back, twice | Parent graph with the portal selected; then the note page, URL clean, no reload. |
| `Esc` with nothing open | Closes the explorer; the page is where it was. |
| Open `/static/explorer?graph=it-governance&focus=it-governance/compute/batch-service` | Forwards to `/?explorer&graph=…&focus=…` and opens inside the child with the note selected. |
| `hud.ground: "dots"` in the consumer | A dot grid parallaxes under the graph. |
| 390×844 | The bar wraps (pins on a second line) and never hides; the dock takes the width under it; the stack spans the width. |
