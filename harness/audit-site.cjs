// Auditoría de un sitio ya construido: móvil (390×844, táctil) y teclado (1440×900).
// No entra en `npm test` — necesita un sitio servido y Playwright:
//
//   cd <consumidor> && python3 serve.py 8815
//   NODE_PATH=<...>/node_modules node harness/audit-site.cjs http://127.0.0.1:8815 [ruta-de-nota]
//
// Sale 1 con la lista de hallazgos; 0 si no hay ninguno.
const { chromium, devices } = require("playwright")

const BASE = process.argv[2] || "http://127.0.0.1:8815"
const NOTE = process.argv[3] || "/"
// La nota es también su slug: el explorador abre enfocado en ella, así el toque del
// centro del lienzo cae sobre un nodo y no sobre el vacío.
const FOCUS = NOTE.replace(/^\//, "").replace(/\/$/, "")
const findings = []
const add = (area, id, detail) => findings.push({ area, id, detail })

const openExplorer = async (page) => {
  await page.goto(BASE + NOTE, { waitUntil: "networkidle" })
  await page.click(".okf-explorer-open")
  await page.waitForSelector(".okf-explorer-stage canvas.okf-canvas", { timeout: 10000 })
  await page.waitForTimeout(1500)
}

const box = (page, sel) => page.$eval(sel, (el) => {
  const r = el.getBoundingClientRect()
  return { x: r.x, y: r.y, w: r.width, h: r.height, bottom: r.bottom, right: r.right }
}).catch(() => null)

const overlap = (a, b) => a && b && a.x < b.right && b.x < a.right && a.y < b.bottom && b.y < a.bottom

;(async () => {
  const browser = await chromium.launch()

  // ---------------- MÓVIL ----------------
  {
    const ctx = await browser.newContext({ ...devices["iPhone 13"] })
    const page = await ctx.newPage()
    const errors = []
    page.on("pageerror", (e) => errors.push(String(e).slice(0, 120)))
    await openExplorer(page)

    const vp = page.viewportSize()
    // 1. touch-action del lienzo
    const touchAction = await page.$eval("canvas.okf-canvas", (el) => getComputedStyle(el).touchAction)
    if (touchAction !== "none") add("móvil", "canvas-touch-action", `touch-action="${touchAction}": el navegador se queda los gestos (pinch/scroll) antes que d3`)

    // 2. desbordamiento horizontal
    const scrollW = await page.evaluate(() => document.documentElement.scrollWidth)
    if (scrollW > vp.width + 1) add("móvil", "overflow-x", `scrollWidth ${scrollW} > ${vp.width}`)

    // 3. islas dentro del viewport
    for (const sel of ["#bar", "#omnibar", "#views", "#filters"]) {
      const b = await box(page, sel)
      if (b && (b.right > vp.width + 1 || b.bottom > vp.height + 1 || b.x < -1 || b.y < -1))
        add("móvil", `fuera-de-pantalla:${sel}`, `${JSON.stringify(b)} en ${vp.width}×${vp.height}`)
    }

    // 4. tamaño de los objetivos táctiles
    const small = await page.$$eval(".okf-explorer-stage button, .okf-explorer-stage [role=button]", (els) =>
      els.filter((el) => el.offsetParent !== null).map((el) => {
        const r = el.getBoundingClientRect()
        return { t: (el.getAttribute("aria-label") || el.title || el.textContent || "").trim().slice(0, 22), w: Math.round(r.width), h: Math.round(r.height) }
      }).filter((x) => x.w > 0 && (x.w < 32 || x.h < 32)))
    if (small.length) add("móvil", "objetivo-tactil", `${small.length} controles < 32px: ${JSON.stringify(small.slice(0, 6))}`)

    // 6. el menú lateral de filtros en móvil
    await page.click("#filters .okf-chip")
    await page.waitForTimeout(500)
    const side = await box(page, "#side")
    const bar = await box(page, "#bar")
    const omni = await box(page, "#omnibar")
    if (side && bar && overlap(side, bar)) add("móvil", "side-solapa-bar", `#side ${JSON.stringify(side)} pisa #bar ${JSON.stringify(bar)}`)
    if (side && omni && overlap(side, omni)) add("móvil", "side-solapa-omnibar", `#side ${JSON.stringify(side)} pisa la cápsula de búsqueda ${JSON.stringify(omni)}`)
    if (side && side.bottom > vp.height + 1) add("móvil", "side-desborda", JSON.stringify(side))

    // 5. tap sobre un nodo → ¿abre el dock, y su cabecera queda accesible?
    await page.goto(`${BASE}/?explorer${FOCUS ? `&focus=${FOCUS}` : ""}`, { waitUntil: "networkidle" })
    await page.waitForSelector(".okf-explorer-stage canvas.okf-canvas")
    await page.waitForTimeout(2500)
    // El nodo enfocado no queda en el centro geométrico: `fit` lo centra en el hueco libre
    // que dejan la cápsula de búsqueda y la pila de controles.
    const c = await box(page, "canvas.okf-canvas")
    const topEdge = (await box(page, "#omnibar"))?.bottom ?? 0
    const bottomEdge = (await box(page, "aside.okf-layer"))?.y ?? c.h
    await page.touchscreen.tap(Math.round(c.w / 2), Math.round((topEdge + bottomEdge) / 2))
    await page.waitForTimeout(1500)
    const dock = await box(page, "#dock")
    if (!dock) add("móvil", "tap-nodo", "un toque sobre el nodo enfocado no abrió el dock")
    else {
      const header = await box(page, "#dock header")
      const omni2 = await box(page, "#omnibar")
      if (header && omni2 && overlap(header, omni2)) add("móvil", "cabecera-dock-tapada", "la cápsula de búsqueda pisa la cabecera del dock")
      const pin = await page.$("#dock header button[aria-pressed]")
      if (!pin) add("móvil", "sin-fijar", "el dock no ofrece el botón de fijar")
      else {
        const r = await pin.boundingBox()
        if (r && (r.width < 32 || r.height < 32)) add("móvil", "fijar-pequeño", `el botón de fijar mide ${Math.round(r.width)}×${Math.round(r.height)}`)
      }
    }

    // 7. con el dock abierto se puede volver al grafo
    const collapse = await page.$("#dock header button:last-of-type")
    if (!collapse) add("móvil", "sin-recoger", "el dock no ofrece cómo recogerse")
    else {
      await collapse.click()
      await page.waitForTimeout(600)
      if (await page.$("#dock")) add("móvil", "no-recoge", "el botón de recoger no cierra el dock")
      const filters = await box(page, "#filters")
      if (!filters) add("móvil", "pila-no-vuelve", "tras recoger el dock, los filtros no vuelven")
    }
    if (errors.length) add("móvil", "consola", errors.join(" | "))
    await ctx.close()
  }

  // ---------------- TECLADO ----------------
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const page = await ctx.newPage()
    const errors = []
    page.on("pageerror", (e) => errors.push(String(e).slice(0, 120)))
    await openExplorer(page)

    // 1. ¿dónde está el foco tras abrir?
    const afterOpen = await page.evaluate(() => {
      const a = document.activeElement
      return { tag: a?.tagName, cls: (a?.className || "").toString().slice(0, 40), inStage: Boolean(a?.closest(".okf-explorer-stage")) }
    })
    if (!afterOpen.inStage) add("teclado", "foco-inicial", `tras abrir, el foco sigue en la página de detrás (${afterOpen.tag}.${afterOpen.cls}): el recorrido por nodos no responde`)

    // 2. ¿Tab camina por los nodos?
    await page.keyboard.press("Tab")
    await page.waitForTimeout(400)
    const walked = await page.evaluate(() => Boolean(document.querySelector(".okf-explorer-stage")))
    const focusAfterTab = await page.evaluate(() => {
      const a = document.activeElement
      return { tag: a?.tagName, inStage: Boolean(a?.closest(".okf-explorer-stage")), label: (a?.getAttribute("aria-label") || a?.textContent || "").trim().slice(0, 30) }
    })
    if (!focusAfterTab.inStage) add("teclado", "tab-fuera", `Tab lleva el foco fuera del explorador (${focusAfterTab.tag} «${focusAfterTab.label}»): no hay trampa de foco`)

    // 3. ¿el diálogo se anuncia como tal?
    const dialog = await page.$eval(".okf-explorer-stage", (el) => ({ role: el.getAttribute("role"), modal: el.getAttribute("aria-modal"), label: el.getAttribute("aria-label") }))
    if (dialog.role !== "dialog" || dialog.modal !== "true") add("teclado", "sin-dialogo", `la capa no declara role=dialog/aria-modal (role=${dialog.role}, aria-modal=${dialog.modal}): un lector de pantalla sigue leyendo la página de detrás`)

    // 4. anillo de foco visible en los controles
    const rings = await page.evaluate(() => {
      const out = []
      for (const el of document.querySelectorAll(".okf-explorer-stage .okf-chip, .okf-explorer-stage .okf-icon")) {
        if (el.offsetParent === null) continue
        el.focus()
        const s = getComputedStyle(el)
        const visible = (s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0) || s.boxShadow !== "none"
        out.push({ t: (el.textContent || el.title || "").trim().slice(0, 18), visible })
        if (out.length > 8) break
      }
      return out
    })
    const blind = rings.filter((r) => !r.visible)
    if (blind.length) add("teclado", "sin-anillo-de-foco", `${blind.length}/${rings.length} controles no muestran nada al recibir el foco: ${JSON.stringify(blind.slice(0, 5))}`)

    // 5. ¿se puede devolver el foco al lienzo?
    const canvasFocusable = await page.$eval("canvas.okf-canvas", (el) => el.tabIndex >= 0)
    if (!canvasFocusable) add("teclado", "lienzo-no-enfocable", "el lienzo no tiene tabindex: una vez el foco está en un control no hay forma de volver al recorrido por nodos")

    // 6. `/` enfoca la búsqueda
    await page.evaluate(() => document.body.focus())
    await page.keyboard.press("/")
    await page.waitForTimeout(300)
    const onOmnibar = await page.evaluate(() => document.activeElement?.id === "q")
    if (!onOmnibar) add("teclado", "barra-/", "`/` no lleva el foco al buscador")

    // 7. Escape desde el buscador
    await page.keyboard.type("token")
    await page.waitForTimeout(600)
    await page.keyboard.press("Escape")
    await page.waitForTimeout(300)
    const stillOpen = await page.$(".okf-explorer-stage")
    if (!stillOpen) add("teclado", "escape-cierra-de-mas", "Escape con texto en el buscador cerró el explorador entero")

    // 8. el recorrido con flechas desde el lienzo, sin ratón
    await page.evaluate(() => document.querySelector("canvas.okf-canvas")?.focus())
    for (const key of ["ArrowRight", "ArrowDown", "ArrowLeft"]) {
      await page.keyboard.press(key)
      await page.waitForTimeout(500)
    }
    const walkedTo = await page.evaluate(() => document.querySelector("#sel")?.textContent?.trim().slice(0, 40) || null)
    const stageAlive = await page.$(".okf-explorer-stage")
    if (!stageAlive) add("teclado", "flechas-rompen", "las flechas cerraron o rompieron el explorador")

    // 9. ⏎ sobre el nodo enfocado abre su nota en el dock
    await page.keyboard.press("Enter")
    await page.waitForTimeout(1200)
    if (!(await page.$("#dock"))) add("teclado", "enter-no-abre", `⏎ sobre el nodo enfocado no abrió el dock (selección: ${walkedTo})`)

    // 10. Escape cierra y devuelve el foco al control de origen
    await page.keyboard.press("Escape")
    await page.waitForTimeout(300)
    await page.keyboard.press("Escape")
    await page.waitForTimeout(300)
    await page.keyboard.press("Escape")
    await page.waitForTimeout(800)
    const closed = !(await page.$(".okf-explorer-stage"))
    if (closed) {
      const back = await page.evaluate(() => document.activeElement?.className?.toString().includes("okf-explorer-open"))
      if (!back) add("teclado", "foco-al-cerrar", "al cerrar, el foco no vuelve al botón que abrió el explorador")
    }

    if (errors.length) add("teclado", "consola", errors.join(" | "))
    await ctx.close()
  }

  await browser.close()
  console.log(JSON.stringify(findings, null, 2))
  console.log(`\n${findings.length} hallazgos`)
  process.exit(findings.length === 0 ? 0 : 1)
})()
