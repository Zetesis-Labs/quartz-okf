/**
 * Acceso al explorador del grafo desde cualquier nota.
 *
 * Monta una previsualización y un botón que abren el explorador en un modal maximizado,
 * enfocando la nota actual. El emitter sustituye la URL, el título y el punto de montaje.
 * Se ejecuta en cada navegación del router SPA, no solo en la carga inicial.
 */
;(() => {
  const URL_GRAFO = "__EXPLORER_URL__"

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
    .okf-explorer-access .prev { border: 1px solid var(--lightgray); border-radius: 8px;
      padding: .3rem; background: var(--light); cursor: pointer; }
    .okf-explorer-access .prev:hover { border-color: var(--gray); }
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
      background: var(--light); box-shadow: 0 18px 60px rgba(0,0,0,.4);
      display: flex; flex-direction: column; }
    .okf-explorer-modal .bar { display: flex; align-items: center; gap: .6rem; padding: .45rem .7rem;
      border-bottom: 1px solid var(--lightgray); font-size: .85rem; }
    .okf-explorer-modal .bar b { font-weight: 650; }
    .okf-explorer-modal .bar .sp { margin-left: auto; display: flex; gap: .35rem; }
    .okf-explorer-modal .bar a, .okf-explorer-modal .bar button { padding: .2rem .6rem; border-radius: 999px;
      border: 1px solid var(--lightgray); background: transparent; color: inherit;
      font: inherit; font-size: .8rem; cursor: pointer; text-decoration: none; }
    .okf-explorer-modal .bar a:hover, .okf-explorer-modal .bar button:hover { background: var(--lightgray); }
    .okf-explorer-modal iframe { flex: 1; width: 100%; border: 0; }
    @media (max-width: 700px) { .okf-explorer-modal .box { inset: .5rem; } }`

  function ensureStyles() {
    if (document.getElementById("okf-explorer-styles")) return
    const s = document.createElement("style")
    s.id = "okf-explorer-styles"
    s.textContent = styles
    document.head.appendChild(s)
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
          <span class="sp">
            <a class="full" href="${URL_GRAFO}" target="_blank" rel="noopener">Pantalla completa</a>
            <button class="close" aria-label="Cerrar">✕</button>
          </span>
        </div>
      </div>`
    document.body.appendChild(m)
    const close = () => {
      m.classList.remove("open")
      const f = m.querySelector("iframe")
      if (f) f.remove()
      document.body.style.overflow = ""
    }
    m.querySelector(".close").addEventListener("click", close)
    m.addEventListener("click", (e) => { if (e.target === m) close() })
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && m.classList.contains("open")) close()
    })
    return m
  }

  function openModal(slug) {
    const m = modal()
    const box = m.querySelector(".box")
    const url = slug ? `${URL_GRAFO}?focus=${encodeURIComponent(slug)}` : URL_GRAFO
    m.querySelector(".full").href = url
    const old = box.querySelector("iframe")
    if (old) old.remove()
    const f = document.createElement("iframe")
    f.src = url
    f.title = "__TITLE__"
    box.appendChild(f)
    m.classList.add("open")
    document.body.style.overflow = "hidden"
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
    if (host.dataset.okfExplorer === "1") return
    host.dataset.okfExplorer = "1"
    host.classList.add("okf-explorer-access")
    host.innerHTML = `
      <h3>__TITLE__</h3>
      <div class="prev" role="button" tabindex="0" aria-label="Abrir el grafo">${svgPreview}</div>
      <div class="cta">
        <button class="open" type="button">Abrir el grafo</button>
      </div>
      <div class="hint" data-okf-stats></div>`
    const open = () => openModal(currentSlug())
    host.querySelector(".prev").addEventListener("click", open)
    host.querySelector(".prev").addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open() }
    })
    host.querySelector("button.open").addEventListener("click", open)
    // El recuento sale del propio grafo: no se codifica en el plugin.
    const stats = host.querySelector("[data-okf-stats]")
    if (stats && !stats.textContent) {
      fetch("/static/okf-graph.json").then(r => r.json()).then(g => {
        const n = (g.stats && g.stats.notes) || (g.nodes || []).length
        const e = (g.stats && g.stats.edges) || (g.edges || []).length
        stats.textContent = `${n} notas · ${e} relaciones tipadas`
      }).catch(() => stats.remove())
    }
  }

  mount()
  // El router SPA de Quartz reemplaza el contenido sin recargar.
  document.addEventListener("nav", mount)
})()
