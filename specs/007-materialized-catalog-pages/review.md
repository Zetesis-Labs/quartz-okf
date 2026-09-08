# Revisión: 006 mergeado, 007 sin commitear, y Singular como consumidor

**Autor**: Claude (Fable 5.1), sesión del 2026-09-05. **Para**: quien siga el trabajo
(Codex u otro agente). Es un punto de vista, no una lista de tareas: cada punto lleva la
afirmación, cómo se verificó, la gravedad que le doy, lo que propongo y qué evidencia me
haría cambiar de opinión. Rebatir debajo de cada punto, en la sección final, con la misma
disciplina: fichero y línea, o una ejecución.

## Estado sobre el que se opina

| Qué | Valor |
|---|---|
| `quartz-okf` `main` | `50d2fc9` = PR #8 (006, 13 commits) + PR #9 (endurecimiento, 5 commits), ambos mergeados el 2026-09-04 |
| `quartz-okf` árbol de trabajo | rama `007-materialized-catalog-pages`, cero commits sobre `main`; 24 ficheros modificados y 5 sin trackear: `core/lib/materialization.ts`, `core/test/materialization.test.ts`, `harness/fixture/content/standards/reader-attraction.md`, `specs/007-materialized-catalog-pages/`, `SESSION.md` |
| Suite | `npm test`: 311 tests, 0 fallos. `npm run typecheck`: limpio. Node 22.22.3 |
| Fixture construido en local | `harness/fixture/public/static/okf-graph.json` del 2026-09-05 00:13: AP001 con `url: /standards/reader-attraction`, `row.page` puesto, sin nodo para la ficha |
| `singular-solving-propuesta` | PR #1 mergeado (`feat/herm-desde-el-motor`). Rama `feat/materialized-catalog-pages` = `origin/main` (`f100cf5`), ref del toolkit en `50d2fc9`. Sin commitear: `analisis/herm/herm-arm.md`, `okf/check-graph.mjs`, `okf/okf-convention.md`; nuevo `analisis/herm/arm/digital-identity.md` |
| Grafo de Singular construido en local | `public/static/okf-graph.json` del 2026-09-05 00:10: 485 nodos, 1225 aristas, 0 sin resolver. `node okf/check-graph.mjs` pasa. Construido con el árbol de trabajo de `quartz-okf`, no con el ref fijado (ver punto 7.2) |

**Lo que no se verificó**, y por tanto se afirma solo por lectura del código:

- El dock del explorador y el panel de vecindad sobre la ficha materializada, en navegador.
- El CI de Singular con el ref fijado.
- El efecto del cambio del resolver del PR #9 sobre CERN y PAFE.
- El desajuste bundle/grafo del punto 7.5 (leído en `core/lib/exporter.ts`, no ejecutado).

---

## 006. Catálogos como nodos (PR #8 + PR #9)

### Veredicto

Bien resuelto y bien acotado. Las decisiones grandes son correctas y están defendidas por
tests y por el smoke build, no por prosa. Lo que más valoro:

- **Slug `<nota>#<ancla>` como identidad canónica** (`core/lib/catalog.ts:407`), con el
  id crudo como alias. Único por construcción, sin registro global, y `?focus=AP012`
  sigue funcionando.
- **El marcador es un comentario HTML** (`core/lib/catalog.ts:10`): invisible en Obsidian
  y en Quartz, local a la tabla que gobierna, y nada se vuelve nodo por accidente.
- **`set=` para lo que afirma la tabla** en vez de una columna repetida 116 veces.
- **Tablas `ref` como anotación** con `catalog/property-conflict` cuando dos notas
  escriben valores distintos (`core/lib/rules.ts:257` en adelante).
- **`bodyLinks` solo cuando el enlace nombra una fila** (`core/lib/graph.ts:171-173`): un
  enlace a una nota es prosa; uno a una entrada de catálogo es una cita inequívoca.
- **La igualdad de la que depende todo está fijada por un build**: el ancla que escribe
  el toolkit (`core/lib/anchor.ts`) es la que Quartz deriva para `[[nota#ID]]`, y
  `harness/assert-fixture-graph.ts:90-94` lo comprueba sobre HTML renderizado.
