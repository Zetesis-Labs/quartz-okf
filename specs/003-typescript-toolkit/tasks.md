# Tasks: TypeScript across the toolkit, with composition in the model

**Input**: spec.md, plan.md, research.md, data-model.md  
**Rule**: every new behaviour starts as a failing test; the migration is characterised by
the existing suite, which stays green after every task.

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup — the gates

- [X] T001 `tsconfig.base.json` (strict, `erasableSyntaxOnly`, `verbatimModuleSyntax`,
      `target ES2022`) and root `tsconfig.json` (`module`/`moduleResolution: nodenext`,
      `allowImportingTsExtensions`, `noEmit`, `types: ["node"]`, include core/harness/
      plugins/quartz-okf); dev deps `typescript`, `@types/node` at the root.
- [X] T002 `package.json`: `engines.node >= 22.18`, `.nvmrc` = 22, scripts `typecheck`
      (root + each plugin) and `test` on `.ts` globs.
- [X] T003 `.github/workflows/test.yml`: matrix Node 22 / 24, `npm install` →
      `npm run typecheck` → `npm test`.
- [X] T004 Symlink `plugins/lib → ../core/lib`; check `npm install` skips it as a workspace.

## Phase 2: Foundational — types and the mechanical move

- [X] T005 `core/lib/types.ts`: bundle, display, profile, branding, explorer options,
      federation entry, `CorpusSource`, `OkfConfig`, `Problem` — derived from the code.
- [X] T006 `core/lib/reference-profile.ts` (was `core/profile.js`); `core/profile.js`
      becomes the shim; `core/lib/index.ts` re-exports from `./reference-profile.ts`.
- [X] T007 Rename `core/lib/*.js` → `.ts` with `.ts` import specifiers and types on every
      export (`graph`, `topology`, `frontmatter`, `resolver`, `rules`, `files`, `git`,
      `profile`, `consumer-config`, `exporter`, `diagram`, `federation`, `mount`, `index`).
- [X] T008 Rename `core/test/*.test.js` → `.test.ts` (assertions unchanged; fixtures typed
      only where `tsc` needs it). `npm test` green, `npm run typecheck` green.
- [X] T009 `harness/finalize-site.js` → `.ts` + its test. (`collect-content.sh` runs no
      node: no floor check there; the CLI shims carry it.)

## Phase 3: User Story 1 — one language, no build step, a named floor (P1)

- [X] T010 [US1] Test `core/test/floor.test.ts`: `checkFloor("20.18.3")` names the floor
      and the found version; `checkFloor("22.18.0")` and `("24.1.0")` are null;
      `("22.17.9")` is a problem.
- [X] T011 [US1] `core/bin/floor.js` (plain JS) with `checkFloor`; the five
      `core/bin/*.js` become shims (check → `import("../lib/cli/<name>.ts")`); CLI bodies
      move to `core/lib/cli/*.ts`.
- [X] T012 [US1] Integration test: a wrapper that redefines `process.versions.node`
      before importing `core/bin/okf-export.js` exits 1 with the message; on the real
      Node the shim reaches the CLI (usage, exit 2).

## Phase 4: User Story 2 — composition in the model (P1)

- [X] T013 [P] [US2] Tests `core/test/source.test.ts`: `sourceOf` for `path`, for git
      `repo`+`ref`, for a local path in `repo` (→ path), neither (`source-required`), both
      (`source-ambiguous`), git without `ref` (`ref-required`).
- [X] T014 [P] [US2] Tests in `federation.test.ts`: `validateFederationConfig` reports the
      three source problems and no longer `repo-required`; a `path` entry validates clean.
- [X] T015 [US2] `core/lib/source.ts` + validation wired into `federation.ts`.
- [X] T016 [US2] Tests in `mount.test.ts`: a child in a subdirectory of the parent's git
      repository mounts with manifest `source: { kind: "path", path: <abs> }` and
      `head` = parent head, no `remoteHead`; a child directory outside any repository
      mounts with no `head`; the git fixture keeps `source: { kind: "git", … }`,
      `ref-drift`/`ref-behind` untouched.
- [X] T017 [US2] `mount.ts`: `obtainChild` on `CorpusSource`; head rule; manifest `source`.
- [X] T018 [US2] Tests: `loadConsumerConfig` and the mount's config reader take
      `okf.config.ts` first (fixture written as `.ts` with a type annotation).
- [X] T019 [US2] `consumer-config.ts` / `mount.ts`: `okf.config.ts` in the lookup.

## Phase 5: User Story 3 — one packaging shape for the plugins (P2)

- [X] T020 [US3] `plugins/quartz-okf`: `src/index.ts` (typed, imports `../../lib/index.ts`),
      `tsup.config.ts` (esm, bundles the contract), `tsconfig.json` extends the base,
      `package.json` build/prepare; remove `dist/` from git (`.gitignore` covers it).
- [X] T021 [US3] `plugins/quartz-okf/test/emitter.test.ts` imports `../src/index.ts`;
      delete `assemble.js`.
- [X] T022 [US3] `quartz-okf-explorer`: tsconfig extends the base (no `rootDir`, so the
      contract resolves through `plugins/lib`). `panels` and `graph-okf` untouched: they
      need Quartz's type packages, present only in a consumer (plan § Decisions).

## Phase 6: User Story 4 — types as the contract (P2)

- [X] T023 [US4] `plugins/quartz-okf-explorer/src/index.ts` imports `ExplorerOptions`,
      `ExplorerMode` from `../../lib/types.ts` and re-exports them; its `config` object is
      typed by the contract.
- [X] T024 [US4] Test: a fixture `okf.config.ts` with a wrong key fails `tsc`
      (`core/test/config-types.test.ts` spawns `tsc --noEmit` on two fixtures: one clean,
      one with `profile.types: [1]`).

## Phase 6b: The explorer HUD (002) on the same footing

- [X] T028 [US1] Rebase 003 onto `002-explorer-hud`: the HUD is the base. Its pure
      modules (`plugins/quartz-okf-explorer/lib/*.js`, 13) and their 14 test files move to
      `.ts`, typed on the contract (`lib/types.ts` of the plugin declares the HUD model:
      `HudNode`, `HudModel`, `View`, `Registry`, `ExplorerEmitConfig`…); `lib/emit-config.d.ts`
      goes away; the plugin's `typecheck` covers `lib`. The browser shell
      (`src/hud/main.js`) keeps JavaScript: 004 replaces it with the Preact component.

## Phase 7: Docs and the consumer walk

- [X] T025 README.md, CLAUDE.md (floor, "TypeScript runs directly", the symlink, no
      committed dist, where the types live), `plugins/quartz-okf/README.md` (`path`
      source, `okf.config.ts`), docs/METHODOLOGY.md (typecheck gate).
- [X] T026 Consumer walk per quickstart.md: single-repository CERN layout (path source),
      `cern-it-governance-graph` unchanged (git source), diff of `okf-graph.json`.
- [X] T027 Commits per scope (`chore`, `feat(core)`, `refactor(core)`, `feat(quartz-okf)`,
      `docs(003)`), branch rebased on `main`.
