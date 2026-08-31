# Quickstart: Explorer HUD (tranche A)

The HUD has no unit tests of its own (canvas + DOM); its gate is this walk on a real
consumer build. The pure decisions behind every element are covered by
`plugins/quartz-okf-explorer/test/*.test.js` (`npm test`).

## 1. Build a consumer against the candidate toolkit

Without pushing anything, stage the working tree under a synthetic ref in the
consumer's cache and point the consumer at it:

```bash
TOOLKIT=~/Developer/quartz-okf
CONSUMER=~/Developer/cern-graph
CACHE=${XDG_CACHE_HOME:-$HOME/.cache}/cern-graph-okf
rsync -a --delete --exclude node_modules --exclude .git --exclude specs \
  --exclude 'plugins/*/dist' --include 'plugins/quartz-okf/dist/**' \
  "$TOOLKIT/" "$CACHE/toolkit-local-dev/"
cp "$TOOLKIT/plugins/quartz-okf/dist/index.js" "$CACHE/toolkit-local-dev/plugins/quartz-okf/dist/index.js"
( cd "$CONSUMER" && cp okf/quartz-okf.ref /tmp/ref.bak && echo local-dev > okf/quartz-okf.ref \
  && ./okf/build-site.sh; cp /tmp/ref.bak okf/quartz-okf.ref )
```

Expected in the build log:

```
[okf] federation: it-governance ← 274 notes, 18 previewed (…) mounted at /it-governance/
[okf] knowledge graph: 26 typed notes, 72 edges (0 unresolved)
✅ [okf] Sitio de grafo construido con éxito
```

No `[quartz-okf-explorer] warning:` line (wording keys and locale resolved).

Serve it: `cd $CONSUMER && python3 serve.py 8766` → <http://127.0.0.1:8766/static/explorer>.

To iterate on the HUD alone (no site rebuild), rebuild the plugin and re-run only the
emitter against `public/`:

```bash
( cd $TOOLKIT/plugins/quartz-okf-explorer && npm run build )
node -e '
  const p = await import(process.env.HOME + "/Developer/quartz-okf/plugins/quartz-okf-explorer/dist/index.js")
  const { explorer } = await import(process.env.HOME + "/Developer/cern-graph/okf.config.mjs")
  await p.OkfExplorer(explorer).emit({ argv: { output: process.env.HOME + "/Developer/cern-graph/public" }, cfg: { configuration: { locale: "en-US" } } })
' --input-type=module
```

## 2. The walk (1440×900, then 390×844)

| Step | Expect |
|---|---|
| Open the root explorer | Graph edge to edge; top bar reads `CERN graph` on the left, `⇥ this graph · Search notes…` and `← portal` on the right; bottom-left islands: views (`↘ CERN IT Governance & Identity` door chip, `Full view`, `Chain of authority`, `?`), filters (`Types 9 ›`, `Relations 13 ›`, `26 nodes · 72 links`, `Fit`, `Clear`). Wording in the site's language (`en-US` → English). |
| Open a mounted note (`/it-governance/compute/batch-service`) and press *Open the graph* | The modal's bar reads `Knowledge graph  CERN graph › CERN IT Governance & Identity`; inside, the explorer shows only the search bar, centred, with *The batch service* selected. Clicking `CERN graph` in the modal's bar returns the explorer to the root and the modal's bar keeps only the title. |
| Look at the portal node | An `Explore ↘` pill sits next to it on the canvas and follows it on pan/zoom. |
| Type `token` | Results say *No note matches* (the root has no such note). |
| Press `⇥` | Scope becomes `⇥ all graphs`; seven results appear, each with the `CERN IT Governance & Identity` badge, a colour dot and its kind. |
| Press `⏎` on the first | The explorer enters the child: trail `CERN graph › CERN IT Governance & Identity`, URL `?graph=it-governance`, the note selected and its capsule under the omnibar (`Part of … · About … · Cites … · ← Contains …`); views island shows `‹ CERN graph` + the child's twelve modes; filters `Types 19 ›`, `Relations 33 ›`, `274 nodes · 806 links`. |
| Click `Types ›` | Side menu beside the stack: 19 rows with dot, label, count and checkbox; `All` / `None`; closes on `Esc` or outside click. `None` → `Types 0/19` in warning colour and `0 nodes`; tick one → `1/19`; `All` → `19`. |
| Mode `Compliance declared`, then `Relations ›` | Two rows (`Governs`, `Complies with`) and, under them, the mode's legend (*Frameworks declared*: none / one / two or more). |
| Click a related note in the capsule | It becomes the selection and opens in the dock (temporary tab, italic); the omnibar re-centres over the free part of the canvas; `Open` and `✕` in the dock header. |
| Click `CERN graph` in the trail | Back at the root with the portal selected (`Explore subgraph ↘` in the capsule); the root's modes are back. |
| Open `/static/explorer?focus=it-governance/compute/batch-service` | The explorer enters the child by itself and selects *The batch service* (a note the root never previewed). |
| Force light scheme (`document.documentElement.style.colorScheme = "light"`) | Light tokens: white islands, dark text, same accent. |
| 390×844 (or a 390px iframe) | Stack spans the width; omnibar wraps (trail above, search below); side menus open under the omnibar; the dock, when open, takes the screen. Framed in an iframe, the brand island hides its back link. |

## 3. Keyboard

`/` focuses the search; any printable key does too; `⇥` cycles the scope; `↑`/`↓`
move the highlighted result; `⏎` activates it (or frames the matches when there is no
list); `Esc` clears the search and restores the camera saved when the search began,
then — outside the box — closes the menu, the results, the selection and the dock, in
that order.
