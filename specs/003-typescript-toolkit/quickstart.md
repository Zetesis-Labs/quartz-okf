# Quickstart: 003-typescript-toolkit

## Gates in the toolkit

```bash
nvm use            # .nvmrc → 22; Node 22.18+ is the floor
npm install        # workspaces: builds every plugin's dist through prepare
npm run typecheck  # tsc --noEmit: root project + each plugin
npm test           # node --test on .ts files — no build, no network
```

Expected: `typecheck` silent; `test` reports every 001 test plus the new ones (source
model, floor, okf.config.ts, mount by path) with `# fail 0`.

A CLI on an old Node:

```bash
~/.nvm/versions/node/v20.18.3/bin/node core/bin/okf-export.js . /tmp/out
# quartz-okf needs Node >= 22.18 (found 20.18.3): type stripping is not available
```

## Consumer builds (the real gate)

Pin the branch head in a consumer and build from the tarball, exactly as its CI does:

```bash
# single-repository CERN layout (umbrella at the root, subgraphs/it-governance by path)
cd <cern-one> && echo <sha> > okf/quartz-okf.ref && ./okf/build-site.sh
# expected
[okf] federation: mounted it-governance ← 274 notes at <head> under /it-governance/
[okf] knowledge graph: 26 typed notes, 72 edges (0 unresolved)
```

```bash
# a 001 consumer, unchanged scripts, git source
cd ~/Developer/cern-it-governance-graph && echo <sha> > okf/quartz-okf.ref && ./okf/build-site.sh
# expected: [okf] knowledge graph: 274 typed notes, 806 edges (0 unresolved)
```

```bash
# PAFE wiki — inside its devcontainer, never from the host
```

Compare `public/static/okf-graph.json` with the one built at the previous pin: same
nodes, same edges, same display; only `source_head` and `generated_at` may differ.

## `okf.config.ts`

```ts
import type { OkfConfig } from "./okf/toolkit/core/lib/types.ts"   // wherever the pinned toolkit sits
export const profile = { … }
export const federation = { subgraphs: [{ node: "topics/it", path: "subgraphs/it", preview: { property: "visibility", equals: "open" } }] }
export default { profile, federation } satisfies OkfConfig
```

`tsc --noEmit okf.config.ts` fails on a misspelt key; the build imports the file directly.
