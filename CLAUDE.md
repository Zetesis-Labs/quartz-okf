# quartz-okf — instrucciones para agentes

Toolkit Quartz ↔ Open Knowledge Format: contrato independiente del renderizador
(`core/`), plugins de Quartz v5 (`plugins/`) y arnés de build (`harness/`). Los
consumidores (`cern-it-governance-graph`, `PAFE-Portal/wiki`, …) fijan este repo por
SHA en su `okf/quartz-okf.ref` y aportan su vocabulario en `okf.config.mjs`.

## Cómo se trabaja aquí

- **Metodología**: Spec Kit. Constitución vinculante en
  `.specify/memory/constitution.md`; versión legible en `docs/METHODOLOGY.md`. Toda
  feature vive en `specs/NNN-nombre/` y sigue `/speckit-specify` → `/speckit-plan` →
  `/speckit-tasks` → `/speckit-implement`. Referencia de profundidad:
  `specs/001-subgraph-federation/`.
- **Tests primero, verticales**: `npm test` (`node --test`, sin red, sin build). Cada
  comportamiento nuevo nace como test que falla; cada refactor empieza con un test de
  caracterización.
- **Functional core / effectful shell**: decisiones puras en `core/lib/`; fs, git,
  red y contexto de Quartz en `core/bin/`, `core/lib/exporter.js` y los emitters de los
  plugins, inyectados como funciones cuando el core los necesita.
- **El motor no lleva vocabulario**: nada de nombres de consumidores, dominios, tipos o
  etiquetas en el código del motor. Se singulariza un nodo por una propiedad que
  declara el consumidor o por un marcador que deriva el motor.
- **Sin fallos silenciosos**: en modo estricto, error con fichero/regla/elemento; si se
  degrada, warning con nombre y salida que dice qué falta.
- **Comentarios**: solo un WHY no obvio de una o dos líneas, en el idioma del fichero.
  Si un bloque pide explicación, extrae una función con buen nombre.

## Trampas del repo

- `plugins/quartz-okf/dist/index.js` **es la fuente** (JS plano, commiteado). Los
  `dist/` de los plugins con tsup (`quartz-okf-explorer`, `quartz-okf-panels`,
  `quartz-graph-okf`) están en `.gitignore`: los compila cada consumidor en su build
  (`quartz plugin install` ejecuta `prepare`). Un error de TypeScript en
  `plugins/quartz-okf-explorer/src/index.ts` rompe el build de todos los consumidores.
- El campo `site` de `okf-graph.json` es un **título**, no una URL (el emitter usa
  `pageTitle`, el exporter `branding.site`).
- `package-lock.json` está ignorado: CI y local usan `npm install`, no `npm ci`.
- `okf-graph/v1` solo crece de forma aditiva; documentar cada campo nuevo en
  `plugins/quartz-okf/README.md` § Graph shape.

## Validar un cambio en un consumidor

```bash
# en el consumidor, con okf/quartz-okf.ref apuntando al SHA candidato
./okf/build-site.sh
# leer: [okf] knowledge graph: N typed notes, M edges (K unresolved)
```

`PAFE-Portal/wiki` se construye dentro de su devcontainer; nunca desde el host.

## Commits

Conventional Commits con el directorio del paquete como scope (`feat(core)`,
`fix(quartz-okf-explorer)`, `ci:`); un commit por scope; ramas `NNN-nombre` rebasadas
sobre `main`, nunca merge.
