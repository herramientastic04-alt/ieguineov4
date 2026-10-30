/* Panel El Guineo: información institucional (institución, símbolos, contacto y aviso). */
(function (P) {
  "use strict";
  const { G, esc, $ } = P;

  const FORMULARIOS = {
    institucion: {
      titulo: "Institución",
      texto: "La información que aparece en las páginas Inicio e Institución.",
      grupos: [
        {
          titulo: "Identidad",
          texto: "Nombre, lema y datos que se muestran en la portada y el pie de página.",
          campos: [
            { k: "identidad.nombre", l: "Nombre de la institución" },
            { fila: [{ k: "identidad.lema", l: "Lema", a: "Va en la cinta roja de la portada." }, { k: "identidad.eslogan", l: "Eslogan del PEI" }] },
            { k: "identidad.presentacion", l: "Presentación corta", t: "area", filas: 3, a: "Una o dos frases para la portada." },
            { fila: [{ k: "identidad.rector", l: "Rector o rectora" }, { k: "identidad.caracter", l: "Carácter" }] },
            { fila: [{ k: "identidad.dane", l: "Código DANE" }, { k: "identidad.nit", l: "NIT" }] },
            { fila: [{ k: "identidad.nucleo", l: "Núcleo" }, { k: "identidad.jornada", l: "Jornada" }] },
            { fila: [{ k: "identidad.corregimiento", l: "Corregimiento" }, { k: "identidad.municipio", l: "Municipio" }] },
            { k: "identidad.departamento", l: "Departamento" },
            { k: "identidad.niveles", l: "Niveles que ofrece", t: "lista" },
            { k: "identidad.resoluciones", l: "Resoluciones", t: "lista" },
          ],
        },
        {
          titulo: "Misión y visión",
          campos: [
            { k: "mision", l: "Misión", t: "area", filas: 8 },
            { k: "vision", l: "Visión", t: "area", filas: 8 },
          ],
        },
        {
          titulo: "Filosofía",
          campos: [
            { k: "filosofia", l: "Párrafos de la filosofía", t: "lista", largo: true },
            { k: "principios", l: "Principios", t: "lista", largo: true },
            { k: "pilares", l: "Pilares de la convivencia", t: "lista", largo: true },
          ],
        },
        {
          titulo: "Valores",
          campos: [
            { k: "valores.introduccion", l: "Introducción", t: "area", filas: 3 },
            { k: "valores.sociales", l: "Valores sociales", t: "lista" },
            { k: "valores.espirituales", l: "Valores espirituales", t: "lista" },
            { k: "valores.intelectuales", l: "Valores intelectuales", t: "lista" },
          ],
        },
        { titulo: "Perfil del estudiante", campos: [{ k: "perfilEstudiante", l: "Rasgos", t: "lista" }] },
        {
          titulo: "Proyectos pedagógicos",
          campos: [
            {
              k: "proyectos",
              l: "Proyectos",
              t: "pares",
              sub: [
                { k: "nombre", l: "Nombre" },
                { k: "detalle", l: "Descripción", t: "area" },
              ],
              nuevo: { nombre: "", detalle: "" },
            },
          ],
        },
        {
          titulo: "Reseña histórica",
          texto: "Los hitos se muestran como una línea de tiempo, en el orden de esta lista.",
          campos: [
            { k: "historia.introduccion", l: "Introducción", t: "area", filas: 4 },
            {
              k: "historia.hitos",
              l: "Hitos",
              t: "pares",
              enLinea: true,
              sub: [
                { k: "anio", l: "Año" },
                { k: "texto", l: "Qué pasó", t: "area" },
              ],
              nuevo: { anio: "", texto: "" },
            },
          ],
        },
      ],
    },
    simbolos: {
      titulo: "Símbolos",
      texto: "El escudo, la bandera y el himno de la institución. La bandera y el himno aparecen en el sitio cuando tienen contenido.",
      grupos: [
        {
          titulo: "Escudo",
          campos: [
            { k: "simbolos.escudoUrl", l: "Imagen del escudo", t: "imagen", original: "assets/img/escudo.webp", a: "Usa un PNG con fondo transparente. Se muestra en la cabecera, la portada y el pie." },
            {
              k: "simbolos.escudoElementos",
              l: "Elementos del escudo y su significado",
              t: "pares",
              sub: [
                { k: "nombre", l: "Elemento" },
                { k: "texto", l: "Significado", t: "area" },
              ],
              nuevo: { nombre: "", texto: "" },
            },
          ],
        },
        {
          titulo: "Bandera",
          texto: "Si no subes imagen ni descripción, la bandera no aparece en el sitio.",
          campos: [
            { k: "simbolos.banderaUrl", l: "Imagen de la bandera", t: "imagen" },
            { k: "simbolos.banderaDescripcion", l: "Descripción y significado de los colores", t: "area", filas: 5 },
          ],
        },
        {
          titulo: "Himno",
          texto: "Si no escribes la letra ni subes el audio, el himno no aparece en el sitio.",
          campos: [
            { fila: [{ k: "simbolos.himno.titulo", l: "Título" }, { k: "simbolos.himno.autor", l: "Autor de la letra y la música" }] },
            { k: "simbolos.himno.letra", l: "Letra", t: "area", filas: 14, a: "Separa las estrofas con una línea en blanco. Si una estrofa empieza con la palabra Coro, se muestra resaltada." },
            { k: "simbolos.himno.audioUrl", l: "Audio del himno (opcional)", t: "audio", a: "MP3 o M4A, hasta 18 MB." },
          ],
        },
      ],
    },
    contacto: {
      titulo: "Contacto y aviso",
      texto: "Datos de contacto, sedes, el aviso destacado y las categorías de noticias.",
      grupos: [
        {
          titulo: "Aviso destacado",
          texto: "Una franja roja bajo el menú, en todas las páginas. Úsala para avisos urgentes, como un cambio de horario.",
          campos: [
            { k: "aviso.activo", l: "Mostrar el aviso en el sitio", t: "check" },
            { k: "aviso.texto", l: "Texto del aviso", t: "area", filas: 2 },
            { k: "aviso.enlace", l: "Enlace (opcional)", a: "Por ejemplo, el enlace de una noticia o un documento." },
          ],
        },
        {
          titulo: "Datos de contacto",
          texto: "Los campos vacíos no se muestran en el sitio.",
          campos: [
            { k: "contacto.direccion", l: "Dirección" },
            { fila: [{ k: "contacto.telefono", l: "Teléfono" }, { k: "contacto.whatsapp", l: "WhatsApp" }] },
            { fila: [{ k: "contacto.correo", l: "Correo electrónico" }, { k: "contacto.horario", l: "Horario de atención" }] },
            { k: "contacto.facebook", l: "Página de Facebook", a: "Pega la dirección completa, por ejemplo https://facebook.com/…" },
            { k: "contacto.mapa", l: "Enlace de Google Maps", a: "En Google Maps, busca la institución, toca Compartir y pega aquí el enlace." },
          ],
        },
        {
          titulo: "Sedes",
          campos: [
            {
              k: "contacto.sedes",
              l: "Sedes",
              t: "pares",
              sub: [
                { k: "nombre", l: "Nombre de la sede" },
                { k: "detalle", l: "Ubicación o niveles que atiende" },
              ],
              nuevo: { nombre: "", detalle: "" },
            },
          ],
        },
        {
          titulo: "Categorías",
          texto: "Las opciones que aparecen al publicar noticias. Las carpetas de documentos se organizan en la sección Documentos.",
          campos: [
            { k: "noticias.categorias", l: "Categorías de noticias", t: "lista" },
          ],
        },
      ],
    },
  };

  const leer = (obj, ruta) => ruta.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
  function escribir(obj, ruta, valor) {
    const partes = ruta.split(".");
    let o = obj;
    partes.slice(0, -1).forEach((k) => {
      if (o[k] == null || typeof o[k] !== "object") o[k] = {};
      o = o[k];
    });
    o[partes[partes.length - 1]] = valor;
  }
  const idDe = (k) => "f-" + k.replace(/\./g, "-");

  let camposActivos = {};

  function campoHtml(c) {
    if (c.fila) return `<div class="dos-columnas">${c.fila.map(campoHtml).join("")}</div>`;
    camposActivos[c.k] = c;
    return `<div class="campo-envoltura" id="c-${idDe(c.k)}">${campoInterior(c)}</div>`;
  }

  function campoInterior(c) {
    const v = leer(P.st.sitio, c.k);
    const id = idDe(c.k);
    const ayuda = c.a ? `<span class="ayuda">${esc(c.a)}</span>` : "";
    switch (c.t) {
      case "area":
        return `<div class="campo"><label for="${id}">${esc(c.l)}</label><textarea id="${id}" data-k="${c.k}" rows="${c.filas || 4}">${esc(v || "")}</textarea>${ayuda}</div>`;
      case "check":
        return `<label class="casilla"><input type="checkbox" id="${id}" data-k="${c.k}" ${v ? "checked" : ""}><span>${esc(c.l)}</span></label>`;
      case "lista": {
        const lista = Array.isArray(v) ? v : [];
        return `<div class="campo"><span class="etiqueta">${esc(c.l)}</span>${ayuda}<div class="lista-editable">${lista
          .map(
            (item, i) => `<div class="item-lista">
              ${
                c.largo
                  ? `<textarea id="${id}-${i}" data-k="${c.k}" data-i="${i}" rows="3" aria-label="${esc(c.l)} ${i + 1}">${esc(item)}</textarea>`
                  : `<input type="text" id="${id}-${i}" data-k="${c.k}" data-i="${i}" value="${esc(item)}" aria-label="${esc(c.l)} ${i + 1}">`
              }
              ${miniAcciones(c.k, i, lista.length)}
            </div>`
          )
          .join("")}</div><button type="button" class="boton secundario agregar" data-agregar="${c.k}">Agregar</button></div>`;
      }
      case "pares": {
        const lista = Array.isArray(v) ? v : [];
        return `<div class="campo"><span class="etiqueta">${esc(c.l)}</span>${ayuda}<div class="lista-editable">${lista
          .map(
            (item, i) => `<div class="item-lista par">
              <div class="subcampos ${c.enLinea ? "en-linea" : ""}">${c.sub
                .map((s) => {
                  const sid = `${id}-${i}-${s.k}`;
                  const val = esc((item && item[s.k]) || "");
                  return `<div class="campo"><label for="${sid}">${esc(s.l)}</label>${
                    s.t === "area"
                      ? `<textarea id="${sid}" data-k="${c.k}" data-i="${i}" data-sub="${s.k}" rows="3">${val}</textarea>`
                      : `<input type="text" id="${sid}" data-k="${c.k}" data-i="${i}" data-sub="${s.k}" value="${val}">`
                  }</div>`;
                })
                .join("")}</div>
              ${miniAcciones(c.k, i, lista.length)}
            </div>`
          )
          .join("")}</div><button type="button" class="boton secundario agregar" data-agregar="${c.k}">Agregar</button></div>`;
      }
      case "imagen":
      case "audio": {
        const esImagen = c.t === "imagen";
        const previa = v ? (esImagen ? `<img src="${esc(v)}" alt="">` : "Audio cargado") : esImagen ? "Sin imagen" : "Sin audio";
        return `<div class="campo"><span class="etiqueta">${esc(c.l)}</span>
          <div class="archivo-campo">
            <div class="previa">${previa}</div>
            <div style="display:grid;gap:.5rem">
              ${v && !esImagen ? `<audio controls src="${esc(v)}" preload="none"></audio>` : ""}
              <div class="acciones-fila">
                <button type="button" class="boton secundario" data-subir-campo="${c.k}">${v ? "Cambiar" : "Subir"} ${esImagen ? "imagen" : "audio"}</button>
                ${v ? `<button type="button" class="boton discreto" data-vaciar-campo="${c.k}">Quitar</button>` : ""}
                ${c.original && v !== c.original ? `<button type="button" class="boton discreto" data-original-campo="${c.k}">Usar el escudo original</button>` : ""}
              </div>
              ${ayuda}
            </div>
          </div></div>`;
      }
      default:
        return `<div class="campo"><label for="${id}">${esc(c.l)}</label><input type="text" id="${id}" data-k="${c.k}" value="${esc(v || "")}">${ayuda}</div>`;
    }
  }

  function miniAcciones(k, i, total) {
    return `<div class="mini-acciones">
      <button type="button" class="mini" data-mover="${k}" data-i="${i}" data-dir="-1" ${i === 0 ? "disabled" : ""} aria-label="Subir">${P.ICONO.arriba}</button>
      <button type="button" class="mini" data-mover="${k}" data-i="${i}" data-dir="1" ${i === total - 1 ? "disabled" : ""} aria-label="Bajar">${P.ICONO.abajo}</button>
      <button type="button" class="mini quitar" data-quitar="${k}" data-i="${i}" aria-label="Quitar">${P.ICONO.quitar}</button>
    </div>`;
  }

  function repintarCampo(k, enfocar) {
    const c = camposActivos[k];
    const cont = document.getElementById("c-" + idDe(k));
    if (!c || !cont) return;
    cont.innerHTML = campoInterior(c);
    if (enfocar) {
      const el = document.getElementById(enfocar);
      el && el.focus();
    }
  }

  function vFormulario(nombre) {
    const def = FORMULARIOS[nombre];
    P.titulo(def.titulo);
    camposActivos = {};
    P.vista.innerHTML = `
      <div class="vista-cabeza"><div><h1>${esc(def.titulo)}</h1><p>${esc(def.texto)}</p></div>
        <a class="boton secundario" href="./#${nombre === "contacto" ? "contacto" : nombre}" target="_blank" rel="noopener">Ver en el sitio</a></div>
      <div class="formulario" id="formulario">
        ${def.grupos
          .map(
            (g) => `<section class="grupo">
          <div class="grupo-cabeza"><h2>${esc(g.titulo)}</h2>${g.texto ? `<p>${esc(g.texto)}</p>` : ""}</div>
          <div class="grupo-campos">${g.campos.map(campoHtml).join("")}</div>
        </section>`
          )
          .join("")}
      </div>
      <div class="barra-guardar" id="barra-guardar"><p id="estado-guardado"></p><button class="boton" type="button" id="guardar-sitio">Guardar cambios</button></div>`;

    const form = $("#formulario");
    form.addEventListener("input", (e) => {
      const el = e.target;
      const k = el.dataset.k;
      if (!k) return;
      if (el.dataset.i !== undefined) {
        const lista = leer(P.st.sitio, k);
        const i = Number(el.dataset.i);
        if (el.dataset.sub) lista[i] = { ...lista[i], [el.dataset.sub]: el.value };
        else lista[i] = el.value;
      } else {
        escribir(P.st.sitio, k, el.type === "checkbox" ? el.checked : el.value);
      }
      estadoGuardado();
    });
    form.addEventListener("change", (e) => {
      if (e.target.type === "checkbox" && e.target.dataset.k) {
        escribir(P.st.sitio, e.target.dataset.k, e.target.checked);
        estadoGuardado();
      }
    });
    form.addEventListener("click", async (e) => {
      const ag = e.target.closest("[data-agregar]");
      const mo = e.target.closest("[data-mover]");
      const qu = e.target.closest("[data-quitar]");
      const su = e.target.closest("[data-subir-campo]");
      const va = e.target.closest("[data-vaciar-campo]");
      const or = e.target.closest("[data-original-campo]");
      if (ag) {
        const k = ag.dataset.agregar;
        const c = camposActivos[k];
        const lista = Array.isArray(leer(P.st.sitio, k)) ? leer(P.st.sitio, k) : [];
        lista.push(c.t === "pares" ? { ...c.nuevo } : "");
        escribir(P.st.sitio, k, lista);
        const i = lista.length - 1;
        repintarCampo(k, c.t === "pares" ? `${idDe(k)}-${i}-${c.sub[0].k}` : `${idDe(k)}-${i}`);
        estadoGuardado();
      }
      if (mo) {
        const k = mo.dataset.mover;
        const lista = leer(P.st.sitio, k);
        const i = Number(mo.dataset.i);
        const j = i + Number(mo.dataset.dir);
        if (j < 0 || j >= lista.length) return;
        [lista[i], lista[j]] = [lista[j], lista[i]];
        repintarCampo(k);
        estadoGuardado();
      }
      if (qu) {
        const k = qu.dataset.quitar;
        leer(P.st.sitio, k).splice(Number(qu.dataset.i), 1);
        repintarCampo(k);
        estadoGuardado();
      }
      if (su) {
        const k = su.dataset.subirCampo;
        const c = camposActivos[k];
        const [file] = await P.elegirArchivos({ accept: c.t === "imagen" ? "image/*" : "audio/*" });
        if (!file) return;
        su.disabled = true;
        su.textContent = "Subiendo…";
        try {
          const rec = await P.subirUno(file, { clase: c.t === "imagen" ? "imagen" : "medio", visible: false, categoria: "Símbolos", titulo: c.l });
          escribir(P.st.sitio, k, rec.url);
          G.toast("Archivo subido. Guarda los cambios para publicarlo.");
        } catch (ex) {
          G.toast(ex.message, "error");
        }
        repintarCampo(k);
        estadoGuardado();
      }
      if (va) {
        escribir(P.st.sitio, va.dataset.vaciarCampo, "");
        repintarCampo(va.dataset.vaciarCampo);
        estadoGuardado();
      }
      if (or) {
        escribir(P.st.sitio, or.dataset.originalCampo, camposActivos[or.dataset.originalCampo].original);
        repintarCampo(or.dataset.originalCampo);
        estadoGuardado();
      }
    });

    $("#guardar-sitio").addEventListener("click", async () => {
      const b = $("#guardar-sitio");
      b.disabled = true;
      b.textContent = "Guardando…";
      try {
        const limpio = limpiarListas(structuredClone(P.st.sitio));
        const r = await G.guardarSitio(limpio);
        P.st.sitio = r;
        P.st.sitioOriginal = JSON.stringify(r);
        G.toast("Cambios guardados");
        vFormulario(nombre);
      } catch (ex) {
        G.toast(ex.message, "error");
        b.disabled = false;
        b.textContent = "Guardar cambios";
      }
    });
    estadoGuardado();
  }

  // Quita los elementos vacíos de las listas antes de guardar.
  function limpiarListas(o) {
    if (Array.isArray(o)) {
      return o
        .map(limpiarListas)
        .filter((x) => (typeof x === "string" ? x.trim() !== "" : x && typeof x === "object" ? Object.values(x).some((v) => String(v || "").trim() !== "") : true));
    }
    if (o && typeof o === "object") {
      Object.keys(o).forEach((k) => (o[k] = limpiarListas(o[k])));
    }
    return o;
  }

  function estadoGuardado() {
    const bar = $("#barra-guardar");
    if (!bar) return;
    const sucio = JSON.stringify(P.st.sitio) !== P.st.sitioOriginal;
    bar.classList.toggle("sucio", sucio);
    const act = P.st.sitio.actualizado;
    $("#estado-guardado").textContent = sucio
      ? "Tienes cambios sin guardar"
      : act
      ? `Guardado por última vez el ${P.fecha(new Date(new Date(act).getTime() - 5 * 3600000).toISOString().slice(0, 10))}`
      : "Sin cambios";
  }


  P.ruta("institucion", () => vFormulario("institucion"));
  P.ruta("simbolos", () => vFormulario("simbolos"));
  P.ruta("contacto", () => vFormulario("contacto"));
})(window.Panel);
