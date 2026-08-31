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
- **Tests primero, verticales**: `npm test` (`node --test` sobre los `.ts`, sin red, sin
  build) y `npm run typecheck` (`tsc --noEmit`, estricto, sobre los módulos fuente).
  Cada comportamiento nuevo nace como test que falla; cada refactor empieza con un
  test de caracterización.
- **TypeScript sin build**: Node ≥ 22.18 quita los tipos de forma nativa (`.nvmrc`
  = 22; en local `nvm use`). Solo sintaxis borrable — nada de `enum`, `namespace` ni
  propiedades de parámetro — y los imports relativos llevan la extensión `.ts`.
- **Functional core / effectful shell**: decisiones puras en `core/lib/`; fs, git,
  red y contexto de Quartz en `core/lib/cli/`, `core/lib/exporter.ts`, `core/lib/mount.ts`
  y los emitters de los plugins, inyectados como funciones cuando el core los necesita.
- **Los tipos se declaran una vez**: `core/lib/types.ts` (bundle `okf-graph/v1`,
  documentos, perfil, opciones del explorer, federación, `OkfConfig`). Los plugins los
  importan de `../../lib/types.ts`; ningún plugin redeclara el contrato.
- **El motor no lleva vocabulario**: nada de nombres de consumidores, dominios, tipos o
  etiquetas en el código del motor. Se singulariza un nodo por una propiedad que
  declara el consumidor o por un marcador que deriva el motor.
- **Sin fallos silenciosos**: en modo estricto, error con fichero/regla/elemento; si se
  degrada, warning con nombre y salida que dice qué falta.
- **Comentarios**: solo un WHY no obvio de una o dos líneas, en el idioma del fichero.
  Si un bloque pide explicación, extrae una función con buen nombre.

## Trampas del repo

- Ningún `dist/` se commitea: los cuatro plugins se compilan con tsup en cada consumidor
  (`quartz plugin install` ejecuta `prepare`). `quartz-okf` empaqueta el contrato
  (`../../lib`) dentro de su `dist`, así que Quartz solo carga JavaScript.
- **El layout de los consumidores es un contrato**: cada `build-site.sh` copia
  `core/lib` → `$CACHE/lib`, `core/profile.js` → `$CACHE/profile.js` y cada plugin al
  lado. Por eso existen el symlink `plugins/lib -> ../core/lib` (el árbol resuelve
  `../../lib` igual que la caché), el shim `core/profile.js` y los shims
  `core/bin/*.js` (comprueban el suelo de Node y luego importan `core/lib/cli/*.ts`).
  No renombrar ni mover ninguno de esos tres.
- `quartz-okf-explorer` es un **componente** de Quartz (`quartz.category: [component,
  emitter]`): el widget se renderiza en SSR (`src/components/OkfExplorer.tsx`) y el HUD
  es una app Preact + signals montada en la página por `scripts/explorer.inline.ts`
  (`src/hud/**`). El lienzo (`src/hud/canvas/engine.ts`) no usa framework: posiciones,
  cámara, hover y drag son campos planos; un tick nunca renderiza un componente. Las
  decisiones viven en `lib/*.ts` con tests; los componentes y el motor entran en el
  `typecheck`. El emitter solo escribe `static/explorer.html` como redirect.
- La hoja de estilos del explorer es Tailwind v4 compilado en el loader de tsup
  (`tsup.config.ts`): import completo con `prefix(tw)`, y después se quita `@layer base`
  (preflight restilizaría toda la página de Quartz) y se desenvuelven las capas (las
  reglas de Quartz no van en capas y ganarían siempre). `dark:` sigue a `saved-theme`
  en `<html>`, no al sistema. Hay un puñado de clases `okf-*` para lo que las utilidades
  no expresan bien; ninguna capa con `pointer-events: auto` sobre el lienzo, o se traga
  los gestos.
- El preflight de Tailwind se quita a propósito, y con él el `box-sizing: border-box`:
  el CSS del explorador lo repone acotado a su capa. Sin eso, `w-full` más padding
  desborda (la barra medía 396px en una pantalla de 390).
- Una fila flex decide dónde parte con el tamaño **natural** del contenido, antes de
  encoger a nadie: por eso la miga larga lleva `flex-1` (base 0) en móvil, o tiraba la
  ✕ a una segunda fila. Los pins hacen lo contrario a propósito (`flex-[1_0_100%]`).
- El hover es del ratón: se escucha en `pointermove` y se descarta lo que no sea
  `pointerType === "mouse"`. Un toque emite un `mousemove` sintético y jamás un
  `mouseleave`, así que la tarjeta flotante se quedaba clavada en el móvil.
- El script inline intercepta `popstate` en fase de captura cuando solo cambia la query
  de la misma página: el router SPA de Quartz recarga la página en cualquier `popstate`
  y rompería la navegación por pasos del explorador.
