/* Panel El Guineo: editor de texto enriquecido y cajas comunes (portada, galería, adjuntos). */
(function (P) {
  "use strict";
  const { G, esc, $, $$ } = P;

  /* ------------------------- Configuración de Quill ------------------------- */
  let preparado = false;
  function prepararQuill() {
    if (preparado || !window.Quill) return;
    preparado = true;
    const Video = window.Quill.import("formats/video");
    class VideoSeguro extends Video {
      static sanitize(url) {
        const u = String(url || "").trim();
        let m = u.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{6,})/);
        if (m) return "https://www.youtube-nocookie.com/embed/" + m[1];
        m = u.match(/vimeo\.com\/(?:video\/)?(\d+)/);
        if (m) return "https://player.vimeo.com/video/" + m[1];
        m = u.match(/drive\.google\.com\/file\/d\/([\w-]+)/);
        if (m) return "https://drive.google.com/file/d/" + m[1] + "/preview";
        return "about:blank";
      }
    }
    window.Quill.register(VideoSeguro, true);
  }

  const COLORES = ["", "#172341", "#143c8c", "#0b2766", "#d3141c", "#a10e15", "#1d7a4b", "#9a5b00", "#56627e"];
  const RESALTADOS = ["", "#fff3b0", "#edf2fb", "#fde8e9", "#e6f4ec"];

  const TITULOS_BOTONES = [
    [".ql-bold", "Negrita"],
    [".ql-italic", "Cursiva"],
    [".ql-underline", "Subrayado"],
    [".ql-strike", "Tachado"],
    ['.ql-list[value="ordered"]', "Lista numerada"],
    ['.ql-list[value="bullet"]', "Lista con viñetas"],
    ['.ql-indent[value="-1"]', "Quitar sangría"],
    ['.ql-indent[value="+1"]', "Aumentar sangría"],
    [".ql-blockquote", "Cita destacada"],
    [".ql-link", "Enlace"],
    [".ql-image", "Insertar imagen"],
    [".ql-video", "Insertar video de YouTube"],
    [".ql-tabla", "Tabla"],
    [".ql-clean", "Quitar formato"],
  ];

  // Crea un editor completo dentro de "selector". Devuelve { quill, html(), vacio() }.
  P.crearEditorTexto = function (selector, { placeholder = "Escribe aquí…", inicial = "" } = {}) {
    prepararQuill();
    const quill = new window.Quill(selector, {
      theme: "snow",
      placeholder,
      modules: {
        table: true,
        toolbar: {
          container: [
            [{ header: [2, 3, 4, false] }],
            ["bold", "italic", "underline", "strike"],
            [{ color: COLORES }, { background: RESALTADOS }],
            [{ list: "ordered" }, { list: "bullet" }, { indent: "-1" }, { indent: "+1" }],
            [{ align: [] }],
            ["blockquote", "link"],
            ["image", "video", "tabla"],
            ["clean"],
          ],
          handlers: {
            image: () => insertarImagen(quill),
            tabla: () => menuTabla(quill),
          },
        },
      },
    });
    const barra = quill.getModule("toolbar").container;
    const botonTabla = $(".ql-tabla", barra);
    if (botonTabla) {
      botonTabla.innerHTML = '<svg viewBox="0 0 18 18"><rect class="ql-stroke" x="2.5" y="3.5" width="13" height="11" rx="1"/><path class="ql-stroke" d="M2.5 7.5h13M2.5 11h13M7 7.5v7M11 7.5v7"/></svg>';
    }
    TITULOS_BOTONES.forEach(([sel, t]) => {
      const b = $(sel, barra);
      if (b) {
        b.title = t;
        b.setAttribute("aria-label", t);
      }
    });
    if (inicial) quill.clipboard.dangerouslyPasteHTML(inicial, "silent");
    quill.history.clear();
    return {
      quill,
      vacio: () => quill.getLength() <= 1 && !quill.root.querySelector("img,iframe,table"),
      html: () => (quill.getLength() <= 1 && !quill.root.querySelector("img,iframe,table") ? "" : quill.getSemanticHTML()),
    };
  };

  async function insertarImagen(quill) {
    const [file] = await P.elegirArchivos({ accept: "image/*" });
    if (!file) return;
    G.toast("Subiendo imagen…");
    try {
      const rec = await P.subirUno(file, { clase: "imagen", visible: false, categoria: "Imágenes", titulo: "Imagen dentro del texto" });
      const r = quill.getSelection(true);
      quill.insertEmbed(r ? r.index : quill.getLength(), "image", rec.url, "user");
    } catch (e) {
      G.toast(e.message, "error");
    }
  }

  // Menú para insertar y modificar tablas.
  function menuTabla(quill) {
    const tabla = quill.getModule("table");
    const barra = quill.getModule("toolbar").container;
    const boton = $(".ql-tabla", barra);
    let menu = $(".menu-tabla", barra.parentElement);
    if (menu) {
      menu.remove();
      return;
    }
    const enTabla = (() => {
      const r = quill.getSelection();
      if (!r) return false;
      const [celda] = quill.getLine(r.index);
      return Boolean(celda && celda.statics && celda.statics.blotName === "table");
    })();
    menu = document.createElement("div");
    menu.className = "menu-tabla";
    menu.setAttribute("role", "menu");
    const op = (accion, texto, habilitado = true) => `<button type="button" role="menuitem" data-tabla="${accion}" ${habilitado ? "" : "disabled"}>${texto}</button>`;
    menu.innerHTML = `
      <div class="menu-tabla-insertar">
        <label>Filas <input type="number" id="tabla-filas" min="1" max="30" value="3"></label>
        <label>Columnas <input type="number" id="tabla-cols" min="1" max="10" value="3"></label>
        ${op("insertar", "Insertar tabla")}
      </div>
      <div class="menu-tabla-acciones">
        ${op("filaArriba", "Fila arriba", enTabla)}
        ${op("filaAbajo", "Fila abajo", enTabla)}
        ${op("colIzq", "Columna a la izquierda", enTabla)}
        ${op("colDer", "Columna a la derecha", enTabla)}
        ${op("borrarFila", "Eliminar fila", enTabla)}
        ${op("borrarCol", "Eliminar columna", enTabla)}
        ${op("borrarTabla", "Eliminar tabla", enTabla)}
      </div>
      ${enTabla ? "" : '<p class="menu-tabla-ayuda">Ubica el cursor dentro de una tabla para agregar o quitar filas y columnas.</p>'}`;
    barra.parentElement.insertBefore(menu, barra.nextSibling);
    menu.style.left = Math.max(0, boton.offsetLeft - 120) + "px";
    menu.addEventListener("mousedown", (e) => {
      if (e.target.tagName === "BUTTON") e.preventDefault();
    });
    menu.addEventListener("click", (e) => {
      const b = e.target.closest("[data-tabla]");
      if (!b) return;
      quill.focus();
      const acciones = {
        insertar: () => tabla.insertTable(Math.max(1, Math.min(30, Number($("#tabla-filas", menu).value) || 3)), Math.max(1, Math.min(10, Number($("#tabla-cols", menu).value) || 3))),
        filaArriba: () => tabla.insertRowAbove(),
        filaAbajo: () => tabla.insertRowBelow(),
        colIzq: () => tabla.insertColumnLeft(),
        colDer: () => tabla.insertColumnRight(),
        borrarFila: () => tabla.deleteRow(),
        borrarCol: () => tabla.deleteColumn(),
        borrarTabla: () => tabla.deleteTable(),
      };
      acciones[b.dataset.tabla]();
      menu.remove();
    });
    const cerrar = (e) => {
      if (!menu.contains(e.target) && e.target !== boton && !boton.contains(e.target)) {
        menu.remove();
        document.removeEventListener("mousedown", cerrar);
      }
    };
    setTimeout(() => document.addEventListener("mousedown", cerrar), 0);
  }

  /* ------------------------------ Cajas comunes ------------------------------ */

  // Foto de portada: modifica objeto.portada.
  P.cajaPortada = function (cont, objeto, { titulo = "Foto de portada", categoria = "Imágenes" } = {}) {
    cont.innerHTML = `<h2>${esc(titulo)}</h2>
      <button class="portada-previa" type="button" aria-label="Elegir ${esc(titulo.toLowerCase())}"></button>
      <div class="fila-botones">
        <button class="boton secundario" type="button" data-elegir>Elegir foto</button>
        <button class="boton discreto" type="button" data-quitar>Quitar</button>
      </div>`;
    const previa = $(".portada-previa", cont);
    const pintar = () => {
      previa.innerHTML = objeto.portada ? `<img src="${esc(objeto.portada.url)}" alt="${esc(titulo)}">` : "Sin foto.<br>Haz clic para elegir una.";
      $("[data-quitar]", cont).hidden = !objeto.portada;
    };
    const elegir = async () => {
      const [file] = await P.elegirArchivos({ accept: "image/*" });
      if (!file) return;
      previa.textContent = "Subiendo foto…";
      try {
        const rec = await P.subirUno(file, { clase: "imagen", visible: false, categoria, titulo });
        objeto.portada = { url: rec.url, id: rec.id };
      } catch (e) {
        G.toast(e.message, "error");
      }
      pintar();
    };
    previa.addEventListener("click", elegir);
    $("[data-elegir]", cont).addEventListener("click", elegir);
    $("[data-quitar]", cont).addEventListener("click", () => {
      objeto.portada = null;
      pintar();
    });
    pintar();
  };

  // Documentos adjuntos: modifica objeto.adjuntos.
  P.cajaAdjuntos = function (cont, objeto, { titulo = "Documentos adjuntos" } = {}) {
    const docs = P.st.archivos.filter((f) => f.clase === "documento" && !f.revision);
    cont.innerHTML = `<h2>${esc(titulo)}</h2>
      <div class="adjuntos-editor"></div>
      <button class="boton secundario" type="button" data-subir>Subir archivo</button>
      ${
        docs.length
          ? `<div class="campo"><label for="adj-existente">O elegir de Documentos</label>
        <select id="adj-existente"><option value="">Selecciona un documento</option>${docs.map((f) => `<option value="${esc(f.id)}">${esc(f.categoria)}: ${esc(f.titulo)}</option>`).join("")}</select></div>`
          : ""
      }`;
    const lista = $(".adjuntos-editor", cont);
    const pintar = () => {
      lista.innerHTML = objeto.adjuntos.length
        ? objeto.adjuntos
            .map((a, i) => {
              const ext = (a.url.match(/\.([a-z0-9]{1,5})$/i) || [, ""])[1] || "doc";
              return `<div class="adjunto-fila"><span class="tipo-archivo" data-familia="${G.familia(ext)}">${esc(ext.slice(0, 4))}</span><div><strong>${esc(a.titulo)}</strong><small>${esc(G.tamano(a.tamano))}</small></div><button class="mini quitar" type="button" data-quitar-adjunto="${i}" aria-label="Quitar ${esc(a.titulo)}">${P.ICONO.quitar}</button></div>`;
            })
            .join("")
        : '<p class="nota">Sin documentos adjuntos.</p>';
    };
    lista.addEventListener("click", (e) => {
      const b = e.target.closest("[data-quitar-adjunto]");
      if (b) {
        objeto.adjuntos.splice(Number(b.dataset.quitarAdjunto), 1);
        pintar();
      }
    });
    $("[data-subir]", cont).addEventListener("click", async () => {
      const files = await P.elegirArchivos({ multiple: true });
      if (!files.length) return;
      G.toast("Subiendo archivos…");
      const recs = await P.subirVarios(files, { clase: "medio", visible: false, categoria: "Adjuntos" }, null);
      recs.forEach((r) => objeto.adjuntos.push({ id: r.id, url: r.url, titulo: r.titulo, tipo: r.tipo, tamano: r.tamano }));
      pintar();
    });
    const sel = $("#adj-existente", cont);
    if (sel)
      sel.addEventListener("change", () => {
        const f = P.st.archivos.find((x) => x.id === sel.value);
        if (f && !objeto.adjuntos.some((a) => a.url === f.url)) objeto.adjuntos.push({ id: f.id, url: f.url, titulo: f.titulo, tipo: f.tipo, tamano: f.tamano });
        sel.value = "";
        pintar();
      });
    pintar();
  };

  // Galería de fotos: modifica objeto.galeria.
  P.cajaGaleria = function (cont, objeto) {
    cont.innerHTML = `<h2>Galería de fotos</h2>
      <div class="zona-subida" tabindex="0" role="button" aria-label="Agregar fotos a la galería">
        ${P.ICONO.subir}
        <strong>Arrastra fotos aquí o haz clic para elegirlas</strong>
        <span>Puedes elegir varias a la vez. Se reducen automáticamente para que carguen rápido.</span>
      </div>
      <div class="cola"></div>
      <div class="galeria-editor"></div>`;
    const rejilla = $(".galeria-editor", cont);
    const pintar = () => {
      rejilla.innerHTML = objeto.galeria
        .map(
          (g, i) => `<div class="foto-editor">
          <img src="${esc(g.url)}" alt="">
          <label class="visualmente-oculto" for="pie-${i}">Pie de foto ${i + 1}</label>
          <input type="text" id="pie-${i}" data-pie="${i}" placeholder="Pie de foto (opcional)" value="${esc(g.pie || "")}" maxlength="200">
          <div class="acciones-fila">
            <button class="boton secundario" type="button" data-mover-foto="${i}" data-dir="-1" ${i === 0 ? "disabled" : ""}>Antes</button>
            <button class="boton secundario" type="button" data-mover-foto="${i}" data-dir="1" ${i === objeto.galeria.length - 1 ? "disabled" : ""}>Después</button>
            <button class="boton peligro" type="button" data-quitar-foto="${i}" aria-label="Quitar foto ${i + 1}">Quitar</button>
          </div></div>`
        )
        .join("");
    };
    rejilla.addEventListener("input", (e) => {
      const i = e.target.dataset.pie;
      if (i !== undefined) objeto.galeria[Number(i)].pie = e.target.value;
    });
    rejilla.addEventListener("click", (e) => {
      const mover = e.target.closest("[data-mover-foto]");
      const quitar = e.target.closest("[data-quitar-foto]");
      if (mover) {
        const i = Number(mover.dataset.moverFoto);
        const j = i + Number(mover.dataset.dir);
        [objeto.galeria[i], objeto.galeria[j]] = [objeto.galeria[j], objeto.galeria[i]];
        pintar();
      }
      if (quitar) {
        objeto.galeria.splice(Number(quitar.dataset.quitarFoto), 1);
        pintar();
      }
    });
    const agregar = async (files) => {
      const imagenes = files.filter((f) => /^image\//.test(f.type));
      if (imagenes.length < files.length) G.toast("Solo se agregan imágenes a la galería.", "error");
      const recs = await P.subirVarios(imagenes, { clase: "imagen", visible: false, categoria: "Imágenes", titulo: "Foto de galería" }, $(".cola", cont));
      recs.forEach((r) => objeto.galeria.push({ url: r.url, id: r.id, pie: "" }));
      pintar();
    };
    P.prepararZona($(".zona-subida", cont), agregar, async () => agregar(await P.elegirArchivos({ accept: "image/*", multiple: true })));
    pintar();
  };
})(window.Panel);
