# Quickstart: Catalog rows as nodes

## Try it on the toolkit's own fixture

```bash
nvm use                       # Node 22
npm test                      # core + plugins, no network
node core/bin/okf-build.js harness/fixture --cache ~/.cache/okf-fixture
node harness/assert-fixture-graph.ts
```

The fixture's `standards/arm.md` holds two catalogs and `analysis/gap.md` annotates them.
What the build proves:

- `harness/fixture/public/static/okf-graph.json` has 10 nodes, 3 of them rows
  (`stats.rows`), with `slug` `standards/arm#ac001`, `url` `/standards/arm#ac001` and a
  `row` marker;
- `public/standards/arm.html` renders `<table data-okf-catalog>` with
  `<tr id="ac001" data-okf-node="standards/arm#ac001">`;
- `public/analysis/gap.html` turns `[[standards/arm#AC001]]` into
  `href="../standards/arm#ac001"` — the anchor Quartz derives and the one the toolkit
  writes are the same string, which is what the whole feature rests on.

Open the site (`--serve`) and check the reading dock: clicking a row node shows that row,
not the whole catalogue, and opening a second row of the same note performs no new fetch.

## Adopt it in a corpus

1. Bump `okf/quartz-okf.ref` to a SHA that carries this feature.
2. Declare the row types in `okf.config.mjs` (`profile.types`) and give them colours and
   labels under `explorer.typeColors` / `typeLabels` if the corpus draws them.
3. Mark a table. Note-wide defaults go in the frontmatter:

```markdown
---
type: source
title: The catalogue
okf_rows: { id: Código, label: Componente }
---

<!-- okf:rows type=component properties="Glosa=gloss" -->

| Código | Componente | Glosa | Uses |
|---|---|---|---|
| AC001 | Student Recruitment | … | [[tools/slate]] |
```

4. Rebuild. Every row is a node; the build names any table it could not read
   (`catalog/*`, with the file, the table's position and the row).

### The three shapes a catalogue tends to have

```markdown
<!-- a sub-table whose parent lives in another table of the same note -->
<!-- okf:rows type=component edge=none; Part of: [[AP001]] -->

<!-- an identifier cell that also holds the name -->
<!-- okf:rows type=capability id=L2 pattern="^(?<id>BC\d{3})\s+(?<label>.+)$" -->

<!-- a note that classifies entries declared elsewhere -->
<!-- okf:rows ref=Código edge=About properties="Clasif=state" -->
```

### What a consumer can delete

Anything it had that gave table rows an identity: anchor injectors, hand-written graph
translators, per-corpus JSON artifacts and the `postBuild` steps that copied them. The
graph the explorer reads becomes the site's own `static/okf-graph.json`, so
`explorer.graphInput` goes back to its default and modes filter with `edges`,
`sourceType` and `colorBy` as usual.
