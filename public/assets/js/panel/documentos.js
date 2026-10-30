/* Panel El Guineo: documentos organizados en carpetas, con aprobación. */
(function (P) {
  "use strict";
  const { G, esc, $, $$ } = P;
  const TODAS = "__todas";
  const REVISION = "__revision";
  const MEDIOS = "__medios";
  const estado = { carpeta: TODAS, texto: "", editando: null };

  const documentos = () => P.st.archivos.filter((f) => f.clase === "documento");

  function enCarpeta(f) {
    if (estado.carpeta === MEDIOS) return f.clase !== "documento";
    if (f.clase !== "documento") return false;
    if (estado.carpeta === TODAS) return true;
    if (estado.carpeta === REVISION) return f.revision;
    return f.categoria === estado.carpeta;
  }

  P.ruta("documentos", function () {
    P.titulo("Documentos");
    const publica = P.puede("publicar");
    const carpetas = P.carpetas();
    if (![TODAS, REVISION, MEDIOS, ...carpetas].includes(estado.carpeta)) estado.carpeta = TODAS;
    const docs = documentos();
    const cuenta = (c) => docs.filter((f) => f.categoria === c).length;
    const enRevision = docs.filter((f) => f.revision && (publica || P.esMio(f))).length;
    const fueraDeCarpeta = Array.from(new Set(docs.map((f) => f.categoria).filter((c) => !carpetas.includes(c))));

    const boton = (valor, texto, n, icono) =>
      `<button type="button" class="carpeta-boton" data-carpeta="${esc(valor)}" aria-current="${estado.carpeta === valor}">${icono}<span>${esc(texto)}</span>${
        n !== undefined ? `<span class="carpeta-n">${n}</span>` : ""
      }</button>`;

    P.vista.innerHTML = `
      <div class="vista-cabeza"><div><h1>Documentos</h1><p>${
        publica
          ? "Organiza los documentos en carpetas. Lo que subas aparece en la página Documentos del sitio, agrupado por carpeta. Archivos de hasta 18 MB."
          : "Sube documentos para el sitio. Quedan en revisión hasta que un editor o administrador los apruebe."
      }</p></div></div>
      <div class="gestor">
        <nav class="carpetas-lista" aria-label="Carpetas">
          ${boton(TODAS, "Todos los documentos", docs.length, P.ICONO.todos)}
          ${carpetas.map((c) => boton(c, c, cuenta(c), P.ICONO.carpeta)).join("")}
          ${fueraDeCarpeta.map((c) => boton(c, c, cuenta(c), P.ICONO.carpeta)).join("")}
          ${enRevision || !publica ? boton(REVISION, publica ? "En revisión" : "Mis documentos en revisión", enRevision, P.ICONO.reloj) : ""}
          ${boton(MEDIOS, "Fotos y adjuntos", P.st.archivos.filter((f) => f.clase !== "documento").length, P.ICONO.foto)}
          ${P.puede("carpetas") ? `<button type="button" class="boton secundario nueva-carpeta" id="nueva-carpeta">Nueva carpeta</button>` : ""}
        </nav>
        <section class="gestor-contenido" id="gestor-contenido"></section>
      </div>`;

    $$("[data-carpeta]").forEach((b) =>
      b.addEventListener("click", () => {
        estado.carpeta = b.dataset.carpeta;
        estado.editando = null;
        $$("[data-carpeta]").forEach((x) => x.setAttribute("aria-current", String(x === b)));
        pintarContenido();
      })
    );
    const nueva = $("#nueva-carpeta");
    if (nueva)
      nueva.addEventListener("click", async () => {
        const nombre = await P.pedirTexto("Nueva carpeta", "Nombre de la carpeta", "", "Crear carpeta");
        if (!nombre) return;
        try {
          const lista = await G.carpetas({ accion: "crear", nombre });
          P.st.sitio.documentos.categorias = lista;
          P.st.sitioOriginal = JSON.stringify(P.st.sitio);
          estado.carpeta = nombre;
          G.toast(`Carpeta «${nombre}» creada`);
          P.enrutar();
        } catch (e) {
          G.toast(e.message, "error");
        }
      });
    pintarContenido();
  });

  function pintarContenido() {
    const cont = $("#gestor-contenido");
    if (!cont) return;
    const publica = P.puede("publicar");
    const carpetas = P.carpetas();
    const esCarpeta = ![TODAS, REVISION, MEDIOS].includes(estado.carpeta);
    const titulo = estado.carpeta === TODAS ? "Todos los documentos" : estado.carpeta === REVISION ? "En revisión" : estado.carpeta === MEDIOS ? "Fotos y adjuntos" : estado.carpeta;
    const subir = estado.carpeta !== MEDIOS && estado.carpeta !== REVISION;
    cont.innerHTML = `
      <div class="gestor-cabeza">
        <h2>${P.ICONO.carpeta}${esc(titulo)}</h2>
        ${
          esCarpeta && P.puede("carpetas")
            ? `<div class="acciones-fila"><button class="boton discreto" type="button" id="renombrar-carpeta">Renombrar</button><button class="boton discreto" type="button" id="borrar-carpeta">Eliminar carpeta</button></div>`
            : ""
        }
      </div>
      ${
        estado.carpeta === MEDIOS
          ? '<p class="nota">Fotos de noticias, imágenes de páginas, audios y archivos adjuntos. No aparecen en la página Documentos.</p>'
          : estado.carpeta === REVISION
          ? `<p class="nota">${publica ? "Documentos que subieron los docentes. Revísalos y apruébalos para publicarlos." : "Tus documentos aparecen en el sitio cuando un editor o administrador los aprueba."}</p>`
          : ""
      }
      ${
        subir
          ? `<div class="caja subida">
        ${
          esCarpeta
            ? `<p class="nota">Los archivos se guardan en la carpeta <strong>${esc(estado.carpeta)}</strong>.</p>`
            : `<div class="campo"><label for="d-carpeta">Carpeta</label><select id="d-carpeta">${carpetas.map((c) => `<option>${esc(c)}</option>`).join("")}</select></div>`
        }
        <div class="zona-subida" id="zona-docs" tabindex="0" role="button" aria-label="Subir documentos">
          ${P.ICONO.subir}
          <strong>Arrastra archivos aquí o haz clic para elegirlos</strong>
          <span>PDF, Word, Excel, PowerPoint, imágenes, audio o video MP4. Puedes elegir varios a la vez.</span>
        </div>
        ${publica ? `<label class="casilla"><input type="checkbox" id="d-visible" checked><span>Mostrar en el sitio apenas se suban</span></label>` : ""}
        <div class="cola" id="cola-docs"></div>
      </div>`
          : ""
      }
      <div class="herramientas">
        <label class="visualmente-oculto" for="buscar-d">Buscar archivos</label>
        <input type="search" id="buscar-d" placeholder="Buscar por nombre" value="${esc(estado.texto)}">
      </div>
      <div id="lista-d"></div>`;

    if (subir) {
      const enviar = async (files) => {
        const carpeta = esCarpeta ? estado.carpeta : $("#d-carpeta").value;
        const recs = await P.subirVarios(files, { clase: "documento", visible: publica ? $("#d-visible").checked : true, categoria: carpeta }, $("#cola-docs"));
        if (recs.length) {
          G.toast(recs.length === 1 ? (recs[0].revision ? "Archivo subido. Queda en revisión." : "Archivo subido") : `${recs.length} archivos subidos`);
          P.contadores();
          setTimeout(() => P.enrutar(), 900);
        }
      };
      P.prepararZona($("#zona-docs"), enviar, async () => enviar(await P.elegirArchivos({ multiple: true })));
    }
    const ren = $("#renombrar-carpeta");
    if (ren)
      ren.addEventListener("click", async () => {
        const nuevo = await P.pedirTexto("Renombrar carpeta", "Nuevo nombre", estado.carpeta, "Renombrar");
        if (!nuevo || nuevo === estado.carpeta) return;
        try {
          P.st.sitio.documentos.categorias = await G.carpetas({ accion: "renombrar", nombre: estado.carpeta, nuevo });
          P.st.sitioOriginal = JSON.stringify(P.st.sitio);
          P.st.archivos.forEach((f) => f.categoria === estado.carpeta && (f.categoria = nuevo));
          estado.carpeta = nuevo;
          G.toast("Carpeta renombrada");
          P.enrutar();
        } catch (e) {
          G.toast(e.message, "error");
        }
      });
    const bor = $("#borrar-carpeta");
    if (bor)
      bor.addEventListener("click", async () => {
        if (!(await P.confirmar("¿Eliminar esta carpeta?", `Se quitará la carpeta «${estado.carpeta}». Solo se puede eliminar si está vacía.`, "Eliminar carpeta"))) return;
        try {
          P.st.sitio.documentos.categorias = await G.carpetas({ accion: "eliminar", nombre: estado.carpeta });
          P.st.sitioOriginal = JSON.stringify(P.st.sitio);
          estado.carpeta = TODAS;
          G.toast("Carpeta eliminada");
          P.enrutar();
        } catch (e) {
          G.toast(e.message, "error");
        }
      });
    $("#buscar-d").addEventListener("input", (e) => {
      estado.texto = e.target.value;
      pintarLista();
    });
    $("#lista-d").addEventListener("click", acciones);
    pintarLista();
  }

  function pintarLista() {
    const cont = $("#lista-d");
    if (!cont) return;
    const publica = P.puede("publicar");
    const q = estado.texto.trim().toLowerCase();
    const lista = P.st.archivos.filter((f) => enCarpeta(f) && (!q || (f.titulo + " " + f.nombre).toLowerCase().includes(q)) && (publica || !f.revision || P.esMio(f)));
    if (!lista.length) {
      cont.innerHTML = `<div class="archivos-lista"><div class="vacio-panel"><strong>${q ? "Ningún archivo coincide" : "Esta carpeta está vacía"}</strong>${
        q ? "Prueba con otra palabra." : estado.carpeta === MEDIOS ? "Aparecen aquí cuando agregas fotos o adjuntos a una noticia o página." : "Arrastra archivos a la zona de arriba para subirlos."
      }</div></div>`;
      return;
    }
    const carpetas = P.carpetas();
    cont.innerHTML = `<div class="archivos-lista">${lista
      .map((f) => {
        const usos = f.clase === "documento" ? [] : P.usosDeArchivo(f.url);
        const detalle = [
          estado.carpeta === TODAS || estado.carpeta === REVISION ? f.categoria : "",
          f.clase !== "documento" ? (usos.length ? "Usado en " + usos.join(", ") : "Sin usar") : "",
          G.tamano(f.tamano),
          f.creado ? P.fecha(f.creado.slice(0, 10), true) : "",
          f.autorNombre ? "subido por " + f.autorNombre : "",
        ]
          .filter(Boolean)
          .join(", ");
        const editable = P.puedeEditarArchivo(f);
        const etiquetas = `${f.revision ? '<span class="estado revision">En revisión</span>' : ""}${f.clase === "documento" && f.visible === false ? '<span class="estado oculto">Oculto</span>' : ""}`;
        const fila = `<div class="archivo-fila">
          ${P.tipoArchivoHtml(f)}
          <div><h3>${esc(f.titulo)} ${etiquetas}</h3><p>${esc(detalle)}</p>${f.descripcion ? `<p>${esc(f.descripcion)}</p>` : ""}</div>
          <div class="acciones-fila">
            ${f.revision && publica ? `<button class="boton" type="button" data-aprobar="${esc(f.id)}">Aprobar</button>` : ""}
            <a class="boton discreto" href="${esc(f.url)}" target="_blank" rel="noopener">Ver</a>
            ${f.url.startsWith("data:") ? "" : `<button class="boton discreto" type="button" data-copiar-archivo="${esc(f.id)}">Copiar enlace</button>`}
            ${editable ? `<button class="boton discreto" type="button" data-editar-archivo="${esc(f.id)}" aria-expanded="${estado.editando === f.id}">Editar</button>` : ""}
            ${editable ? `<button class="boton discreto" type="button" data-borrar-archivo="${esc(f.id)}">Eliminar</button>` : ""}
          </div>
        </div>`;
        const edicion =
          estado.editando === f.id
            ? `<form class="archivo-edicion" data-form-archivo="${esc(f.id)}">
            <div class="campo"><label for="ea-titulo">Título</label><input type="text" id="ea-titulo" name="titulo" value="${esc(f.titulo)}" maxlength="160" required></div>
            ${
              f.clase === "documento"
                ? `<div class="campo"><label for="ea-cat">Carpeta</label><select id="ea-cat" name="categoria">${Array.from(new Set([...carpetas, f.categoria]))
                    .map((c) => `<option ${c === f.categoria ? "selected" : ""}>${esc(c)}</option>`)
                    .join("")}</select></div>
            <div class="campo ancho"><label for="ea-desc">Descripción (opcional)</label><textarea id="ea-desc" name="descripcion" rows="3" maxlength="1000" placeholder="Para qué sirve este documento, a quién va dirigido, fechas importantes…">${esc(f.descripcion || "")}</textarea></div>
            ${publica ? `<label class="casilla ancho"><input type="checkbox" name="visible" ${f.visible !== false ? "checked" : ""}><span>Visible en la página Documentos del sitio</span></label>` : ""}`
                : ""
            }
            <div class="acciones-fila ancho"><button class="boton" type="submit">Guardar</button><button class="boton secundario" type="button" data-cancelar-edicion>Cancelar</button></div>
          </form>`
            : "";
        return fila + edicion;
      })
      .join("")}</div>`;
    const form = $("[data-form-archivo]", cont);
    if (form) {
      $("input[name=titulo]", form).focus();
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const fd = new FormData(form);
        const f = P.st.archivos.find((x) => x.id === form.dataset.formArchivo);
        const datos = { titulo: fd.get("titulo") };
        if (fd.has("categoria")) datos.categoria = fd.get("categoria");
        if (fd.has("descripcion")) datos.descripcion = fd.get("descripcion");
        const vis = form.querySelector("input[name=visible]");
        if (vis) datos.visible = vis.checked;
        try {
          Object.assign(f, await G.actualizarArchivo(f.id, datos));
          estado.editando = null;
          G.toast("Cambios guardados");
          P.enrutar();
        } catch (ex) {
          G.toast(ex.message, "error");
        }
      });
    }
  }

  async function acciones(e) {
    const t = e.target;
    if (t.closest("[data-cancelar-edicion]")) {
      estado.editando = null;
      return pintarLista();
    }
    const ed = t.closest("[data-editar-archivo]");
    if (ed) {
      estado.editando = estado.editando === ed.dataset.editarArchivo ? null : ed.dataset.editarArchivo;
      return pintarLista();
    }
    const co = t.closest("[data-copiar-archivo]");
    if (co) {
      const f = P.st.archivos.find((x) => x.id === co.dataset.copiarArchivo);
      return f && P.copiar(P.enlaceAbsoluto(f.url));
    }
    const ap = t.closest("[data-aprobar]");
    if (ap) {
      const f = P.st.archivos.find((x) => x.id === ap.dataset.aprobar);
      try {
        Object.assign(f, await G.actualizarArchivo(f.id, { revision: false }));
        G.toast(`«${f.titulo}» aprobado y publicado`);
        P.contadores();
        P.enrutar();
      } catch (ex) {
        G.toast(ex.message, "error");
      }
      return;
    }
    const bo = t.closest("[data-borrar-archivo]");
    if (bo) {
      const f = P.st.archivos.find((x) => x.id === bo.dataset.borrarArchivo);
      if (!f) return;
      const usos = P.usosDeArchivo(f.url);
      const texto = usos.length
        ? `«${f.titulo}» se usa en ${usos.join(", ")}. Si lo eliminas, dejará de verse allí. Esta acción no se puede deshacer.`
        : `Se borrará «${f.titulo}» del sitio. Esta acción no se puede deshacer.`;
      if (!(await P.confirmar("¿Eliminar este archivo?", texto, "Eliminar archivo"))) return;
      try {
        await G.eliminarArchivo(f.id);
        P.st.archivos = P.st.archivos.filter((x) => x.id !== f.id);
        G.toast("Archivo eliminado");
        P.contadores();
        P.enrutar();
      } catch (ex) {
        G.toast(ex.message, "error");
      }
    }
  }

  // Aprobar desde el Resumen.
  P.aprobarDocumento = async function (id) {
    const f = P.st.archivos.find((x) => x.id === id);
    if (!f) return;
    Object.assign(f, await G.actualizarArchivo(f.id, { revision: false }));
    P.contadores();
    return f;
  };
})(window.Panel);