- **El PR #9** es el endurecimiento que se espera tras una feature así: claves
  desconocidas del marcador son error (`catalog.ts:433-443`), las filas se anclan por su
  celda identificadora y no por `includes` (`plugins/quartz-okf/src/anchors.ts:55-61`),
  las anclas de encabezados se desduplican como hace `rehype-slug` (`rules.ts:57-78`), y
  un `plugin install` de Quartz que sale con cero pero declara fallos es fatal
  (`core/lib/build-plan.ts:146`, `core/lib/cli/okf-build.ts:86-96`).

Resultado en el consumidor: unas 3.900 líneas de Python fuera del toolkit sustituidas por
marcadores en Markdown, y el grafo del sitio pasa de dos documentos a uno.

### 6.1. Las filas heredan la etiqueta sintética `type/<tipo de la nota>`

- **Afirmación**: una fila lleva la etiqueta de tipo de la nota que la contiene, no la
  suya. AP012 (tipo `arm`) lleva `type/herm` y `type/arm`; las filas del fixture llevan
  `type/source`.
- **Evidencia**: grafo construido de Singular, nodo `analisis/herm/herm-arm#ap012`,
  `tags: [herm, infraestructura, type/herm, identidad, arquitectura-aplicaciones,
  type/arm]`. La etiqueta la inyecta el plugin (`plugins/quartz-okf/src/index.ts:33`) y
  la fila hereda las etiquetas de la nota en `core/lib/graph.ts:113-118`.
- **Gravedad**: baja hoy, media en cuanto algo filtre por `type/*`.
- **Propuesta**: que `rowNode` filtre `type/*` de lo heredado y añada `type/<row.type>`,
  o que la inyección ocurra después de extraer las filas.
- **Me haría cambiar de opinión**: que `type/*` no sea contrato para nadie (ni páginas de
  etiquetas ni modos del explorador) y se decida documentarlo como ruido conocido.

### 6.2. El resolver del PR #9 puede aflorar aristas sin resolver en otros consumidores

- **Afirmación**: antes, un alias ganaba al nombre corto; ahora una colisión alias/nombre
  corto devuelve `null`. Es correcto, pero es un cambio de comportamiento que ningún
  consumidor distinto de Singular ha ejercitado.
- **Evidencia**: `core/lib/resolver.ts:75-79`; diff `1320dd8..50d2fc9`.
- **Gravedad**: baja. `okf verify` y los suelos lo harían visible al subir el ref.
- **Propuesta**: nada en el motor. Cuando CERN o PAFE suban el ref, esperar ese síntoma y
  no tratarlo como regresión del toolkit.
- **Me haría cambiar de opinión**: un build de CERN y de PAFE con `50d2fc9` sin
  aristas nuevas sin resolver.

### 6.3. Verbosidad de los marcadores en Singular

- **Afirmación**: `analisis/herm/herm-arm.md` repite `type=arm id=Código` en más de
  veinte marcadores mientras `okf_rows` de nota, que existe para eso, no se usa.
- **Evidencia**: `grep -n 'okf:rows' analisis/herm/herm-arm.md`; el frontmatter no tiene
  `okf_rows`.
- **Gravedad**: cosmética. Higiene del consumidor, no del motor.
- **Propuesta**: `okf_rows: { type: arm, id: Código }` en el frontmatter y marcadores solo
  con lo que varía por tabla.

---

## 007. Fichas materializadas (sin commitear)

### Veredicto

El núcleo es correcto y la prueba es sólida. La forma de declararlo y el orden de entrega,
no. Lo que está bien:

- **La fila sigue siendo canónica** y la nota física desaparece como segundo nodo
  (`core/lib/graph.ts:148-163`). Las anotaciones, los enlaces cualificados y la
  federación no se enteran del cambio.
- **El resolver colapsa todas las formas de nombrar la ficha en la fila**
  (`core/lib/resolver.ts:98-109`): ruta, nombre corto, alias y ruta con fragmento.
- **Las relaciones y anotaciones redactadas en la ficha salen de la fila**
  (`graph.ts:149,174,207-212`), y las que apuntan a la ficha aterrizan en la fila.
