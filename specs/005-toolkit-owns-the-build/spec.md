# 005 — The toolkit owns the consumer build

**Branch**: `005-toolkit-owns-the-build` · **Status**: draft

## Why

Five consumers pin this toolkit by SHA and each one carries its own copy of the build:
`okf/build-site.sh` is between 60 and 140 lines of bash per repository, and the workflow
that publishes the site carries a second copy of the post-build check. The copies have
drifted — only two of them exported `OKF_SOURCE_HEAD`, only one purged the transpilation
cache in the right place, and every one of them listed the toolkit's plugins by name.

The cost is paid on every change to the toolkit. Adopting 004 meant editing the same
eight files in four repositories by hand, and the check that four of them carried
(`test -s public/static/okf-explorer-access.js`) would have failed the deploy of a
correct site, because that asset no longer exists since 004. A consumer cannot be
expected to know that.

The toolkit already owns the contract (`core/lib`), the plugins and the pinned Quartz.
It should own the recipe that puts them together, and the check that says the result is
a site and not a husk.

## User stories

### US1 — Bump the toolkit without editing the recipe (P1)

A maintainer moves a consumer to a new toolkit SHA by editing `okf/quartz-okf.ref` and
nothing else. Steps that the new toolkit needs — a new plugin, a purge, an environment
variable — travel with the toolkit.

**Acceptance**: with only the ref changed, `./okf/build-site.sh` produces the same site
the previous recipe produced, plus whatever the new toolkit adds.

### US2 — One post-build check (P1)

The site is verified by the toolkit, from the same knowledge that built it: the graph
document exists and is not empty, the explorer's assets are all emitted, the pages carry
the component, and the corpus did not silently shrink.

**Acceptance**: `okf verify` fails a build whose graph has no edges, whose explorer
references an asset that was not emitted, or whose page count fell below the floor the
consumer declares; and it names what is missing.

### US3 — The toolkit's own CI builds a site (P1)

A change to the engine is exercised end to end before any consumer pins it: the
repository builds a fixture corpus and verifies the result on every pull request.

**Acceptance**: a regression that only shows up when a site is built — the 003 wikilink
mask is the precedent — fails the toolkit's CI, not a consumer's deploy.

### US4 — A consumer keeps its own steps (P2)

A consumer that generates indexes before the build, links a taxonomy into the assembled
corpus, or injects a badge into the built pages declares those commands in its
configuration and keeps them, without forking the recipe.

**Acceptance**: PAFE's index generators, the CERN's redirects and badge, and Singular
Solving's HERM linker, Typst demo and sidebar injection all run from configuration.

## Requirements

**The build**

- **FR-001** The toolkit provides `okf build <repo> [--cache <dir>] [--serve]`, which
  assembles the pinned Quartz, the toolkit and the consumer's corpus in a cache
  directory, builds the site and copies it to `<repo>/public`.
- **FR-002** The consumer's `build-site.sh` keeps only the bootstrap: the Node floor, the
  toolkit tarball for the pinned ref, and the call to `okf build`.
- **FR-003** `okf build` publishes the corpus commit as `OKF_SOURCE_HEAD` for every
  consumer, so every graph carries its `source_head`.
- **FR-004** Federation runs when the consumer declares `federation`, and is skipped
  without one. A toolkit that cannot federate fails the build naming the binary it
  lacks: publishing a site whose subgraphs silently vanished is the failure this
  replaces, not the one it should keep.
- **FR-005** The plugins the toolkit ships are known to the toolkit: assembling them,
  purging their stale copies from `.quartz/plugins` and purging `.quartz-cache` are the
  toolkit's steps, not a list the consumer maintains.
- **FR-006** A consumer declares its extra steps as commands under `build` in
  `okf.config.*`, at named seams of the pipeline: `prepare` (before the corpus is
  assembled), `content` (on the assembled corpus), `assemble` (on the assembled
  toolkit), `install` (after the community plugins are installed) and `postBuild` (on
  the built site). Each command receives `OKF_ROOT`, `OKF_CACHE`, `OKF_CONTENT`,
  `OKF_PUBLIC` and `OKF_TOOLKIT` in its environment.
- **FR-007** A consumer declares where its corpus comes from: a directory (the default,
  `content/`) or the repository sweep the harness already performs.
- **FR-008** A failing consumer command fails the build, naming the seam and the command.

**The check**

- **FR-009** The toolkit provides `okf verify <repo> [--site <dir>]`, which checks a
  built site (`<repo>/public` by default) against the consumer's own configuration: `index.html` exists; the graph document exists, parses and has nodes and
  edges; the explorer's page and its referenced assets are emitted; the component and
  its configuration are present in the pages.
- **FR-010** A consumer may declare floors (`minNotes`, `minNodes`, `minEdges`, and a
  glob with its own count) under `build.verify`; a build below a floor fails.
- **FR-011** `okf verify` reports every failure it finds, not only the first, and names
  the file or the number that is wrong.
- **FR-012** `okf build` runs the verification at the end unless `--no-verify` is given.

**The toolkit's CI**

- **FR-013** The repository carries a fixture corpus small enough to build in CI and
  wide enough to exercise the contract: several types, inverse edges, a wikilink inside
  a code span, an alias, and a note that a rule must reject.
- **FR-014** CI builds the fixture and verifies it on every push and pull request.
- **FR-015** The smoke build asserts the graph the fixture must produce, so a change in
  the engine's output is a failure and not a surprise in a consumer.

## Out of scope

- Translating the panels plugin (its chrome is still patched by two consumers at build
  time; the catalogue that would fix it is its own feature).
- Publishing the toolkit to npm, or any change to how consumers pin it.
- Federation itself, unchanged since 001.
- The `quartz-graph-okf` dependency workaround, which stays in the one consumer that
  enables that plugin.

## Success criteria

- **SC-001** Every consumer's `build-site.sh` is under 30 lines, and the five of them
  differ only in the cache name and the toolkit repository.
- **SC-002** For each consumer, the site built by `okf build` matches the site built by
  its previous recipe: same pages, same graph nodes and edges.
- **SC-003** No consumer workflow contains the post-build check inline.
- **SC-004** The toolkit's CI builds and verifies a site on every pull request.
