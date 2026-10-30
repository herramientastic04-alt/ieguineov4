/* Panel El Guineo: núcleo compartido (estado, permisos, utilidades, subidas, rutas). */
(function () {
  "use strict";
  const G = window.Guineo;

  const P = {
    G,
    esc: G.esc,
    fecha: G.fecha,
    fechaHora: G.fechaHora,
    tamano: G.tamano,
    familia: G.familia,
    $: (s, el = document) => el.querySelector(s),
    $$: (s, el = document) => Array.from(el.querySelectorAll(s)),
    vista: document.getElementById("vista-admin"),
    st: { sitio: null, sitioOriginal: "", noticias: [], archivos: [], paginas: [], sesion: null, cargado: false },
    vistas: {}, // nombre de ruta -> función
    rutasConParametro: [], // [prefijo, función]
    guardia: null, // { ruta, sucio() } para avisar de cambios sin guardar
  };

  P.ICONO = {
    arriba: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6"/></svg>',
    abajo: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M6 13l6 6 6-6"/></svg>',
    quitar: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    subir: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"/></svg>',
    carpeta: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 7a1.5 1.5 0 0 1 1.5-1.5h4l2 2h8A1.5 1.5 0 0 1 20.5 9v9a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 18V7Z"/></svg>',
    reloj: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z"/></svg>',
    foto: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16v12H4zM4 15l4.5-4.5 4 4L15 12l5 5M15.5 9.5h.01"/></svg>',
    todos: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16M4 12h16M4 19h16"/></svg>',
  };

  P.hoy = () => new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10);

  /* ------------------------------ Permisos ------------------------------ */
  P.puede = (accion) => Boolean(P.st.sesion && (P.st.sesion.permisos || []).includes(accion));
  P.esMio = (item) => Boolean(item && P.st.sesion && item.autor === P.st.sesion.usuario);
  P.puedeEditarNoticia = (n) => P.puede("editarTodo") || (P.esMio(n) && n.estado !== "publicada");
  P.puedeEditarArchivo = (f) => P.puede("editarTodo") || P.esMio(f);

  P.titulo = (t) => (document.title = t + ", Panel El Guineo");

  /* ------------------------------- Diálogo ------------------------------- */
  // Confirmación propia (sin alert/confirm del navegador). Con "campo" pide un texto.
  P.confirmar = function (titulo, texto, accion = "Eliminar", peligro = true, campo = null) {
    return new Promise((resolve) => {
      const modal = P.$("#modal");
      P.$("#modal-titulo").textContent = titulo;
      P.$("#modal-texto").textContent = texto || "";
      P.$("#modal-texto").hidden = !texto;
      const caja = P.$("#modal-campo");
      const input = P.$("#modal-input");
      caja.hidden = !campo;
      if (campo) {
        P.$("#modal-etiqueta").textContent = campo.etiqueta;
        input.value = campo.valor || "";
      }
      const ok = P.$("#modal-aceptar");
      const no = P.$("#modal-cancelar");
      ok.textContent = accion;
      ok.className = "boton " + (peligro ? "peligro" : "");
      const previo = document.activeElement;
      modal.hidden = false;
      (campo ? input : no).focus();
      if (campo) input.select();
      const fin = (valor) => {
        modal.hidden = true;
        ok.removeEventListener("click", si);
        no.removeEventListener("click", cancelar);
        document.removeEventListener("keydown", tecla);
        previo && previo.focus && previo.focus();
        resolve(valor);
      };
      const si = () => {
        if (campo && !input.value.trim()) return input.focus();
        fin(campo ? input.value.trim() : true);
      };
      const cancelar = () => fin(campo ? null : false);
      const tecla = (e) => {
        if (e.key === "Escape") cancelar();
        if (e.key === "Enter" && campo) si();
      };
      ok.addEventListener("click", si);
      no.addEventListener("click", cancelar);
      document.addEventListener("keydown", tecla);
    });
  };

  P.pedirTexto = (titulo, etiqueta, valor, accion = "Guardar") => P.confirmar(titulo, "", accion, false, { etiqueta, valor });

  /* ------------------------------- Archivos ------------------------------- */
  P.elegirArchivos = function ({ accept = "", multiple = false } = {}) {
    return new Promise((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = accept;
      input.multiple = multiple;
      input.addEventListener("change", () => resolve(Array.from(input.files || [])));
      input.click();
    });
  };

  P.subirUno = async function (file, datos, onProgress) {
    const f = datos.clase === "imagen" ? await G.prepararImagen(file) : file;
    const rec = await G.subirArchivo(f, datos, onProgress);
    P.st.archivos.unshift(rec);
    return rec;
  };

  // Sube varios archivos uno por uno, mostrando el progreso en "cont".
  P.subirVarios = async function (files, datos, cont) {
    const hechos = [];
    for (const file of files) {
      const item = document.createElement("div");
      item.className = "cola-item";
      item.innerHTML = `<strong>${P.esc(file.name)}</strong><span class="estado-texto">Preparando…</span><div class="barra-progreso"><span></span></div>`;
      cont && cont.prepend(item);
      const barra = P.$(".barra-progreso span", item);
      const estado = P.$(".estado-texto", item);
      try {
        const rec = await P.subirUno(file, datos, (p) => {
          barra.style.width = Math.round(p * 100) + "%";
          estado.textContent = `Subiendo ${Math.round(p * 100)} %`;
        });
        item.classList.add("ok");
        barra.style.width = "100%";
        estado.textContent = (rec.revision ? "Subido, en revisión. " : "Subido, ") + G.tamano(rec.tamano);
        hechos.push(rec);
        setTimeout(() => item.remove(), 5000);
      } catch (e) {
        item.classList.add("error");
        estado.textContent = e.message;
        if (!cont) G.toast(`${file.name}: ${e.message}`, "error");
      }
    }
    return hechos;
  };

  P.prepararZona = function (zona, alSoltar, alElegir) {
    zona.addEventListener("dragover", (e) => {
      e.preventDefault();
      zona.classList.add("encima");
    });
    zona.addEventListener("dragleave", () => zona.classList.remove("encima"));
    zona.addEventListener("drop", (e) => {
      e.preventDefault();
      zona.classList.remove("encima");
      const files = Array.from(e.dataTransfer.files || []);
      if (files.length) alSoltar(files);
    });
    if (alElegir) {
      zona.addEventListener("click", alElegir);
      zona.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          alElegir();
        }
      });
    }
  };

  P.enlaceAbsoluto = (url) => (!url || url.startsWith("data:") ? url : new URL(url, location.href).href);

  P.copiar = async function (texto, aviso = "Enlace copiado") {
    try {
      await navigator.clipboard.writeText(texto);
      G.toast(aviso);
    } catch {
      G.toast("No se pudo copiar automáticamente: " + texto, "error");
    }
  };

  P.usosDeArchivo = function (url) {
    const enNoticias = P.st.noticias.filter(
      (n) => (n.portada && n.portada.url === url) || (n.galeria || []).some((g) => g.url === url) || (n.adjuntos || []).some((a) => a.url === url) || (n.cuerpo || "").includes(url)
    );
    const enPaginas = P.st.paginas.filter((p) => (p.portada && p.portada.url === url) || (p.adjuntos || []).some((a) => a.url === url) || (p.cuerpo || "").includes(url));
    return [...enNoticias.map((n) => "la noticia «" + n.titulo + "»"), ...enPaginas.map((p) => "la página «" + p.titulo + "»")];
  };

  P.tipoArchivoHtml = function (f, clase = "") {
    const fam = G.familia(f.ext);
    if (fam === "imagen") return `<img class="miniatura-archivo ${clase}" src="${P.esc(f.url)}" alt="" loading="lazy">`;
    return `<span class="tipo-archivo ${clase}" data-familia="${fam}" aria-hidden="true">${P.esc((f.ext || "doc").slice(0, 4))}</span>`;
  };

  P.categoriasNoticias = function () {
    const base = (P.st.sitio.noticias && P.st.sitio.noticias.categorias) || [];
    return Array.from(new Set([...base, ...P.st.noticias.map((n) => n.categoria).filter(Boolean)]));
  };

  P.carpetas = () => (P.st.sitio.documentos && P.st.sitio.documentos.categorias) || [];

  P.estadoNoticia = function (n) {
    if (n.estado === "borrador") return ["borrador", "Borrador"];
    if (n.estado === "revision") return ["revision", "En revisión"];
    if (n.fecha > P.hoy()) return ["programada", "Programada"];
    return ["publicada", "Publicada"];
  };

  P.pendientes = () => ({
    noticias: P.st.noticias.filter((n) => n.estado === "revision"),
    documentos: P.st.archivos.filter((f) => f.clase === "documento" && f.revision),
  });

  // Actualiza los contadores de pendientes en el menú lateral.
  P.contadores = function () {
    const p = P.pendientes();
    const pintar = (id, n) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.hidden = !(P.puede("publicar") && n);
      el.textContent = n;
      el.title = n + " en revisión";
    };
    pintar("cuenta-noticias", p.noticias.length);
    pintar("cuenta-documentos", p.documentos.length);
  };

  /* -------------------------------- Rutas -------------------------------- */
  P.ruta = (nombre, fn) => (P.vistas[nombre] = fn);
  P.rutaConParametro = (prefijo, fn) => P.rutasConParametro.push([prefijo, fn]);

  P.hayCambios = () => (P.guardia && P.guardia.sucio()) || (P.st.sitio && JSON.stringify(P.st.sitio) !== P.st.sitioOriginal);

  P.irA = (hash) => {
    if (location.hash === "#" + hash) P.enrutar();
    else location.hash = "#" + hash;
  };

  // La función enrutar se completa en inicio.js.
  P.enrutar = () => {};

  window.Panel = P;
})();