- `quartz-okf-panels` y `quartz-graph-okf` dependen de los tipos de Quartz
  (`@quartz-community/*`) que solo existen en el consumidor: su `tsc` no forma parte del
  gate del repo; los verifica el build del consumidor.
- El campo `site` de `okf-graph.json` es un **título**, no una URL (el emitter usa
  `pageTitle`, el exporter `branding.site`).
- `package-lock.json` está ignorado: CI y local usan `npm install`, no `npm ci`.
- `note-properties` es quien lee el YAML de una nota a `file.data.frontmatter`. Sin ese
  plugin ninguna nota tiene tipo y el grafo cae en silencio a nodos genéricos: el Quartz
  más pequeño que aún construye un sitio OKF lo lleva (ver `harness/fixture`).
- El corpus de `harness/fixture` se construye entero en CI (job `smoke build`) y su grafo
  se compara con `expected-graph.json`: un cambio en la salida del motor se ve aquí, no en
  el deploy de un consumidor.
- `okf-graph/v1` solo crece de forma aditiva; documentar cada campo nuevo en
  `plugins/quartz-okf/README.md` § Graph shape.
- Un subgrafo declara su **fuente**: `path` (un corpus del mismo código) o `repo` +
  `ref` (git a un commit). Un path local en `repo` sigue valiendo. La deriva
  (`ref-drift`/`ref-behind`) solo existe para git. `okf.config.ts` se lee antes que
  `.mjs`.

## El build de los consumidores es del toolkit

Desde 005 la receta vive aquí: `okf build <repo>` ensambla el Quartz fijado, el toolkit y
el corpus, construye y publica; `okf verify <repo>` dice por qué un sitio construido no
debería publicarse. El `okf/build-site.sh` del consumidor son 25 líneas de arranque
(piso de Node, tarball del ref, `exec okf-build`) y su workflow ya no lleva comprobación.

- Las decisiones son puras: `core/lib/build-plan.ts` (`buildPlan(layout) → Step[]`) y
  `core/lib/verify.ts` (`verifySite(facts, floors) → Problem[]`). Los CLIs hacen la E/S.
- El consumidor declara lo suyo en `build` de `okf.config.*`: de dónde sale el corpus
  (`content.dir` o `content.collect`), sus comandos en cinco seams (`prepare`, `content`,
  `assemble`, `install`, `postBuild`) y sus suelos (`verify`). Cada comando recibe
  `OKF_ROOT`, `OKF_CACHE`, `OKF_CONTENT`, `OKF_PUBLIC`, `OKF_TOOLKIT` y `OKF_SOURCE_HEAD`.
- Añadir un plugin al toolkit, una purga o una variable de entorno **no** toca a los
  consumidores: entra en `build-plan.ts` y viaja con el SHA.

## Validar un cambio en un consumidor

```bash
# en el consumidor, con okf/quartz-okf.ref apuntando al SHA candidato
./okf/build-site.sh
# leer: [okf] knowledge graph: N typed notes, M edges (K unresolved)
#       [okf] verified <sitio>: N nodes, M edges
```

El HUD tiene además su propia auditoría, que no entra en `npm test` porque necesita un
sitio servido y Playwright:

```bash
cd <consumidor> && python3 serve.py 8815 &
NODE_PATH=~/.cache/singular-solving-okf/pw/node_modules \
  node harness/audit-site.cjs http://127.0.0.1:8815 /una/nota
```

Comprueba a 390×844 con dedo (desbordamientos, islas dentro de pantalla, objetivos
táctiles, que un toque abra la nota y que se pueda volver) y a 1440×900 con teclado
(el foco entra al abrir y vuelve al cerrar, `⇥` no se escapa detrás del explorador,
anillo de foco visible, `/`, flechas, `⏎`, `Esc`). Sale 1 con la lista de hallazgos.

La puerta de un cambio en la receta es comparar el árbol `public/` construido con el de
la receta anterior. **El build es reproducible**: dos seguidos solo difieren en `index.xml`
y `sitemap.xml`, que llevan la hora del build por definición. Cualquier otra diferencia es
real. (Lo era hasta 005: el corpus se ensambla fuera de su repositorio, el plugin de fechas
no encontraba git y caía a una mtime que la copia acababa de poner a ahora; el paso `dates`
sella cada nota con la fecha de su último commit, tratando un movimiento puro como lo que
es —no un cambio—, así que mover un corpus no re-fecha todas sus notas.)

`PAFE-Portal/wiki` se construye dentro de su devcontainer; nunca desde el host.

## Commits

Conventional Commits con el directorio del paquete como scope (`feat(core)`,
`fix(quartz-okf-explorer)`, `ci:`); un commit por scope; ramas `NNN-nombre` rebasadas
sobre `main`, nunca merge.
