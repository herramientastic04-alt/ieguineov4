/* Panel El Guineo: noticias (lista, editor y revisión). */
(function (P) {
  "use strict";
  const { G, esc, $, $$ } = P;
  const filtro = { texto: "", estado: "" };

  /* --------------------------------- Lista --------------------------------- */
  P.tablaNoticias = function (lista, { conFiltro = false } = {}) {
    if (!lista.length) {
      const hay = P.st.noticias.length;
      return `<div class="tabla-contenedor"><div class="vacio-panel"><strong>${conFiltro && hay ? "Ninguna noticia coincide" : "Aún no hay noticias"}</strong>${
        conFiltro && hay ? "Prueba con otra búsqueda o estado." : "Escribe la primera para que aparezca en la portada del sitio."
      }${!hay ? '<br><a class="boton" href="#nueva">Escribir una noticia</a>' : ""}</div></div>`;
    }
    return `<div class="tabla-contenedor"><table class="tabla">
      <thead><tr><th scope="col">Título</th><th scope="col">Autor</th><th scope="col">Fecha</th><th scope="col">Estado</th><th scope="col"><span class="visualmente-oculto">Acciones</span></th></tr></thead>
      <tbody>${lista
        .map((n) => {
          const [clase, texto] = P.estadoNoticia(n);
          const editable = P.puedeEditarNoticia(n);
          const revisar = n.estado === "revision" && P.puede("publicar");
          return `<tr>
          <td class="titulo-celda">${editable ? `<a href="#editar-${esc(n.id)}">${esc(n.titulo)}</a>` : `<span>${esc(n.titulo)}</span>`}<small>${esc(n.categoria)}${n.destacada ? ", destacada en el inicio" : ""}</small></td>
          <td class="autor-celda">${esc(n.autorNombre || n.autor || "")}</td>
          <td class="fecha-celda">${esc(P.fecha(n.fecha, true))}</td>
          <td><span class="estado ${clase}">${texto}</span></td>
          <td class="acciones-celda">
            ${revisar ? `<a class="boton secundario" href="#editar-${esc(n.id)}">Revisar</a>` : editable ? `<a class="boton discreto" href="#editar-${esc(n.id)}">Editar</a>` : ""}
            <a class="boton discreto" href="./#noticia-${esc(n.id)}" target="_blank" rel="noopener">Ver</a>
            ${editable ? `<button class="boton discreto" type="button" data-borrar-noticia="${esc(n.id)}">Eliminar</button>` : ""}
          </td></tr>`;
        })
        .join("")}</tbody></table></div>`;
  };

  P.enlazarTablaNoticias = function () {
    $$("[data-borrar-noticia]", P.vista).forEach((b) =>
      b.addEventListener("click", async () => {
        const n = P.st.noticias.find((x) => x.id === b.dataset.borrarNoticia);
        if (!n) return;
        if (!(await P.confirmar("¿Eliminar esta noticia?", `Se borrará «${n.titulo}» junto con sus fotos. Esta acción no se puede deshacer.`, "Eliminar noticia"))) return;
        try {
          await G.eliminarNoticia(n.id);
          P.st.noticias = P.st.noticias.filter((x) => x.id !== n.id);
          P.st.archivos = await G.archivos(true).catch(() => P.st.archivos);
          G.toast("Noticia eliminada");
          P.contadores();
          P.enrutar();
        } catch (e) {
          G.toast(e.message, "error");
        }
      })
    );
  };

  P.ruta("noticias", function () {
    P.titulo("Noticias");
    const docente = !P.puede("publicar");
    P.vista.innerHTML = `
      <div class="vista-cabeza">
        <div><h1>Noticias</h1><p>${
          docente
            ? "Escribe noticias de tus clases y proyectos. Cuando las envíes, un editor o administrador las revisa y las publica."
            : "Publica eventos, comunicados y logros. Las noticias con fecha futura se publican solas ese día."
        }</p></div>
        <a class="boton rojo" href="#nueva">Nueva noticia</a>
      </div>
      <div class="herramientas">
        <label class="visualmente-oculto" for="buscar-n">Buscar noticias</label>
        <input type="search" id="buscar-n" placeholder="Buscar por título o autor" value="${esc(filtro.texto)}">
        <label class="visualmente-oculto" for="estado-n">Estado</label>
        <select id="estado-n">
          <option value="">Todos los estados</option>
          <option value="publicada">Publicadas</option>
          <option value="revision">En revisión</option>
          <option value="programada">Programadas</option>
          <option value="borrador">Borradores</option>
          <option value="mias">Solo las mías</option>
        </select>
      </div>
      <div id="tabla-n"></div>`;
    $("#estado-n").value = filtro.estado;
    const pintar = () => {
      const q = filtro.texto.trim().toLowerCase();
      const lista = P.st.noticias.filter((n) => {
        if (q && !(n.titulo + " " + (n.autorNombre || "")).toLowerCase().includes(q)) return false;
        if (filtro.estado === "mias") return P.esMio(n);
        if (n.estado === "borrador" && !P.esMio(n) && !P.puede("editarTodo")) return false;
        return !filtro.estado || P.estadoNoticia(n)[0] === filtro.estado;
      });
      $("#tabla-n").innerHTML = P.tablaNoticias(lista, { conFiltro: true });
      P.enlazarTablaNoticias();
    };
    $("#buscar-n").addEventListener("input", (e) => {
      filtro.texto = e.target.value;
      pintar();
    });
    $("#estado-n").addEventListener("change", (e) => {
      filtro.estado = e.target.value;
      pintar();
    });
    pintar();
  });

  /* --------------------------------- Editor --------------------------------- */
  function editor(id) {
    const original = id ? P.st.noticias.find((n) => n.id === id) : null;
    if (id && !original) {
      P.vista.innerHTML = `<a class="volver" href="#noticias">Volver a noticias</a><div class="vacio-panel"><strong>Esta noticia ya no existe</strong>Puede que la hayan eliminado.</div>`;
      return;
    }
    if (original && !P.puedeEditarNoticia(original)) {
      P.vista.innerHTML = `<a class="volver" href="#noticias">Volver a noticias</a><div class="vacio-panel"><strong>No puedes editar esta noticia</strong>Solo puedes editar tus propias noticias mientras no estén publicadas.<br><a class="boton secundario" href="./#noticia-${esc(original.id)}" target="_blank" rel="noopener">Verla en el sitio</a></div>`;
      return;
    }
    const publica = P.puede("publicar");
    const cats = P.categoriasNoticias();
    const n = original
      ? structuredClone(original)
      : { titulo: "", resumen: "", cuerpo: "", categoria: cats[0] || "Noticias", fecha: P.hoy(), estado: publica ? "publicada" : "revision", destacada: false, portada: null, galeria: [], adjuntos: [] };
    if (!publica && n.estado === "publicada") n.estado = "revision";
    const enRevisionAjena = original && original.estado === "revision" && !P.esMio(original) && publica;
    P.titulo(original ? "Editar noticia" : "Nueva noticia");

    const opcionesEstado = publica
      ? [
          ["publicada", "Publicada", "Visible en el sitio desde la fecha indicada"],
          ["revision", "En revisión", "Esperando aprobación"],
          ["borrador", "Borrador", "Solo se ve en el panel"],
        ]
      : [
          ["revision", "Enviar a revisión", "Un editor o administrador la revisa y la publica"],
          ["borrador", "Borrador", "Guárdala para seguir después"],
        ];

    P.vista.innerHTML = `
      <a class="volver" href="#noticias">Volver a noticias</a>
      <div class="vista-cabeza"><div><h1>${original ? "Editar noticia" : "Nueva noticia"}</h1>${
        original ? `<p>Escrita por ${esc(original.autorNombre || original.autor)}${original.editadaPor ? `, última edición de ${esc(original.editadaPor)}` : ""}.</p>` : ""
      }</div>
        ${original ? `<a class="boton secundario" href="./#noticia-${esc(original.id)}" target="_blank" rel="noopener">${original.estado === "publicada" ? "Ver en el sitio" : "Vista previa"}</a>` : ""}
      </div>
      ${enRevisionAjena ? `<div class="aviso-panel alerta" style="margin-bottom:1.25rem"><p><strong>${esc(original.autorNombre || original.autor)} envió esta noticia a revisión.</strong> Revisa el texto y las fotos; luego elige Publicada y guarda para aprobarla.</p></div>` : ""}
      <div class="editor">
        <div class="editor-principal">
          <div class="campo">
            <label for="n-titulo">Título</label>
            <input type="text" id="n-titulo" class="input-titulo" maxlength="200" value="${esc(n.titulo)}" placeholder="Escribe un título claro">
          </div>
          <div class="campo">
            <label for="n-resumen">Resumen</label>
            <textarea id="n-resumen" rows="3" maxlength="600" placeholder="Una o dos frases que cuenten lo esencial">${esc(n.resumen)}</textarea>
            <span class="ayuda">Aparece en la lista de noticias y cuando alguien comparte la noticia por WhatsApp o Facebook.</span>
          </div>
          <div class="campo">
            <span class="etiqueta" id="n-cuerpo-etiqueta">Contenido</span>
            <div class="editor-texto"><div id="n-cuerpo" aria-labelledby="n-cuerpo-etiqueta"></div></div>
            <span class="ayuda">Puedes poner títulos, listas, colores, tablas, enlaces, fotos dentro del texto y videos de YouTube.</span>
          </div>
          <div class="caja" id="n-galeria"></div>
        </div>
        <aside class="editor-lateral">
          <div class="caja">
            <h2>Publicación</h2>
            <div class="opciones-estado" role="radiogroup" aria-label="Estado">
              ${opcionesEstado
                .map(([v, t, d]) => `<label class="opcion"><input type="radio" name="n-estado" value="${v}" ${n.estado === v ? "checked" : ""}><span>${t}<small>${d}</small></span></label>`)
                .join("")}
            </div>
            <div class="campo"><label for="n-fecha">Fecha</label><input type="date" id="n-fecha" value="${esc(n.fecha)}"></div>
            <div class="campo">
              <label for="n-categoria">Categoría</label>
              <select id="n-categoria">${cats.map((c) => `<option ${c === n.categoria ? "selected" : ""}>${esc(c)}</option>`).join("")}${
      cats.includes(n.categoria) ? "" : `<option selected>${esc(n.categoria)}</option>`
    }<option value="__otra">Otra categoría…</option></select>
              <input type="text" id="n-categoria-otra" placeholder="Nombre de la categoría" maxlength="60" hidden>
            </div>
            ${publica ? `<label class="casilla"><input type="checkbox" id="n-destacada" ${n.destacada ? "checked" : ""}><span>Destacar en el inicio del sitio</span></label>` : ""}
            <div class="fila-botones"><button class="boton" type="button" id="n-guardar"></button></div>
          </div>
          <div class="caja" id="n-portada"></div>
          <div class="caja" id="n-adjuntos"></div>
        </aside>
      </div>`;

    const texto = P.crearEditorTexto("#n-cuerpo", { placeholder: "Escribe aquí el contenido de la noticia…", inicial: n.cuerpo });
    P.cajaGaleria($("#n-galeria"), n);
    P.cajaPortada($("#n-portada"), n, { titulo: "Foto de portada" });
    P.cajaAdjuntos($("#n-adjuntos"), n);

    const recoger = () => {
      const sel = $("#n-categoria").value;
      return {
        titulo: $("#n-titulo").value.trim(),
        resumen: $("#n-resumen").value.trim(),
        cuerpo: texto.html(),
        categoria: sel === "__otra" ? $("#n-categoria-otra").value.trim() || "Noticias" : sel,
        fecha: $("#n-fecha").value || P.hoy(),
        estado: ($('input[name="n-estado"]:checked') || {}).value || "revision",
        destacada: publica ? $("#n-destacada").checked : Boolean(n.destacada),
        portada: n.portada,
        galeria: n.galeria,
        adjuntos: n.adjuntos,
      };
    };
    let base = JSON.stringify(recoger());
    P.guardia = { ruta: location.hash.slice(1), sucio: () => JSON.stringify(recoger()) !== base };

    const boton = $("#n-guardar");
    const etiqueta = () => {
      const e = ($('input[name="n-estado"]:checked') || {}).value;
      boton.textContent =
        e === "borrador" ? "Guardar borrador" : e === "revision" ? (publica ? "Guardar en revisión" : "Enviar a revisión") : enRevisionAjena ? "Aprobar y publicar" : original && original.estado === "publicada" ? "Guardar cambios" : "Publicar noticia";
    };
    etiqueta();
    $$('input[name="n-estado"]').forEach((r) => r.addEventListener("change", etiqueta));
    $("#n-categoria").addEventListener("change", (e) => {
      const otra = $("#n-categoria-otra");
      otra.hidden = e.target.value !== "__otra";
      if (!otra.hidden) otra.focus();
    });

    boton.addEventListener("click", async () => {
      const datos = recoger();
      if (!datos.titulo) {
        G.toast("Escribe un título para la noticia.", "error");
        $("#n-titulo").focus();
        return;
      }
      boton.disabled = true;
      const textoBoton = boton.textContent;
      boton.textContent = "Guardando…";
      try {
        if (datos.destacada) {
          for (const otra of P.st.noticias.filter((x) => x.destacada && x.id !== (original && original.id))) {
            Object.assign(otra, await G.actualizarNoticia(otra.id, { ...otra, destacada: false }));
          }
        }
        const guardada = original ? await G.actualizarNoticia(original.id, datos) : await G.crearNoticia(datos);
        const i = P.st.noticias.findIndex((x) => x.id === guardada.id);
        if (i >= 0) P.st.noticias[i] = guardada;
        else P.st.noticias.unshift(guardada);
        P.st.noticias.sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
        base = JSON.stringify(recoger());
        P.guardia = null;
        P.contadores();
        G.toast(
          guardada.estado === "borrador"
            ? "Borrador guardado"
            : guardada.estado === "revision"
            ? publica
              ? "Guardada en revisión"
              : "Enviada a revisión. Te avisaremos en el panel cuando la publiquen."
            : enRevisionAjena
            ? "Noticia aprobada y publicada"
            : original
            ? "Cambios guardados"
            : "Noticia publicada"
        );
        if (!P.puedeEditarNoticia(guardada)) P.irA("noticias");
        else if (!original) location.hash = "#editar-" + guardada.id;
        else P.enrutar();
      } catch (e) {
        G.toast(e.message, "error");
        boton.disabled = false;
        boton.textContent = textoBoton;
      }
    });
    if (!original) $("#n-titulo").focus();
  }

  P.ruta("nueva", () => editor(null));
  P.rutaConParametro("editar-", editor);
})(window.Panel);
