/* Panel El Guineo: entrada, menú por tipo de usuario, resumen y arranque. */
(function (P) {
  "use strict";
  const { G, esc, $, $$ } = P;

  /* --------------------------------- Entrar --------------------------------- */
  async function iniciar() {
    await G.detectar();
    if (G.modo === "demo") {
      $("#login-demo").hidden = false;
      $("#aviso-demo").hidden = false;
    }
    if (G.sesion()) {
      try {
        return entrar(await G.verificarSesion());
      } catch {}
    }
    mostrarLogin();
  }

  function mostrarLogin(mensaje) {
    $("#panel").hidden = true;
    $("#pantalla-login").hidden = false;
    document.title = "Entrar, Panel El Guineo";
    errorLogin(mensaje || "");
    mostrarClave(false);
    setTimeout(() => (campoUsuario.value.trim() ? campoClave : campoUsuario).focus(), 30);
  }

  const campoUsuario = $("#login-usuario");
  const campoClave = $("#login-clave");
  let entrando = false;

  function errorLogin(mensaje, campo) {
    const err = $("#login-error");
    err.hidden = !mensaje;
    err.textContent = mensaje || "";
    [campoUsuario, campoClave].forEach((c) => c.removeAttribute("aria-invalid"));
    if (campo) {
      campo.setAttribute("aria-invalid", "true");
      campo.focus();
      if (campo === campoClave) campo.select();
    }
  }

  // Al escribir de nuevo se quita el aviso de error.
  [campoUsuario, campoClave].forEach((c) =>
    c.addEventListener("input", () => {
      c.removeAttribute("aria-invalid");
      $("#login-error").hidden = true;
    })
  );

  // En el usuario, Enter pasa a la contraseña si aún está vacía.
  campoUsuario.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && campoUsuario.value.trim() && !campoClave.value) {
      e.preventDefault();
      campoClave.focus();
    }
  });

  // Aviso de mayúsculas activadas.
  const avisoMayus = (e) => {
    if (e.getModifierState) $("#login-mayus").hidden = !e.getModifierState("CapsLock");
  };
  campoClave.addEventListener("keydown", avisoMayus);
  campoClave.addEventListener("keyup", avisoMayus);
  campoClave.addEventListener("blur", () => ($("#login-mayus").hidden = true));

  $("#form-login").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (entrando) return;
    const usuario = campoUsuario.value.trim();
    const clave = campoClave.value;
    if (!usuario) return errorLogin("Escribe tu usuario.", campoUsuario);
    if (!clave) return errorLogin("Escribe tu contraseña.", campoClave);
    errorLogin("");
    const boton = $("#login-enviar");
    entrando = true;
    boton.disabled = true;
    boton.textContent = "Entrando…";
    try {
      const s = await G.login(usuario, clave);
      campoClave.value = "";
      mostrarClave(false);
      await entrar(s);
    } catch (ex) {
      // Usuario o contraseña incorrectos: se deja el usuario y se selecciona la contraseña para reintentar.
      errorLogin(ex.message, ex.status === 401 ? campoClave : null);
    } finally {
      entrando = false;
      boton.disabled = false;
      boton.textContent = "Entrar";
    }
  });

  function mostrarClave(ver) {
    const b = $("#ver-clave");
    campoClave.type = ver ? "text" : "password";
    $("span", b).textContent = ver ? "Ocultar" : "Mostrar";
    b.setAttribute("aria-pressed", String(ver));
    b.setAttribute("aria-label", ver ? "Ocultar contraseña" : "Mostrar contraseña");
    $(".ojo-abierto", b).toggleAttribute("hidden", ver);
    $(".ojo-cerrado", b).toggleAttribute("hidden", !ver);
  }

  $("#ver-clave").addEventListener("click", () => {
    const pos = campoClave.selectionStart;
    mostrarClave(campoClave.type === "password");
    campoClave.focus();
    try {
      campoClave.setSelectionRange(pos, pos);
    } catch {}
  });

  window.addEventListener("guineo:sesion-cerrada", (e) => {
    if (!$("#panel").hidden) {
      P.guardia = null;
      P.st.cargado = false;
      mostrarLogin((e.detail || "Tu sesión terminó.") + " Entra de nuevo para continuar.");
    }
  });

  $("#cerrar-sesion").addEventListener("click", async () => {
    if (P.hayCambios() && !(await P.confirmar("Tienes cambios sin guardar", "Si sales ahora, perderás los cambios.", "Salir"))) return;
    G.cerrarSesion();
    P.guardia = null;
    P.st.cargado = false;
    P.st.sitioOriginal = JSON.stringify(P.st.sitio);
    mostrarLogin();
  });

  P.pintarUsuario = function () {
    const s = P.st.sesion;
    $("#barra-usuario").innerHTML = `<strong>${esc(s.nombre)}</strong><span>${esc(s.rolNombre || G.ROLES[s.rol].nombre)}</span>`;
    $("#area-usuario").textContent = s.nombre;
  };

  async function entrar(s) {
    P.st.sesion = s;
    $("#pantalla-login").hidden = true;
    $("#panel").hidden = false;
    P.pintarUsuario();
    // Mostrar solo las secciones permitidas para este tipo de usuario.
    $$("[data-permiso]").forEach((el) => (el.hidden = !P.puede(el.dataset.permiso)));
    P.vista.innerHTML = '<p class="cargando-panel">Cargando contenido…</p>';
    try {
      const [sitio, noticias, archivos, paginas] = await Promise.all([G.sitio(), G.noticias(true), G.archivos(true), G.paginas(true)]);
      Object.assign(P.st, { sitio, sitioOriginal: JSON.stringify(sitio), noticias, archivos, paginas, cargado: true });
      P.contadores();
      P.enrutar();
    } catch (e) {
      P.vista.innerHTML = `<div class="vacio-panel"><strong>No se pudo cargar el contenido</strong>${esc(e.message)}<br><button class="boton" type="button" id="reintentar">Intentar de nuevo</button></div>`;
      $("#reintentar").addEventListener("click", () => entrar(s));
    }
  }

  /* --------------------------------- Rutas --------------------------------- */
  const PERMISO_RUTA = { paginas: "paginas", "pagina-nueva": "paginas", institucion: "sitio", simbolos: "sitio", contacto: "sitio", usuarios: "usuarios", actividad: "actividad" };
  const MENU_DE = (h) => (h === "nueva" || h.startsWith("editar-") ? "noticias" : h === "pagina-nueva" || h.startsWith("pagina-editar-") ? "paginas" : h);

  P.enrutar = async function () {
    if (!P.st.cargado) return;
    let h = decodeURIComponent(location.hash.slice(1)) || "resumen";
    if (P.guardia && h !== P.guardia.ruta && P.guardia.sucio()) {
      const ok = await P.confirmar("Tienes cambios sin guardar", "Si sales ahora, perderás los cambios que no has guardado.", "Salir sin guardar");
      if (!ok) {
        history.replaceState(null, "", "#" + P.guardia.ruta);
        return;
      }
    }
    P.guardia = null;
    const permiso = PERMISO_RUTA[h] || (h.startsWith("pagina-editar-") ? "paginas" : null);
    if (permiso && !P.puede(permiso)) h = "resumen";
    $$(".barra-nav a").forEach((a) => (a.dataset.v === MENU_DE(h) ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current")));
    cerrarMenu();
    const conParametro = P.rutasConParametro.find(([prefijo]) => h.startsWith(prefijo));
    if (P.vistas[h]) P.vistas[h]();
    else if (conParametro) conParametro[1](h.slice(conParametro[0].length));
    else P.vistas.resumen();
    window.scrollTo(0, 0);
    P.vista.focus({ preventScroll: true });
  };
  window.addEventListener("hashchange", () => P.enrutar());

  window.addEventListener("beforeunload", (e) => {
    if (P.st.cargado && P.hayCambios()) {
      e.preventDefault();
      e.returnValue = "";
    }
  });

  const barra = $("#barra");
  const menuBtn = $("#menu-admin");
  function cerrarMenu() {
    barra.classList.remove("abierta");
    menuBtn.setAttribute("aria-expanded", "false");
  }
  menuBtn.addEventListener("click", () => {
    const abierta = barra.classList.toggle("abierta");
    menuBtn.setAttribute("aria-expanded", String(abierta));
  });

  /* -------------------------------- Resumen -------------------------------- */
  P.ruta("resumen", function () {
    P.titulo("Resumen");
    const s = P.st.sesion;
    const publica = P.puede("publicar");
    const mias = P.st.noticias.filter((n) => P.esMio(n));
    const pend = P.pendientes();
    const docs = P.st.archivos.filter((f) => f.clase === "documento");
    const nombreCorto = /^administrador/i.test(s.nombre) ? s.nombre : s.nombre.split(" ")[0];

    const cifras = publica
      ? [
          ["Noticias publicadas", P.st.noticias.filter((n) => P.estadoNoticia(n)[0] === "publicada").length],
          ["Pendientes de revisión", pend.noticias.length + pend.documentos.length],
          ["Documentos", docs.length],
          ["Páginas", P.st.paginas.length],
        ]
      : [
          ["Mis noticias publicadas", mias.filter((n) => n.estado === "publicada").length],
          ["Mis noticias en revisión", mias.filter((n) => n.estado === "revision").length],
          ["Mis documentos", docs.filter((f) => P.esMio(f)).length],
        ];

    const accesos = [
      ["#nueva", "Nueva noticia", publica ? "Con fotos, galería, tablas y adjuntos" : "Se envía a revisión antes de publicarse", true],
      ["#documentos", "Subir documentos", "PDF, Word, Excel, imágenes, hasta 18 MB", true],
      ["#pagina-nueva", "Nueva página", "Matrículas, horarios, PAE o lo que necesites", P.puede("paginas")],
      ["#institucion", "Información institucional", "Misión, visión, valores, historia", P.puede("sitio")],
      ["#usuarios", "Usuarios", "Crea cuentas para coordinadores y docentes", P.puede("usuarios")],
      ["#mi-cuenta", "Mi cuenta", "Cambia tu nombre o tu contraseña", !publica],
    ].filter((a) => a[3]);

    const pendientesHtml =
      publica && (pend.noticias.length || pend.documentos.length)
        ? `<section class="pendientes">
        <h2 class="subtitulo">Para revisar</h2>
        <div class="archivos-lista">
          ${pend.noticias
            .map(
              (n) => `<div class="archivo-fila"><span class="tipo-archivo" data-familia="texto" aria-hidden="true"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M5 5h11v14H6a1 1 0 0 1-1-1V5Zm11 4h3v9a1 1 0 0 1-1 1h-2M8 9h5M8 12.5h5M8 16h3"/></svg></span><div><h3>${esc(n.titulo)}</h3><p>Noticia de ${esc(n.autorNombre || n.autor)}, ${esc(P.fecha(n.actualizada ? n.actualizada.slice(0, 10) : n.fecha, true))}</p></div><div class="acciones-fila"><a class="boton" href="#editar-${esc(n.id)}">Revisar</a></div></div>`
            )
            .join("")}
          ${pend.documentos
            .map(
              (f) => `<div class="archivo-fila">${P.tipoArchivoHtml(f)}<div><h3>${esc(f.titulo)}</h3><p>Documento de ${esc(f.autorNombre || f.autor)} para la carpeta ${esc(f.categoria)}</p></div><div class="acciones-fila"><a class="boton discreto" href="${esc(f.url)}" target="_blank" rel="noopener">Ver</a><button class="boton" type="button" data-aprobar-doc="${esc(f.id)}">Aprobar</button></div></div>`
            )
            .join("")}
        </div></section>`
        : "";

    P.vista.innerHTML = `
      <div class="vista-cabeza"><div><h1>Hola, ${esc(nombreCorto)}</h1><p>Entras como ${esc(s.rolNombre || G.ROLES[s.rol].nombre)}. ${esc(G.ROLES[s.rol].descripcion)}</p></div></div>
      ${
        s.claveInicial
          ? `<div class="aviso-panel alerta" style="margin-bottom:1.5rem"><p><strong>${s.principal ? "Estás usando la contraseña inicial del sitio." : "Estás usando la contraseña que te asignaron."}</strong> Cámbiala por una que solo tú conozcas.</p><a class="boton" href="#mi-cuenta">Cambiar contraseña</a></div>`
          : ""
      }
      <dl class="cifras" style="--columnas:${cifras.length}">${cifras.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join("")}</dl>
      ${pendientesHtml}
      <div class="accesos">${accesos.map(([h, t, d]) => `<a class="acceso" href="${h}"><strong>${esc(t)}</strong><span>${esc(d)}</span></a>`).join("")}</div>
      <h2 class="subtitulo">${publica ? "Últimas noticias" : "Mis noticias"}</h2>
      ${P.tablaNoticias((publica ? P.st.noticias : mias).slice(0, 6))}`;
    P.enlazarTablaNoticias();
    $$("[data-aprobar-doc]").forEach((b) =>
      b.addEventListener("click", async () => {
        try {
          const f = await P.aprobarDocumento(b.dataset.aprobarDoc);
          G.toast(`«${f.titulo}» aprobado y publicado`);
          P.enrutar();
        } catch (e) {
          G.toast(e.message, "error");
        }
      })
    );
  });

  iniciar();
})(window.Panel);
