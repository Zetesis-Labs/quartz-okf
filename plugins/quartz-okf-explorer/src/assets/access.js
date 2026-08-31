/**
 * Acceso al explorador del grafo desde cualquier nota.
 *
 * Monta una previsualización y un botón que abren el explorador en un modal maximizado,
 * enfocando la nota actual. El emitter sustituye la URL, el título, el punto de montaje y
 * las palabras del catálogo. Se ejecuta en cada navegación del router SPA, no solo en la
 * carga inicial.
 */
;(() => {
  const URL_GRAFO = "__EXPLORER_URL__"
  const W = __OKF_WORDING__

  const fill = (tpl, vars) =>
    tpl.replace(/\{([^}|]+)(?:\|([^|}]*)\|([^}]*))?\}/g, (_, k, one, many) => {
      const v = vars[k.trim()] ?? ""
      return one == null ? String(v) : `${v} ${Number(v) === 1 ? one : many}`
    })

  const svgPreview = `
    <svg viewBox="0 0 200 96" aria-hidden="true">
      <line x1="46" y1="30" x2="100" y2="48"/><line x1="46" y1="30" x2="70" y2="72"/>
      <line x1="100" y1="48" x2="70" y2="72"/><line x1="100" y1="48" x2="152" y2="26"/>
      <line x1="100" y1="48" x2="150" y2="72"/><line x1="152" y1="26" x2="150" y2="72"/>
      <circle cx="46" cy="30" r="6" class="n1"/><circle cx="100" cy="48" r="9" class="n2"/>
      <circle cx="70" cy="72" r="5" class="n3"/><circle cx="152" cy="26" r="6" class="n4"/>
      <circle cx="150" cy="72" r="5" class="n5"/>
    </svg>`

  const styles = `
    .okf-explorer-access { display: flex; flex-direction: column; gap: .5rem; }
    .okf-explorer-access h3 { margin: 0; }
    .okf-explorer-access .prev { position: relative; border: 1px solid var(--lightgray);
      border-radius: 8px; padding: .3rem; background: var(--light); cursor: pointer; }
    .okf-explorer-access .prev:hover, .okf-explorer-access .prev:focus-visible { border-color: var(--secondary); }
    .okf-explorer-access .prev::after { content: attr(data-open); position: absolute; inset: 0;
      display: grid; place-items: center; border-radius: 7px; font-size: .8rem; font-weight: 600;
      color: var(--light); background: rgba(0,0,0,.45); opacity: 0; transition: opacity .15s ease; }
    .okf-explorer-access .prev:hover::after, .okf-explorer-access .prev:focus-visible::after { opacity: 1; }
    .okf-explorer-access svg { display: block; width: 100%; height: auto; }
    .okf-explorer-access svg line { stroke: var(--gray); stroke-width: 1.4; }
    .okf-explorer-access svg circle { stroke: var(--light); stroke-width: 1.5; }
    .okf-explorer-access svg .n1 { fill: #4c7ecf } .okf-explorer-access svg .n2 { fill: #e08a3c }
    .okf-explorer-access svg .n3 { fill: #4caf7c } .okf-explorer-access svg .n4 { fill: #c2544d }
    .okf-explorer-access svg .n5 { fill: #9a6fbf }
    .okf-explorer-access .cta { display: flex; gap: .4rem; align-items: center; }
    .okf-explorer-access button.open { flex: 1; padding: .3rem .6rem; border-radius: 5px; cursor: pointer;
      border: 1px solid var(--lightgray); background: var(--light); color: inherit;
      font: inherit; font-size: .85rem; }
    .okf-explorer-access button.open:hover { background: var(--lightgray); }
    .okf-explorer-access .hint { font-size: .72rem; color: var(--gray); }

    .okf-explorer-modal { position: fixed; inset: 0; z-index: 999; display: none;
      background: rgba(0,0,0,.55); backdrop-filter: blur(2px); }
    .okf-explorer-modal.open { display: block; }
    .okf-explorer-modal .box { position: absolute; inset: 1.5rem; border-radius: 12px; overflow: hidden;
      transition: inset .18s ease, border-radius .18s ease;
      background: var(--light); box-shadow: 0 18px 60px rgba(0,0,0,.4);
      display: flex; flex-direction: column; }
    .okf-explorer-modal .bar { display: flex; align-items: center; gap: .6rem; padding: .45rem .7rem;
      border-bottom: 1px solid var(--lightgray); font-size: .85rem; }
    .okf-explorer-modal .bar b { font-weight: 650; white-space: nowrap; }
    /* La miga de grafos del explorador: cada nivel anterior devuelve a ese grafo. */
    .okf-explorer-modal .bar .trail { display: flex; align-items: center; gap: .1rem; flex: 1 1 auto;
      min-width: 0; white-space: nowrap; }
    .okf-explorer-modal .bar .trail .lvl { border: 0; background: none; color: var(--secondary); cursor: pointer;
      font: inherit; padding: .1rem .35rem; border-radius: 6px; min-width: 3rem; overflow: hidden; text-overflow: ellipsis; }
    .okf-explorer-modal .bar .trail .lvl:hover { background: var(--lightgray); }
    .okf-explorer-modal .bar .trail .cur { font-weight: 600; padding: .1rem .35rem; overflow: hidden; text-overflow: ellipsis; }
    .okf-explorer-modal .bar .trail .sep { color: var(--gray); }
    .okf-explorer-modal .bar .sp { margin-left: auto; display: flex; gap: .35rem; flex: 0 0 auto; }
    .okf-explorer-modal .bar a, .okf-explorer-modal .bar button { padding: .2rem .6rem; border-radius: 999px;
      border: 1px solid var(--lightgray); background: transparent; color: inherit;
      font: inherit; font-size: .8rem; cursor: pointer; text-decoration: none; }
    .okf-explorer-modal .bar a:hover, .okf-explorer-modal .bar button:hover { background: var(--lightgray); }
    .okf-explorer-modal iframe { flex: 1; width: 100%; border: 0; }
    /* El grafo tarda: sin señal, el modal se abre en blanco y parece roto. */
    .okf-explorer-modal .cargando { flex: 1; display: grid; place-items: center; gap: .6rem;
      color: var(--gray); font-size: .85rem; }
    .okf-explorer-modal .cargando .sp { width: 22px; height: 22px; border-radius: 50%;
      border: 2px solid var(--lightgray); border-top-color: var(--secondary);
      animation: okf-giro .8s linear infinite; }
    @keyframes okf-giro { to { transform: rotate(360deg) } }
    .okf-explorer-modal.listo .cargando { display: none }
    /* Ampliado: el mismo modal a sangre, sin salir de la página ni abrir pestaña. */
    .okf-explorer-modal.wide .box { inset: 0; border-radius: 0; }
    @media (max-width: 700px) { .okf-explorer-modal .box { inset: .5rem; } }`

  function ensureStyles() {
    if (document.getElementById("okf-explorer-styles")) return
    const s = document.createElement("style")
    s.id = "okf-explorer-styles"
    s.textContent = styles
    document.head.appendChild(s)
  }

  // El modal debe secuestrar el scroll: con solo `body { overflow: hidden }` la página de
  // detrás seguía desplazándose, porque según el tema el contenedor que scrollea es <html>
  // y porque la rueda que el iframe no consume encadena hacia fuera. Se bloquean los dos
  // elementos y se compensa el ancho de la barra para que el fondo no dé un salto lateral.
  let previo = null
  function secuestrarPagina() {
    if (previo) return
    const d = document.documentElement, b = document.body
    previo = { htmlOv: d.style.overflow, bodyOv: b.style.overflow, pad: b.style.paddingRight }
    const barra = window.innerWidth - d.clientWidth
    d.style.overflow = "hidden"
    b.style.overflow = "hidden"
    if (barra > 0) b.style.paddingRight = barra + "px"
    document.addEventListener("wheel", frenar, { passive: false })
    document.addEventListener("touchmove", frenar, { passive: false })
  }
  function soltarPagina() {
    if (!previo) return
    document.documentElement.style.overflow = previo.htmlOv
    document.body.style.overflow = previo.bodyOv
    document.body.style.paddingRight = previo.pad
    previo = null
    document.removeEventListener("wheel", frenar, { passive: false })
    document.removeEventListener("touchmove", frenar, { passive: false })
  }
  // Con el modal abierto, cualquier rueda que llegue al documento padre —es decir, la que
  // el iframe no ha consumido— se descarta en vez de mover el fondo.
  function frenar(e) {
    const m = document.getElementById("okf-explorer-modal")
    if (m && m.classList.contains("open")) e.preventDefault()
  }

  function modal() {
    let m = document.getElementById("okf-explorer-modal")
    if (m) return m
    m = document.createElement("div")
    m.id = "okf-explorer-modal"
    m.className = "okf-explorer-modal"
    m.innerHTML = `
      <div class="box" role="dialog" aria-modal="true" aria-label="__TITLE__">
        <div class="bar">
          <b>__TITLE__</b>
          <nav class="trail" aria-label="__TITLE__"></nav>
          <span class="sp">
            <button class="full" type="button" aria-pressed="false">${W.expand}</button>
            <button class="close" aria-label="${W.close}">✕</button>
          </span>
        </div>
      </div>`
    document.body.appendChild(m)
    const close = () => {
      soltarPagina()
      m.classList.remove("open", "wide")
      const b = m.querySelector(".full")
      if (b) { b.setAttribute("aria-pressed", "false"); b.textContent = W.expand }
      const f = m.querySelector("iframe")
      if (f) f.remove()
      m.querySelector(".trail").innerHTML = ""
    }
    // La miga la manda el explorador desde su iframe; solo se atiende a ese iframe y a
    // este origen, y sus textos se pintan como texto, nunca como marcado.
    window.addEventListener("message", (e) => {
      const f = m.querySelector("iframe")
      if (e.origin !== location.origin || !f || e.source !== f.contentWindow) return
      const d = e.data
      if (!d || d.type !== "okf-explorer:trail") return
      // Sin miga válida no se confirma: el explorador conserva la suya y el lector no se
      // queda sin camino de vuelta.
      if (!Array.isArray(d.levels)) {
        console.warn("[quartz-okf-explorer] okf-explorer:trail without a levels array", d)
        return
      }
      pintarMiga(m, f, d.levels)
      f.contentWindow.postMessage({ type: "okf-explorer:trail-shown" }, location.origin)
    })
    const full = m.querySelector(".full")
    full.addEventListener("click", () => {
      const wide = m.classList.toggle("wide")
      full.setAttribute("aria-pressed", String(wide))
      full.textContent = wide ? W.reduce : W.expand
    })
    m.querySelector(".close").addEventListener("click", close)
    m.addEventListener("click", (e) => { if (e.target === m) close() })
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && m.classList.contains("open")) close()
    })
    return m
  }

  // La barra del modal dice siempre dónde está el lector: el grafo de partida solo, o el
  // camino entero dentro de un subgrafo.
  function pintarMiga(m, frame, levels) {
    const nav = m.querySelector(".trail")
    nav.innerHTML = ""
    levels.forEach((l, i) => {
      if (l.current) {
        const cur = document.createElement("b")
        cur.className = "cur"
        cur.textContent = String(l.text)
        cur.title = String(l.text)
        nav.appendChild(cur)
        return
      }
      const b = document.createElement("button")
      b.type = "button"
      b.className = "lvl"
      b.textContent = String(l.text)
      b.title = String(l.back || l.text)
      b.addEventListener("click", () =>
        frame.contentWindow.postMessage({ type: "okf-explorer:go", level: Number(l.index) }, location.origin))
      nav.appendChild(b)
      if (i < levels.length - 1) {
        const sep = document.createElement("span")
        sep.className = "sep"
        sep.textContent = "›"
        nav.appendChild(sep)
      }
    })
  }

  function openModal(slug) {
    const m = modal()
    const box = m.querySelector(".box")
    const url = slug ? `${URL_GRAFO}?focus=${encodeURIComponent(slug)}` : URL_GRAFO
    const old = box.querySelector("iframe")
    if (old) old.remove()
    const prev = box.querySelector(".cargando")
    if (prev) prev.remove()
    m.classList.remove("listo")
    const wait = document.createElement("div")
    wait.className = "cargando"
    wait.innerHTML = `<div class="sp"></div><div>${W.loading}</div>`
    box.appendChild(wait)
    const f = document.createElement("iframe")
    f.src = url
    f.title = "__TITLE__"
    f.addEventListener("load", () => m.classList.add("listo"))
    box.appendChild(f)
    m.classList.add("open")
    secuestrarPagina()
  }

  function currentSlug() {
    // `location.pathname` llega percent-encoded y los slugs del grafo llevan los acentos
    // tal cual: sin decodificar, ninguna nota con caracteres no ASCII llega a coincidir.
    let p
    try {
      p = decodeURIComponent(location.pathname)
    } catch (_) {
      p = location.pathname
    }
    p = p.replace(/^\/+|\/+$|\.html$/g, "")
    return p && p !== "index" ? p : ""
  }

  function mount() {
    ensureStyles()
    // Con el grafo de Quartz desactivado no hay contenedor que reutilizar: se crea uno
    // al principio del panel derecho, que es donde el lector lo espera.
    let host = document.querySelector(".right .graph, .right .okf-explorer-access")
    if (!host) {
      const right = document.querySelector("__MOUNT__")
      if (!right) return
      host = document.createElement("div")
      right.insertBefore(host, right.firstChild)
    }
    // El router SPA reutiliza nodos con micromorph: el contenedor puede conservar la marca
    // y haber perdido el contenido. Sin comprobarlo, el widget se quedaría vacío para siempre.
    if (host.dataset.okfExplorer === "1" && host.querySelector("button.open")) return
    host.dataset.okfExplorer = "1"
    host.classList.add("okf-explorer-access")
    host.innerHTML = `
      <h3>__TITLE__</h3>
      <div class="prev" role="button" tabindex="0" aria-label="${W.open}" data-open="${W.open}">${svgPreview}</div>
      <div class="cta">
        <button class="open" type="button">${W.open}</button>
      </div>
      <div class="hint" data-okf-stats>${W.statsLoading}</div>`
    const open = () => openModal(currentSlug())
    host.querySelector(".prev").addEventListener("click", open)
    host.querySelector(".prev").addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open() }
    })
    host.querySelector("button.open").addEventListener("click", open)
    // El recuento sale del propio grafo: no se codifica en el plugin.
    const stats = host.querySelector("[data-okf-stats]")
    if (stats) {
      fetch("/static/okf-graph.json").then(r => r.json()).then(g => {
        const notes = (g.stats && g.stats.notes) || (g.nodes || []).length
        const edges = (g.stats && g.stats.edges) || (g.edges || []).length
        stats.textContent = fill(W.stats, { notes, edges })
      }).catch(() => stats.remove())
    }
  }

  mount()
  // El router SPA de Quartz reemplaza el contenido sin recargar.
  document.addEventListener("nav", mount)
})()
