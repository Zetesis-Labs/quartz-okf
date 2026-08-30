# Quickstart: Subgraph portals and open-node federation

## 1. Unit level (no network, no Quartz)

```bash
npm test
```

`core/test/federation.test.js` builds a fixture parent graph and a fixture child graph
in memory and exercises every behavior of the spec (US1, US3). Read the test names as
the behavior list.

## 2. Emitter level (fake Quartz context)

`plugins/quartz-okf/test/emitter.test.js` runs `OkfEmitter` with a fake `context`
(`argv.output` pointing to a temp dir, `cfg.configuration.baseUrl`) and an injected
`fetchBundle` returning fixture graphs. It asserts the written files:
`static/okf-graph.json` (federated) and `static/okf-subgraphs/<id>.json`.

## 3. Site level (a real consumer build)

Pick a consumer, point its `okf/quartz-okf.ref` at the candidate SHA and add the
feature configuration:

1. `okf.config.mjs` — a portal type is optional but recommended:

   ```js
   profile.types.push("graph")
   explorer.typeColors.graph = "#111827"
   explorer.typeLabels.graph = "Linked graph"
   explorer.radius = { byType: { graph: 11 } }
   // The engine's default portal tooltip is in its own language ("N notas · M abiertas");
   // a consumer words it like the rest of its site:
   explorer.tooltip.graph = "{subgraph.notes|note|notes} · {subgraph.previewed} previewed"

   export const federation = {
     subgraphs: [{
       node: "topics/it-governance",
       repo: "https://github.com/Zetesis-Labs/cern-it-governance-graph",  // or "../cern-it-governance-graph"
       ref: "<commit of the child>",
       preview: { property: "visibility", equals: "open" },
     }],
   }
   ```

2. `okf/quartz.ts` — pass the block through:

   ```ts
   import { profile, explorer, federation } from "./okf.config.mjs"
   componentRegistry.setOptionOverrides("quartz-okf", { profile, federation })
   ```

3. A portal note `content/topics/it-governance.md` with `type: graph` and whatever
   `Topology` edges tie it to the parent corpus.

4. Make sure `okf/build-site.sh` runs the mount step between copying the content and
   building (the consumer template does):

   ```bash
   node "$TOOLKIT/core/bin/okf-federate.js" "$REPO_ROOT" "$CACHE/content" "$CACHE/okf-federation" --cache "$CACHE_ROOT/federation"
   ```

   Then build and read the log — no other site needs to be running:

   ```bash
   ./okf/build-site.sh
   # expect:
   # [okf] federation: mounted it-governance ← 274 notes at 011e3ea under /it-governance/
   # [okf] federation: it-governance ← 274 notes, 18 previewed (011e3ea) mounted at /it-governance/
   # [okf] knowledge graph: N typed notes, M edges (0 unresolved)
   python3 serve.py   # or any static server on public/
   ```

5. Acceptance walk (US2), in the browser at `/static/explorer`:
   - the portal is drawn with a double ring and its label is always visible;
   - hovering it reads `274 notes · 18 previewed` and how to enter;
   - **double-click** enters the child graph (so does **Explorar subgrafo** in the
     relation bar when the portal is selected, and in its reading panel);
   - the camera fits the child graph within a second; the panel shows the child's own
     modes and the path `CERN › CERN IT Governance`, with colours from the child;
   - **← Volver** — or the browser's back button — returns to the parent with the
     portal selected;
   - clicking a federated (dashed-ring) node opens its page *of this site*
     (`/it-governance/...`) in the panel; ⌘/Ctrl-click opens it in a new tab;
   - `/static/explorer?graph=it-governance` opens inside the child with a back action.

## 4. Making a corpus federable (child side)

The child only needs to project the property the parent filters on (it does not
need to be deployed; the parent mounts it from its repository):

```js
profile.propertyGroups.push({
  id: "visibility",
  label: "Visibility",
  rule: "visibility-valid",
  appliesTo: profile.types,
  fields: [{ source: "visibility", graphPath: ["visibility"], type: "string",
             enum: ["open", "internal"] }],
})
```

Then mark notes with `visibility: open` in their frontmatter.