- **Cada asociación inválida tiene regla propia en error por defecto**
  (`core/lib/materialization.ts`, `core/lib/reference-profile.ts:109-113`), y en modo no
  estricto la asociación inválida no entra en el índice, así que fila y ficha quedan
  como dos entidades con aviso. Sin fallos silenciosos.
- **Es un módulo puro nuevo** (`materialization.ts`, 108 líneas) con tests que cubren
  los cinco fallos y el caso válido.
- **Federación**: preservar la `url` publicada en vez de reconstruirla desde el slug
  (`core/lib/federation.ts:97,198`) arregla una coincidencia que solo funcionaba porque
  slug y url coincidían. Cambio correcto y con test.
- **Panel**: buscar el nodo actual también por la ruta de su `url`
  (`plugins/quartz-okf-panels/src/components/scripts/blast-radius.inline.ts`, funciones
  `pageSlug` y el bucle que fija `current`) es lo mínimo para que la ficha muestre la
  vecindad de la fila. La coincidencia exacta por slug sigue ganando, así que la página
  del catálogo no se confunde con una de sus filas.
- **Dock**: no necesitó cambios. `fetchNote` (`controller.ts:496-514`) parte la url por
  `#`, y la url de una fila materializada no lleva fragmento, así que abre la ficha
  entera. Correcto por construcción, no verificado en navegador.

### 7.0. Antes que la columna: puede que el modelo no necesitara la feature

- **Afirmación**: la ficha de AP012 es la lectura del proyecto sobre una entrada del
  estándar, y OKF ya expresa eso como una nota `About` la fila. El 007 introduce un
  concepto nuevo (materialización, cinco reglas, una indirección en el resolver) para
  fundir dos cosas que el modelo separa a propósito: la entidad del estándar y lo que
  este corpus dice de ella.
- **Evidencia**: el contenido de `analisis/herm/arm/digital-identity.md` son las
  secciones "Lectura para la propuesta" y "Criterio de diseño", es decir, análisis.
  Es el mismo patrón con el que `gap-analysis-arm`, las decisiones y la factibilidad
  se cuelgan de los códigos (modo "Uso en esta propuesta", 156 relaciones nota → fila).
  El propio 006 dejó escrito que la descripción útil de un elemento es la lectura del
  proyecto, no la glosa del estándar (`SESSION.md`, decisiones). `quickstart.md` de esta
  spec distingue "otra representación de la misma entidad" de "una nota sobre ella";
  en este corpus esa distinción no aparece. La feature se ha construido sobre un solo
  caso.
- **Gravedad**: de diseño. No es un bug; es coste de modelo sin necesidad demostrada.
- **Propuesta**: para Singular, la ficha no como nota `arm`, sino como nota de conocimiento
  (`concept` o `report`) con `About: [[herm-arm#AP012]]`, sin cambio de toolkit. Guardar
  el 007 hasta que aparezca el caso en que una fila ES una página. Y en ese caso,
  sospecho que la dirección correcta es la inversa: las páginas son las entidades y la
  tabla se genera como índice desde ellas, no las páginas desde las filas.
- **Me haría cambiar de opinión**: un consumidor real donde la fila y la página son la
  misma entidad y verlas como dos nodos rompe algo concreto (una métrica, un modo, una
  federación), y no solo la estética de "sale dos veces".

### 7.1. La columna `page=` es el lado equivocado para declarar la asociación

- **Afirmación**: declarar la ficha en una columna de la tabla obliga a tocar el catálogo
  y publica una columna casi vacía. En Singular, la tabla de AD003 tiene 11 filas, 1 con
  enlace y 10 celdas vacías bajo un encabezado "Ficha", y ese sitio lo ve el cliente. Con
  las 116 filas de componentes el coste es proporcional.
- **Evidencia**: diff de `analisis/herm/herm-arm.md`, marcador de la línea 75 y tabla
  siguiente. `research.md` de esta spec justifica la columna por "hacer visible la
  opcionalidad por fila" y rechaza inferir por nombre de fichero o título; no considera
  la declaración explícita desde la ficha.
- **Gravedad**: media. No es un bug; es ergonomía y coste de adopción, y es visible
  para el cliente.
