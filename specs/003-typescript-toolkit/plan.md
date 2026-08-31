# Implementation Plan: TypeScript across the toolkit, with composition in the model

**Branch**: `003-typescript-toolkit` | **Date**: 2026-08-31 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/003-typescript-toolkit/spec.md`

## Summary

Move every module of the toolkit to TypeScript executed directly by Node (native type
stripping, floor 22.18), declare the bundle and configuration types once under `core/`,
name the source of a mounted corpus (`path` in the same code, or `repo` + `ref`) and
give the four Quartz plugins one packaging shape. Behaviour-preserving: the existing 68
tests keep their assertions; consumers rebuild unchanged. Research decisions in
[research.md](research.md), shapes in [data-model.md](data-model.md).

## Technical Context

**Language/Version**: TypeScript 5.9 (erasable syntax only), Node ≥ 22.18 (native type stripping)  
**Primary Dependencies**: none new at runtime; dev: `typescript`, `@types/node`, `tsup` (already in the plugins)  
**Storage**: files (corpus directories, mount cache, emitted site)  
**Testing**: `node --test` on `.ts` files, no build, no network; `tsc --noEmit` as the second gate  
**Target Platform**: the consumers' build hosts (GitHub Actions Node 22, `node:22-slim`, devcontainer Node 24, macOS)  
**Project Type**: library + CLIs + Quartz plugins  
**Constraints**: consumers' `build-site.sh` unchanged (paths `core/lib`, `core/profile.js`, `core/bin/*.js`, `plugins/*`); consumers pin by SHA  
**Scale/Scope**: ~2.7k lines of JS to migrate (core 2.3k, harness 45, quartz-okf plugin 311), 68 tests to carry, ~15 new tests

## Constitution Check

| Principle | How this plan honours it |
|---|---|
| I. Git is the source; bundles are the contract | No generated file committed: `plugins/quartz-okf/dist` leaves git; `.ts` in git is what runs. `okf-graph/v1` unchanged; manifest additive. |
| II. Functional core, effectful shell | `sourceOf`, `checkFloor`, the type declarations are pure; `mount.ts` and the CLI bodies (`core/lib/cli/*.ts`) are the shell; the `bin/*.js` shims are three lines of shell. |
| III. Tests first, vertical | New behaviour (source model, `okf.config.ts`, floor, manifest `source`) is written as failing tests before code; the migration itself is characterised by the existing suite, renamed and re-run at every step. |
| IV. The engine ships no vocabulary | Types keep node types, edge labels, properties and mode ids as `string`; the reference profile stays data. |
| V. No silent failures | New problems are named (`source-required`, `source-ambiguous`); the floor is a message, not a syntax error; a `path` with no `okf.config.*` fails naming the directory. |
| VI. Comments only for a non-obvious why | Migration adds no comments; the few that exist move with the code. |
| VII. Compatibility by pinning; additive schemas | `repo` as a local path keeps working; `ref` ignored with `path`; manifest gains `source`; consumers adopt by ref bump. |

No violation to justify in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/003-typescript-toolkit/
├── spec.md
├── plan.md          # this file
├── research.md      # D1–D11
├── data-model.md    # config, CorpusSource, manifest, types
├── quickstart.md    # gates: typecheck, tests, consumer builds
└── tasks.md
```

### Source Code (repository root)

```text
tsconfig.base.json            # shared compiler options (strict, erasableSyntaxOnly, verbatimModuleSyntax)
tsconfig.json                 # core + harness + plugins/quartz-okf (nodenext, allowImportingTsExtensions)
.nvmrc                        # 22
core/
├── profile.js                # shim: export * from "./lib/reference-profile.ts"  (consumers cp it)
├── bin/
│   ├── floor.js              # checkFloor(version) — plain JS, importable by any Node
│   ├── okf-export.js         # shim: floor → import("../lib/cli/okf-export.ts")
│   ├── okf-check.js  okf-diagram.js  okf-federate.js  okf-impact.js   # same shape
├── lib/
│   ├── types.ts              # the contract, declared once
│   ├── reference-profile.ts  # was core/profile.js
│   ├── source.ts             # sourceOf(entry) → CorpusSource | problems   (pure)
│   ├── cli/                  # bodies of the CLIs (shell)
│   └── *.ts                  # every 001 module, renamed, typed
└── test/*.test.ts            # every 001 test, renamed; new: source, floor, config-ts, mount-path
harness/
├── finalize-site.ts  test/finalize-site.test.ts
└── collect-content.sh        # + floor check
plugins/
├── lib -> ../core/lib        # committed symlink: the consumers' layout, in the tree
├── tsconfig.base.json        # (or root) shared by the four plugins
├── quartz-okf/
│   ├── src/index.ts          # was dist/index.js; imports ../../lib/index.ts
│   ├── tsup.config.ts  tsconfig.json  package.json (build/prepare: tsup)
│   └── test/emitter.test.ts  # imports ../src/index.ts (no assembled copy)
├── quartz-okf-explorer/src/index.ts   # types from ../../lib/types.ts, re-exported
├── quartz-okf-panels/                 # base tsconfig only
└── quartz-graph-okf/                  # base tsconfig only
.github/workflows/test.yml    # matrix 22/24: install → typecheck → test
```

**Structure Decision**: single repository, same directories as today; the only new
directory is `core/lib/cli/`; the only structural novelty is the `plugins/lib` symlink
(research D3), which makes the tree resolve exactly like every consumer's cache.

## Order of work (why this order)

1. **Gates first** (tsconfig, engines, CI matrix, `typecheck` script): every later step
   is checked by them.
2. **Types** (`types.ts`) derived from the code as it is, pinned by the existing tests.
3. **Mechanical rename** of `core/lib`, `core/test`, harness — `.ts` extensions in
   imports, `@ts-expect-error`-free typing of each module; the suite stays green after
   each file.
4. **Shims** (`profile.js`, `bin/*.js` + `floor.js`), CLI bodies to `lib/cli`.
5. **Composition model** — tests first: `sourceOf`, validation problems, mount by `path`
   with manifest `source`, head rule, `okf.config.ts`.
6. **Plugin `quartz-okf`** to `src/` + tsup; symlink; tests import `src`.
7. **Explorer plugin** takes its types from the contract.
8. **Docs**, then the **consumer walk** (quickstart) on the single-repository CERN layout
   and PAFE wiki.

## Decisions taken while implementing

- **Tests are not type-checked by `tsc`.** Their fixtures are deliberately partial
  (a graph with only `nodes` and `edges`, a document without `parseError`) and typing
  them would change ~100 lines of characterization tests for no behaviour. The runtime
  that runs them rejects non-erasable syntax and resolves every import, which is the
  check that matters; `tsc` covers the source modules.
- **`quartz-okf-panels` and `quartz-graph-okf` are outside the `typecheck` gate**: both
  import `@quartz-community/*` types that only exist inside a consumer's Quartz install.
  Their `tsc` runs there; here only their `prepare` (tsup) runs at `npm install`.
- **`quartz-okf` bundles the contract into its `dist`** instead of leaving `../../lib`
  external: Quartz's loader imports the plugin's entry with a plain `import()`, and a
  bundled `dist` never depends on how that loader treats `.ts` specifiers.
- **003 stacks on 002 (the HUD), not on `main`.** The HUD is the approved base; the
  refactor sits on it and 004 turns its shell into the Preact component. The HUD's pure
  modules and tests are TypeScript here; its browser shell (`src/hud/main.js`, ~1100
  lines of DOM + d3) stays JavaScript until 004 rewrites it — typing a shell about to be
  replaced would be work thrown away.
- **The head of a path source** is the head of whatever repository the directory sits
  in (the parent's, or its own when the path is a checkout — 001's local-repository
  case keeps its behaviour); outside any repository there is no head.

## Risks

- *Quartz's plugin loader and `.ts`*: avoided by bundling the contract into
  `quartz-okf`'s `dist` at `prepare` (D3); the loader only ever imports JavaScript.
- *`npm workspaces` and the symlink*: `plugins/*` matches `plugins/lib`, which has no
  `package.json`; npm skips it. Verified during setup, task T004.
- *Type stripping and `import x = require()` or `enum` slipping in*: `erasableSyntaxOnly`
  in the gate; CI runs the tests on the real runtime, so a slip fails twice.
- *Consumer scripts on Node < 22.18*: the shim's message names the floor; both CERN
  scripts already switch to an nvm 22 when present.

## Complexity Tracking

None.
