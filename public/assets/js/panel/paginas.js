/* Panel El Guineo: páginas libres (Matrículas, Horarios, PAE, Egresados…). */
(function (P) {
  "use strict";
  const { G, esc, $, $$ } = P;
  const MENU = { principal: "Menú principal", pie: "Pie de página", ninguno: "Sin menú (solo con enlace)" };

  P.ruta("paginas", function () {
    P.titulo("Páginas");
    const lista = P.st.paginas.slice().sort((a, b) => (a.orden ?? 99) - (b.orden ?? 99) || a.titulo.localeCompare(b.titulo));
    P.vista.innerHTML = `
      <div class="vista-cabeza">
        <div><h1>Páginas</h1><p>Crea páginas para cualquier información: matrículas, horarios, uniformes, PAE, egresados, convivencia. Aparecen en el menú del sitio en el orden que elijas.</p></div>
        <a class="boton rojo" href="#pagina-nueva">Nueva página</a>
      </div>
      ${
        lista.length
          ? `<div class="tabla-contenedor"><table class="tabla">
        <thead><tr><th scope="col">Título</th><th scope="col">Ubicación</th><th scope="col">Orden</th><th scope="col">Estado</th><th scope="col"><span class="visualmente-oculto">Acciones</span></th></tr></thead>
        <tbody>${lista
          .map(
            (p) => `<tr>
            <td class="titulo-celda"><a href="#pagina-editar-${esc(p.id)}">${esc(p.titulo)}</a><small>#pagina-${esc(p.slug)}</small></td>
            <td>${esc(MENU[p.menu] || MENU.principal)}</td>
            <td class="fecha-celda">${esc(p.orden ?? "")}</td>
            <td><span class="estado ${p.estado === "borrador" ? "borrador" : "publicada"}">${p.estado === "borrador" ? "Borrador" : "Publicada"}</span></td>
            <td class="acciones-celda">
              <a class="boton discreto" href="#pagina-editar-${esc(p.id)}">Editar</a>
              <a class="boton discreto" href="./#pagina-${esc(p.slug)}" target="_blank" rel="noopener">Ver</a>
              <button class="boton discreto" type="button" data-borrar-pagina="${esc(p.id)}">Eliminar</button>
            </td></tr>`
          )
          .join("")}</tbody></table></div>`
          : `<div class="tabla-contenedor"><div class="vacio-panel"><strong>Aún no hay páginas</strong>Crea la primera, por ejemplo «Matrículas» o «Horarios», con texto, tablas, fotos y documentos.<br><a class="boton" href="#pagina-nueva">Crear una página</a></div></div>`
      }`;
    $$("[data-borrar-pagina]").forEach((b) =>
      b.addEventListener("click", async () => {
        const p = P.st.paginas.find((x) => x.id === b.dataset.borrarPagina);
        if (!p || !(await P.confirmar("¿Eliminar esta página?", `Se borrará «${p.titulo}» y saldrá del menú del sitio. Esta acción no se puede deshacer.`, "Eliminar página"))) return;
        try {
          await G.eliminarPagina(p.id);
          P.st.paginas = P.st.paginas.filter((x) => x.id !== p.id);
          G.toast("Página eliminada");
          P.enrutar();
        } catch (e) {
          G.toast(e.message, "error");
        }
      })
    );
  });

  function editor(id) {
    const original = id ? P.st.paginas.find((p) => p.id === id) : null;
    if (id && !original) {
      P.vista.innerHTML = `<a class="volver" href="#paginas">Volver a páginas</a><div class="vacio-panel"><strong>Esta página ya no existe</strong>Puede que la hayan eliminado.</div>`;
      return;
    }
    const maxOrden = Math.max(0, ...P.st.paginas.map((p) => Number(p.orden) || 0));
    const p = original ? structuredClone(original) : { titulo: "", slug: "", resumen: "", cuerpo: "", portada: null, adjuntos: [], menu: "principal", orden: maxOrden + 1, estado: "publicada" };
    P.titulo(original ? "Editar página" : "Nueva página");
    P.vista.innerHTML = `
      <a class="volver" href="#paginas">Volver a páginas</a>
      <div class="vista-cabeza"><div><h1>${original ? "Editar página" : "Nueva página"}</h1>${
        original ? `<p>Creada por ${esc(original.autorNombre || original.autor)}${original.editadaPor ? `, última edición de ${esc(original.editadaPor)}` : ""}.</p>` : ""
      }</div>
        ${original ? `<a class="boton secundario" href="./#pagina-${esc(original.slug)}" target="_blank" rel="noopener">${original.estado === "publicada" ? "Ver en el sitio" : "Vista previa"}</a>` : ""}
      </div>
      <div class="editor">
        <div class="editor-principal">
          <div class="campo">
            <label for="p-titulo">Título</label>
            <input type="text" id="p-titulo" class="input-titulo" maxlength="160" value="${esc(p.titulo)}" placeholder="Por ejemplo: Matrículas 2027">
          </div>
          <div class="campo">
            <label for="p-resumen">Introducción</label>
            <textarea id="p-resumen" rows="2" maxlength="500" placeholder="Una frase que explique de qué trata la página">${esc(p.resumen)}</textarea>
          </div>
          <div class="campo">
            <span class="etiqueta" id="p-cuerpo-etiqueta">Contenido</span>
            <div class="editor-texto"><div id="p-cuerpo" aria-labelledby="p-cuerpo-etiqueta"></div></div>
            <span class="ayuda">Usa el botón de tabla para horarios, listas de útiles o requisitos. Puedes pegar texto desde Word.</span>
          </div>
        </div>
        <aside class="editor-lateral">
          <div class="caja">
            <h2>Publicación</h2>
            <div class="opciones-estado" role="radiogroup" aria-label="Estado">
              <label class="opcion"><input type="radio" name="p-estado" value="publicada" ${p.estado !== "borrador" ? "checked" : ""}><span>Publicada<small>Visible en el sitio</small></span></label>
              <label class="opcion"><input type="radio" name="p-estado" value="borrador" ${p.estado === "borrador" ? "checked" : ""}><span>Borrador<small>Solo se ve en el panel</small></span></label>
            </div>
            <div class="campo">
              <label for="p-menu">Dónde aparece</label>
              <select id="p-menu">${Object.entries(MENU).map(([v, t]) => `<option value="${v}" ${p.menu === v ? "selected" : ""}>${t}</option>`).join("")}</select>
              <span class="ayuda">Con más de dos páginas en el menú principal, se agrupan en «Más».</span>
            </div>
            <div class="dos-columnas">
              <div class="campo"><label for="p-orden">Orden</label><input type="number" id="p-orden" min="0" max="99" value="${esc(p.orden)}" style="min-height:2.75rem"></div>
              <div class="campo"><label for="p-slug">Dirección</label><input type="text" id="p-slug" value="${esc(p.slug)}" placeholder="se crea sola" maxlength="60"></div>
            </div>
            <span class="ayuda" id="p-direccion"></span>
            <div class="fila-botones"><button class="boton" type="button" id="p-guardar"></button></div>
          </div>
          <div class="caja" id="p-portada"></div>
          <div class="caja" id="p-adjuntos"></div>
        </aside>
      </div>`;

    const texto = P.crearEditorTexto("#p-cuerpo", { placeholder: "Escribe aquí el contenido de la página…", inicial: p.cuerpo });
    P.cajaPortada($("#p-portada"), p, { titulo: "Imagen de cabecera" });
    P.cajaAdjuntos($("#p-adjuntos"), p, { titulo: "Documentos de la página" });

    const direccion = () => {
      const s = $("#p-slug").value.trim() || $("#p-titulo").value.trim();
      const slug = s
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      $("#p-direccion").textContent = slug ? `Enlace: ${location.origin}/#pagina-${slug}` : "";
    };
    $("#p-titulo").addEventListener("input", direccion);
    $("#p-slug").addEventListener("input", direccion);
    direccion();

    const recoger = () => ({
      titulo: $("#p-titulo").value.trim(),
      slug: $("#p-slug").value.trim(),
      resumen: $("#p-resumen").value.trim(),
      cuerpo: texto.html(),
      menu: $("#p-menu").value,
      orden: Number($("#p-orden").value) || 0,
      estado: ($('input[name="p-estado"]:checked') || {}).value || "publicada",
      portada: p.portada,
      adjuntos: p.adjuntos,
    });
    let base = JSON.stringify(recoger());
    P.guardia = { ruta: location.hash.slice(1), sucio: () => JSON.stringify(recoger()) !== base };

    const boton = $("#p-guardar");
    const etiqueta = () => {
      const e = ($('input[name="p-estado"]:checked') || {}).value;
      boton.textContent = e === "borrador" ? "Guardar borrador" : original ? "Guardar cambios" : "Publicar página";
    };
    etiqueta();
    $$('input[name="p-estado"]').forEach((r) => r.addEventListener("change", etiqueta));

    boton.addEventListener("click", async () => {
      const datos = recoger();
      if (!datos.titulo) {
        G.toast("Escribe un título para la página.", "error");
        $("#p-titulo").focus();
        return;
      }
      boton.disabled = true;
      const t = boton.textContent;
      boton.textContent = "Guardando…";
      try {
        const g = original ? await G.actualizarPagina(original.id, datos) : await G.crearPagina(datos);
        const i = P.st.paginas.findIndex((x) => x.id === g.id);
        if (i >= 0) P.st.paginas[i] = g;
        else P.st.paginas.push(g);
        base = JSON.stringify(recoger());
        P.guardia = null;
        G.toast(g.estado === "borrador" ? "Borrador guardado" : original ? "Cambios guardados" : "Página publicada");
        if (!original) location.hash = "#pagina-editar-" + g.id;
        else P.enrutar();
      } catch (e) {
        G.toast(e.message, "error");
        boton.disabled = false;
        boton.textContent = t;
      }
    });
    if (!original) $("#p-titulo").focus();
  }

  P.ruta("pagina-nueva", () => editor(null));
  P.rutaConParametro("pagina-editar-", editor);
})(window.Panel);