- **Propuesta**: que la ficha reclame la fila desde su frontmatter, por ejemplo
  `okf_row: herm-arm#AP012`. Es explícito, no inferido, así que no cae en lo que
  `research.md` rechaza. La validación uno a uno es idéntica y el índice de
  materialización (`materializationsOf`) se reutiliza entero: solo cambia de dónde salen
  los candidatos. Es más fiel al principio del 006 de declarar cada cosa donde gobierna:
  la ficha es lo nuevo, y la tabla no cambia. Mantendría `page=` como forma alternativa,
  no como la primaria.
- **Si lo que se quiere es que el lector vea el enlace en la tabla**, eso es
  presentación, no declaración: el pase HTML que ya marca cada `<tr>`
  (`plugins/quartz-okf/src/anchors.ts`) puede escribir el enlace a la ficha en la celda
  del id a partir del índice, sin columna en el Markdown.
- **Me haría cambiar de opinión**: que Rubén quiera que el autor del catálogo vea desde
  la tabla, en Obsidian, qué filas tienen ficha; o que el frontmatter de la ficha no pueda
  leerse en el momento en que se construye el índice (hoy sí: `materializationsOf` recibe
  documentos validados con frontmatter).

### 7.2. Singular depende de un toolkit que no existe en `main`

- **Afirmación**: el build local de Singular se hizo con el árbol de trabajo de
  `quartz-okf`, pero el ref fijado sigue en `50d2fc9`, donde `page` es una clave
  desconocida. Con ese ref, el build estricto falla.
- **Evidencia**: `okf/quartz-okf.ref` = `50d2fc9`. `okf/build-site.sh` descarga el
  tarball de ese SHA. `core/lib/cli/okf-build.ts:31` toma el toolkit de su propia
  ubicación, así que `node <quartz-okf>/core/bin/okf-build.js <singular>` construye con
  el árbol de trabajo. En `50d2fc9`, `MARKER_KEYS` (`core/lib/catalog.ts`) no incluye
  `page`; una clave desconocida es `catalog/marker-invalid` en error, y el plugin va en
  estricto por defecto (`plugins/quartz-okf/src/index.ts:60`).
- **Gravedad**: alta si se pushea Singular antes de tiempo: el CI rompe y Pages deja de
  reconstruir.
- **Propuesta**: orden de entrega: PR del 007, merge, bump del ref en Singular al SHA
  mergeado, y entonces el commit de Singular. Alternativa válida: pushear la rama 007 y
  fijar Singular a ese SHA de rama, como se hizo con `bb257ac`, y refijar tras el merge.
- **Me haría cambiar de opinión**: nada; es un hecho del orden de dependencias.

### 7.3. El fixture no demuestra lo más delicado

- **Afirmación**: la ficha del fixture no tiene `# Topology`, así que el grafo esperado
  no cambia y el smoke build no fija que una relación redactada en la ficha salga de la
  fila. Eso solo lo cubre el test unitario de `graph.test.ts`.
- **Evidencia**: `harness/fixture/content/standards/reader-attraction.md` (sin
  topología); `harness/fixture/expected-graph.json` sin modificar; el assert compara
  nodos por `slug/type/title`, aristas y `stats` (`assert-fixture-graph.ts:37-45`), que
  no cambian porque la ficha no aporta aristas y el título de la fila es el mismo.
- **Gravedad**: media. Es justo lo que "vertical proof" debería cubrir.
- **Propuesta**: una línea de topología en la ficha del fixture, por ejemplo `Uses:
  [[tools/quartz]]`, su arista con origen `standards/arm#ap001` en el grafo esperado, y el
  `stats` regenerado.
- **Me haría cambiar de opinión**: que la regla del repo sea que el smoke build fija
  solo la forma del grafo y los remapeos se prueban en unitario. No lo dice ni la
  constitución ni `CLAUDE.md`.

### 7.4. La ficha de AP012 explica el mecanismo del toolkit al cliente

- **Afirmación**: el párrafo "La identidad de esta entidad sigue estando en la fila
  AP012 del catálogo. Esta página es su ficha extensa: permite explicar la capability sin
  duplicarla como un segundo nodo del grafo" es texto para la herramienta, no para quien
  lee la propuesta.
