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
       graph: "https://cern.zetesis.xyz/static/okf-graph.json",
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

4. Build and read the log:

   ```bash
   ./okf/build-site.sh
   # expect:
   # [okf] federation: it-governance ← 10 notes, 3 previewed (9249934)
   # [okf] knowledge graph: N typed notes, M edges (0 unresolved)
   python3 serve.py   # or any static server on public/
   ```

5. Acceptance walk (US2), in the browser at `/static/explorer`:
   - the portal is drawn with a double ring and its label is always visible;
   - hovering it reads `10 notes · 3 previewed`;
   - clicking it opens its note; the panel header shows **Explore subgraph**;
   - the canvas swaps to the child graph, breadcrumb `<parent> › <child>`;
   - **Back** returns to the parent with the portal selected;
   - clicking a federated (dashed-ring) node opens the child's page in the panel;
     ⌘/Ctrl-click opens it in a new tab;
   - `/static/explorer?graph=it-governance` opens inside the child with a back action.

## 4. Making a corpus federable (child side)

The child only needs to publish its graph with a `baseUrl` (automatic once it builds
with this toolkit version and has `configuration.baseUrl`) and to project the property
the parent filters on:

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
