# Validation — 2026-09-08

## Toolkit checks

The isolated `009-note-reader-redirects` worktree starts at `86f767b6c57fae987ff4eb57be4270fb213622a3`. The original toolkit checkout and its existing materialization changes were preserved.

- Before implementation, the ordinary-page characterization passed and all seven redirect regressions failed.
- After implementation, all eight focused regressions passed.
- `npm test`: 322/322 tests passed.
- `npm run typecheck`: all packages passed.

The full suite and type checks ran in the existing `zp-front-dev` devcontainer, using `/tmp/herm-ui-fix/toolkit`, before incorporating the separate materialization draft for consumer integration.

## Consumer integration

The real consumer was copied to `/tmp/herm-ui-fix/consumer` in the same devcontainer. Its existing AP012 materialized note requires the user's separate, uncommitted materialization draft. That draft was overlaid only into the container validation copy, alongside this reader fix; neither source worktree was changed by the overlay.

Commands run in the container:

```sh
node core/bin/okf-build.js /tmp/herm-ui-fix/consumer --cache /tmp/herm-ui-fix/cache
node okf/check-graph.mjs
```

The first command ran from the toolkit copy and the second from the consumer copy. The build completed successfully. The graph validator passed with 486 nodes, 420 catalog rows, 156 note-to-row relations and no unresolved references.

An independent static audit followed the generated HTML aliases and checked every graph-node destination: 67 unique content pages and 419 fragment destinations passed, with no errors. The remaining catalog entry resolves to its materialized page.

## Browser verification

The generated output is served locally from `/Users/ruben/Developer/.worktrees/herm-ui-preview` at `http://127.0.0.1:8937/`. The preview server deliberately prefers extensionless HTML alias files before directory indexes, reproducing the failing production route behavior.

Verified through the actual explorer UI:

- `/corpus`, `/oferta-fase1` and `/propuesta` resolve their HTML aliases and display their articles in the dock.
- `/analisis/herm/arm/digital-identity` displays the existing AP012 materialized note.
- `/analisis/herm/herm-bcm#bc003` displays the catalog and scrolls to the highlighted BC003 row.
- The taxonomy uses the restored force layout, with free clusters visible after fitting the graph.
- The sidebar retains the existing Zetesis mark at 64 px wide.

No production deployment, commits or dependency-pin updates were made. The consumer's existing toolkit pin does not yet include this isolated reader fix; publishing it requires integrating the toolkit fix and then updating the consumer pin. The local preview contains the combined, validated result.