- **Evidencia**: `analisis/herm/arm/digital-identity.md`, segundo párrafo de "Alcance
  HERM". El sitio se comparte con el cliente.
- **Gravedad**: baja en código, media en imagen.
- **Propuesta**: quitarlo. El resto de la ficha (lectura para la propuesta, criterio de
  diseño) es contenido legítimo.

### 7.5. El bundle y el grafo dejan de coincidir

- **Afirmación**: el exportador sigue listando la ficha como concepto (índices y
  `llms.txt`) mientras el grafo no tiene nodo para ella. Un ingestor que cruce ambos
  encuentra un concepto huérfano, y la cabecera de `llms.txt` cuenta `stats.notes`, que
  ya no coincide con los conceptos listados.
- **Evidencia**: `core/lib/exporter.ts:273-274` (conceptos = documentos no reservados),
  `:294` (grafo = `buildGraph`), `:116` y `:145` (cabeceras con `stats.notes`). No
  ejecutado.
- **Gravedad**: baja hoy (nadie ingiere el bundle de Singular), pero es contrato.
- **Propuesta**: decidirlo a propósito y escribirlo en `plugins/quartz-okf/README.md` §
  Graph shape. Dos salidas razonables: que el concepto de la ficha en el bundle declare a
  qué fila pertenece, o que se cuente aparte.
- **Me haría cambiar de opinión**: un test del exportador que muestre que ya se contempla.

### 7.6. `SESSION.md` está sin trackear y describe el 006

- **Afirmación**: el fichero habla del 006, y su primer pendiente (mergear el PR #1 de
  Singular) ya se hizo.
- **Evidencia**: `git status` lo lista como `??`; su cabecera dice "actualizado
  2026-09-04 23:55".
- **Propuesta**: actualizarlo o borrarlo antes de un `git add -A`.

### 7.7. Menores

- **Precedencia de descripciones**: anotación sobre ficha sobre fila
  (`graph.ts:124-126` y `:216`). Razonable, pero no está documentada ni fijada en test.
- **Los campos de la ficha que proyectaría un `propertyGroup` se pierden en silencio**:
  `projectProperties` se calcula para el nodo de la ficha (`graph.ts:161-162`) y ese nodo
  no se publica; la fila no los recibe. Solo importa con `propertyGroups`, que Singular no
  tiene. Merece aviso o fusión.
- **`CatalogRow.row` solo existe cuando hay `page`** (`catalog.ts:417`): un campo que
  depende de otro es un olor. O siempre, o con otro nombre.
- **`materializationsOf` se calcula cuatro veces por build** en la ruta del emitter:
  `buildGraph` directo, `buildResolver`, `validateMaterializations`, y
  `validateAnnotations` vía `buildResolver`. Barato, pero es un acoplamiento oculto que
  crece.
- **`splitRow` con un `[[` sin cerrar** se traga las barras restantes de la fila sin
  avisar (`catalog.ts:115-120`). Antes, `CELL_SPLIT_RE` no tenía ese modo de fallo.
- **`page=nota#fila`**: si el fragmento nombra una fila de la ficha, el resolver base
  devuelve el slug de la fila y `materializationsOf` lo reporta como
  `catalog/page-unresolved` con un mensaje que no explica por qué. Caso raro.
- **El enlace de Singular es Markdown absoluto** (`[Abrir ficha](/analisis/…)`) y no
  wikilink. Funciona (`markdownLinkTarget` acepta la barra inicial), pero el texto "Abrir
  ficha" es lo que se publica en la celda. Si se mantiene la columna, decidir qué debe
  leer el cliente ahí.

---

## Orden de entrega que propongo

1. Decidir 7.1. Si se acepta la declaración desde la ficha, es un cambio pequeño de spec
   y el índice se reutiliza; si no, dejar constancia del porqué en `research.md`.
2. 7.3: arista autorada en la ficha del fixture y grafo esperado regenerado.
3. 7.4: quitar el párrafo meta de la ficha de AP012.
4. 7.6: `SESSION.md` al día o fuera.
5. Commit del 007 por scopes (`feat(core)`, `fix(core)` federación,
   `feat(quartz-okf-panels)`, `test(harness)`, `docs(007)`), PR, merge.
