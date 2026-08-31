# Research: 003-typescript-toolkit

Decisions taken before planning, each with the alternative rejected and the evidence.

## D1 — TypeScript runs directly: Node's native type stripping, no build step

Node ≥ 22.18 strips types without flags (verified on 22.22.3: `node --test` on a `.mts`
importing a `.ts` passes; a `.js` specifier pointing at a `.ts` file is
`ERR_MODULE_NOT_FOUND`, so relative imports carry the `.ts` extension). Only *erasable*
syntax is stripped: no `enum`, `namespace`, parameter properties or `import x = …`;
`tsc` enforces it with `erasableSyntaxOnly` (TypeScript 5.9.3 is already installed).

*Rejected*: a build step (tsup/tsc) before tests or CLIs — it puts an artifact between
the source and what runs, and the toolkit's tests must stay `node --test` on the files in
git (Constitution I, III). *Rejected*: a loader (`tsx`) — a dependency to do what the
runtime does.

## D2 — The floor is a fact of every consumer, not a wish

Both CERN repositories' CI: `node-version: 22` (floats to the latest 22.x ≥ 22.18). PAFE
wiki image: `node:22-slim`; PAFE devcontainer: Node 24. Maintainer's machine: Node 20.18
by default, 22.22.3 available in nvm. `engines.node >= 22.18` + `.nvmrc` say it; the CLI
shims (D5) enforce it with a message.

## D3 — The consumers' layout is a contract: `lib/` and the plugins side by side

Every consumer's `build-site.sh` copies `core/lib` → `$CACHE/lib`, `core/profile.js` →
`$CACHE/profile.js` and each plugin directory next to them, then `quartz plugin install`
links the plugins and runs their `prepare`. `plugins/quartz-okf` reaches the contract as
`../../lib/index.js` — a path that only resolves in that layout, which is why its tests
assemble a copy of it (`test/assemble.js`).

Decision: **mirror the layout in the tree** with a committed symlink `plugins/lib →
../core/lib`. In the tree and in every consumer cache, `plugins/<p>/src/../../lib` is the
contract. Consequences: `tsc`, tsup and `node --test` resolve the same path everywhere;
the assembled copy in tests goes away (tests import `../src/index.ts`); the
`quartz-okf` plugin bundles the contract into its `dist` at `prepare` time (tsup bundles
relative imports by default), so Quartz loads plain JavaScript and never sees a `.ts`.

*Rejected*: making `core` an npm package the plugins depend on — there is no registry in
the consumers' flow (they copy directories from a tarball). *Rejected*: changing the
consumers' scripts — 001's SC-004 (adoption = ref bump) holds for 003 too.

## D4 — `core/profile.js` stays as a one-line shim; the reference profile moves into `lib/`

Consumers `cp "$TOOLKIT/core/profile.js"` under `set -e`: the file must exist. Nothing
imports it in the cache layout once `core/lib/index.ts` takes the reference profile from
`./reference-profile.ts`. The shim (`export * from "./lib/reference-profile.ts"`) is the
only reason a `.js` remains under `core/` besides the CLI shims.

## D5 — CLI entry points are JavaScript shims that check the floor, then import TypeScript

A `.ts` file on Node 20 fails to *parse*, before any code runs; the message would be a
syntax error at an unrelated line. `core/bin/<name>.js` (the paths consumers call) do
one thing: `checkFloor(process.versions.node)` from `core/bin/floor.js`, then
`await import("../lib/cli/<name>.ts")`. The CLI bodies move to `core/lib/cli/*.ts`.
`floor.js` exports the check so a test can call it with a fake version (SC-006).

## D6 — Test runner globs

`node --test "core/test/*.test.ts" …` — Node 22 expands the quoted globs itself
(verified: 57 core tests through a quoted glob). Unquoted globs would make the shell
expand them, which also works; quoting keeps the script portable.

## D7 — The composition model names the source of a corpus

001's `repo` accepts a local path, so a corpus in the same repository already mounts
(verified: the single-repository CERN layout built 274 mounted notes with 001). What is
missing is the *name*: `repo` says "another repository". 003 adds `path` and normalises
both into a `CorpusSource`: `{ kind: "path", path }` or `{ kind: "git", repo, ref }`.
Validation: exactly one of `path` / `repo`; `ref` only with `repo`; a local path in
`repo` normalises to `path` without a warning (additive, Constitution VII). Drift
(`ref-drift`, `ref-behind`) exists only for `git`. For a `path` inside the parent
repository (`git rev-parse --show-toplevel` equal), the child's `head` is the parent's
head; outside it, no `head` is claimed and the manifest records the resolved path.

## D8 — `okf.config.ts`

With D1, `import(pathToFileURL("okf.config.ts"))` just works. Both loaders
(`consumer-config`, `mount`) try `okf.config.ts` first, then `.mjs`, then `.js`. A
consumer that wants type checking annotates `satisfies OkfConfig` and runs `tsc` itself.

## D9 — One declaration of the types, under `core/lib/types.ts`

The bundle (`OkfGraph`, `OkfNode`, `OkfEdge`, `OkfStats`, `SubgraphMarker`, `Display`) and
the consumer configuration (`Profile`, `PropertyGroup`, `Branding`, `Federation`,
`SubgraphEntry`, `ExplorerOptions`, `ExplorerMode`, `OkfConfig`). The explorer plugin
re-exports the two it published (`ExplorerOptions`, `ExplorerMode`) from the contract so
its public surface does not change. Vocabulary stays `string` (Constitution IV).

## D10 — Quality gates

`npm run typecheck` = `tsc -p tsconfig.json` (core, harness, quartz-okf plugin) + each
plugin's own `tsc -p` (bundler resolution, DOM lib, Preact JSX where it applies). CI runs
`typecheck` and `test` on Node 22 and 24; `npm install` at the root already runs every
plugin's `prepare`, so a tsup failure fails CI there and not in a consumer.

## D11 — What 003 does not touch

The explorer's browser assets (`src/assets/*`) — 004 replaces them; `quartz-okf-panels`
and `quartz-graph-okf` — already TypeScript + Preact (only the shared base tsconfig and
the type import change); the consumers' scripts.