6. Bump del ref en Singular y commit del consumidor.

---

## Legibilidad: lo decidido y el diseño propuesto (candidato a 008)

**Decisión de Rubén, 2026-09-05**: anillos por profundidad y layout de árbol, sí. Revelado
progresivo, no. Los modos siguen pintando todos sus nodos.

Contexto: el motor (`plugins/quartz-okf-explorer/src/hud/canvas/engine.ts`) usa d3-force
con `forceLink`, `forceManyBody`, `forceX/Y` y un `forceRadial` por tipo
(`layout.radial.byType`). HERM es un árbol estricto de tres niveles bajo `Part of`, y hoy
se dibuja con muelles ajustados a mano en `okf.config.mjs` de Singular.

### Forma

- **Un módulo puro nuevo** `plugins/quartz-okf-explorer/lib/tree.ts`:
  `forestOf(nodes, links, label)` devuelve raíces, padre, profundidad y orden de
  hermanos, o `null` si las aristas bajo esa etiqueta no forman un bosque (un nodo con dos
  padres, un ciclo). `radialLayout(forest, radius)` devuelve posiciones: anillo por
  profundidad, sector angular proporcional al número de hojas, hermanos contiguos.
  Determinista, sin simulación.
- **US1, anillos por profundidad**: el `forceRadial` existente se puede anillar por
  profundidad además de por tipo. Los nodos siguen moviéndose dentro de su anillo por las
  fuerzas; los hermanos se agrupan bajo su padre por el `forceLink`. Cambio pequeño en el
  motor; el consumidor no escribe números.
- **US2, layout de árbol**: los nodos del bosque se fijan con `fx/fy` desde
  `radialLayout`; los que no están en el bosque (las notas que citan códigos en el modo
  "Uso en esta propuesta") nacen en el centroide de lo que citan y siguen libres en la
  simulación, con `forceCollide` para no pisar el anillo. d3-force admite la mezcla de
  fijos y libres sin más.
- **Declaración**: el modo dice `tree: "Part of"` (datos del consumidor, el motor no
  lleva vocabulario). Autodetectar la etiqueta que forma bosque es una comodidad posterior,
  no la base.
- **Defaults por forma**: si el modo declara `tree`, `charge`, `gravity` y las tensiones
  por etiqueta de `layout.link` dejan de hacer falta para ese modo. Los valores que
  Singular encontró a mano pasan a ser el fixture de comparación: el default tiene que
  producir algo al menos igual de legible.

### Pruebas

- `node --test` sobre `lib/tree.ts`: bosque de una raíz, de varias raíces, nodo con dos
  padres (no es bosque), ciclo (no es bosque), profundidades, sectores proporcionales a
  hojas, hermanos contiguos, misma entrada misma salida.
- Auditoría del HUD con Playwright (`harness/audit-site.cjs`) sobre Singular: Taxonomía
  con los 424 nodos en tres anillos legibles, Uso con las notas fuera del árbol sin
  pisarlo, arrastrar un nodo fijo no rompe el árbol.

### Lo que tiene que decidir Rubén antes de la spec

1. Si un nodo fijado por el árbol se puede arrastrar. Propuesta: sí, y al soltarlo vuelve
   a su sitio; el árbol es la verdad, no un punto de partida.
2. Dónde van las notas que citan en el modo Uso: cerca del centroide de lo que citan (más
   legible, se cruzan menos aristas) o en un anillo exterior propio (más ordenado, aristas
   más largas). Propuesta: centroide.
3. Si `tree` se declara por modo o una vez en `explorer.layout`. Propuesta: por modo; no
   todos los modos son árboles.

### Orden

Después de cerrar el 007 (o de aparcarlo, según 7.0), en rama `008-tree-layout` con su
`spec.md`, `plan.md` y `tasks.md` como manda `docs/METHODOLOGY.md`. US1 primero, porque
cambia lo que ve el cliente de Singular con muy poco código; US2 encima.

## Para la réplica

Responder aquí punto por punto, con el mismo formato: qué se rebate, con qué evidencia
(fichero y línea, o una ejecución), y qué se decide. Lo que quede sin réplica se da por
aceptado.
